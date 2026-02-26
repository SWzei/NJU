import { Worker } from 'worker_threads';

const RESPONSE_BUFFER_BYTES = 4 * 1024 * 1024;
const DEFAULT_QUERY_TIMEOUT_MS = 30000;

function normalizeSqlText(rawSql) {
  if (typeof rawSql !== 'string') {
    throw new Error('SQL statement must be a string');
  }

  let sql = rawSql.trim().replace(/;+\s*$/g, '');

  const insertOrIgnorePattern = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i;
  const isInsertOrIgnore = insertOrIgnorePattern.test(sql);
  if (isInsertOrIgnore) {
    sql = sql.replace(insertOrIgnorePattern, 'INSERT INTO');
  }

  let paramIndex = 0;
  sql = sql.replace(/\?/g, () => `$${++paramIndex}`);

  if (isInsertOrIgnore) {
    const returningMatch = /\bRETURNING\b/i.exec(sql);
    if (returningMatch) {
      const idx = returningMatch.index;
      sql = `${sql.slice(0, idx).trimEnd()} ON CONFLICT DO NOTHING ${sql.slice(idx)}`;
    } else {
      sql = `${sql} ON CONFLICT DO NOTHING`;
    }
  }

  return { sql, placeholderCount: paramIndex };
}

function splitStatements(rawSql) {
  return String(rawSql)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferInsertId(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!firstRow || typeof firstRow !== 'object') {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(firstRow, 'id')) {
    const idValue = Number(firstRow.id);
    return Number.isNaN(idValue) ? firstRow.id : idValue;
  }

  const firstValue = Object.values(firstRow)[0];
  if (firstValue === undefined) {
    return undefined;
  }
  const numeric = Number(firstValue);
  return Number.isNaN(numeric) ? firstValue : numeric;
}

class PostgresPreparedStatement {
  constructor(db, sourceSql) {
    this.db = db;
    this.sourceSql = sourceSql;
  }

  run(...params) {
    return this.db._execute(this.sourceSql, params, 'run');
  }

  get(...params) {
    return this.db._execute(this.sourceSql, params, 'get');
  }

  all(...params) {
    return this.db._execute(this.sourceSql, params, 'all');
  }
}

class PostgresCompatDb {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.queryTimeoutMs = Number(process.env.PG_QUERY_TIMEOUT_MS || DEFAULT_QUERY_TIMEOUT_MS);
    this.transactionDepth = 0;
    this.savepointCounter = 0;

    this.worker = new Worker(new URL('./postgresWorker.js', import.meta.url), {
      type: 'module',
      workerData: { databaseUrl }
    });

    this.worker.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Postgres worker error:', err);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        // eslint-disable-next-line no-console
        console.error(`Postgres worker exited with code ${code}`);
      }
    });
  }

  prepare(sql) {
    return new PostgresPreparedStatement(this, sql);
  }

  pragma() {
    // No-op for Postgres compatibility.
  }

  exec(sql) {
    const statements = splitStatements(sql);
    for (const statement of statements) {
      this._dispatch(statement, [], 'exec');
    }
  }

  transaction(callback) {
    if (typeof callback !== 'function') {
      throw new Error('transaction callback must be a function');
    }

    return (...args) => {
      const outermost = this.transactionDepth === 0;
      const savepointName = `sp_${++this.savepointCounter}`;

      if (outermost) {
        this.exec('BEGIN');
      } else {
        this.exec(`SAVEPOINT ${savepointName}`);
      }

      this.transactionDepth += 1;

      try {
        const result = callback(...args);

        if (outermost) {
          this.exec('COMMIT');
        } else {
          this.exec(`RELEASE SAVEPOINT ${savepointName}`);
        }

        return result;
      } catch (err) {
        try {
          if (outermost) {
            this.exec('ROLLBACK');
          } else {
            this.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            this.exec(`RELEASE SAVEPOINT ${savepointName}`);
          }
        } catch (rollbackError) {
          // eslint-disable-next-line no-console
          console.error('Rollback failed:', rollbackError);
        }
        throw err;
      } finally {
        this.transactionDepth -= 1;
      }
    };
  }

  _execute(rawSql, params, mode) {
    const isInsert = /^\s*INSERT\b/i.test(rawSql);
    const hasReturning = /\bRETURNING\b/i.test(rawSql);

    let querySql = rawSql;
    if (mode === 'run' && isInsert && !hasReturning) {
      querySql = `${rawSql} RETURNING *`;
    }

    const response = this._dispatch(querySql, params, mode);

    if (mode === 'all') {
      return response.rows;
    }

    if (mode === 'get') {
      return response.rows[0];
    }

    if (mode === 'run') {
      const result = {
        changes: response.rowCount
      };
      const insertId = inferInsertId(response.rows);
      if (insertId !== undefined) {
        result.lastInsertRowid = insertId;
      }
      return result;
    }

    return response;
  }

  _dispatch(rawSql, params, mode) {
    const { sql, placeholderCount } = normalizeSqlText(rawSql);
    const boundParams = Array.isArray(params) ? params : [];

    if (placeholderCount !== boundParams.length) {
      throw new Error(
        `SQL placeholder mismatch: expected ${placeholderCount}, received ${boundParams.length}. SQL: ${rawSql}`
      );
    }

    const sab = new SharedArrayBuffer(8 + RESPONSE_BUFFER_BYTES);
    const header = new Int32Array(sab, 0, 2);

    this.worker.postMessage({
      sql,
      params: boundParams,
      mode,
      sab
    });

    const waitResult = Atomics.wait(header, 0, 0, this.queryTimeoutMs);
    if (waitResult === 'timed-out') {
      throw new Error(`Postgres query timed out after ${this.queryTimeoutMs}ms: ${sql}`);
    }

    const status = Atomics.load(header, 0);
    const length = Atomics.load(header, 1);
    const payloadBytes = new Uint8Array(sab, 8, Math.max(0, length));
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = payloadText ? JSON.parse(payloadText) : { ok: false, error: { message: 'Empty response' } };

    if (status !== 1 || !payload.ok) {
      const errorMessage = payload?.error?.message || 'Unknown Postgres worker error';
      const code = payload?.error?.code ? ` [${payload.error.code}]` : '';
      throw new Error(`${errorMessage}${code}`);
    }

    return payload.result;
  }
}

export default function createPostgresCompatDb(databaseUrl) {
  return new PostgresCompatDb(databaseUrl);
}
