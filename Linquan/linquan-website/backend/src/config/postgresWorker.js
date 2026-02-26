import { parentPort, workerData } from 'worker_threads';
import pg from 'pg';

const { Client, types } = pg;
types.setTypeParser(20, (value) => Number(value)); // int8
types.setTypeParser(21, (value) => Number(value)); // int2
types.setTypeParser(23, (value) => Number(value)); // int4

const encoder = new TextEncoder();

const client = new Client({
  connectionString: workerData.databaseUrl
});

let initError = null;
let queue = Promise.resolve();

function writeResponse(sab, payload, statusCode) {
  const header = new Int32Array(sab, 0, 2);
  const body = new Uint8Array(sab, 8);

  const raw = encoder.encode(JSON.stringify(payload));
  const length = raw.length;
  if (length > body.length) {
    const overflowPayload = encoder.encode(
      JSON.stringify({
        ok: false,
        error: {
          message: `Worker response too large (${length} bytes > ${body.length} bytes buffer).`
        }
      })
    );
    body.fill(0);
    body.set(overflowPayload.subarray(0, body.length), 0);
    Atomics.store(header, 1, Math.min(overflowPayload.length, body.length));
    Atomics.store(header, 0, 2);
    Atomics.notify(header, 0, 1);
    return;
  }

  body.fill(0);
  body.set(raw, 0);

  Atomics.store(header, 1, length);
  Atomics.store(header, 0, statusCode);
  Atomics.notify(header, 0, 1);
}

async function executeQuery({ sql, params, mode }) {
  if (mode === 'exec') {
    await client.query(sql);
    return { rowCount: 0, rows: [] };
  }

  const result = await client.query(sql, Array.isArray(params) ? params : []);
  return {
    rowCount: Number(result.rowCount || 0),
    rows: result.rows || []
  };
}

await client.connect().catch((err) => {
  initError = err;
});

parentPort.on('message', (message) => {
  queue = queue
    .then(async () => {
      const { sab, sql, params, mode } = message;
      if (!sab) {
        return;
      }

      if (initError) {
        writeResponse(
          sab,
          {
            ok: false,
            error: {
              message: initError.message
            }
          },
          2
        );
        return;
      }

      try {
        const result = await executeQuery({ sql, params, mode });
        writeResponse(sab, { ok: true, result }, 1);
      } catch (err) {
        writeResponse(
          sab,
          {
            ok: false,
            error: {
              message: err.message,
              code: err.code || null,
              detail: err.detail || null
            }
          },
          2
        );
      }
    })
    .catch(() => {
      // Keep queue alive for subsequent requests.
    });
});

process.on('beforeExit', async () => {
  try {
    await client.end();
  } catch (err) {
    // Ignore shutdown errors.
  }
});
