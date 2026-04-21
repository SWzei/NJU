import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_DB_PATH = path.resolve(__dirname, '../../cache/imslp_metadata.db');

let db = null;

function getDb() {
  if (!db) {
    try {
      db = new Database(META_DB_PATH, { readonly: true });
    } catch (err) {
      // Metadata DB is optional; return null if missing
      return null;
    }
  }
  return db;
}

const PERIOD_MAP = {
  1: 'Baroque',
  2: 'Classical',
  3: 'Romantic',
  4: 'Modern',
};

const INSTRUMENT_COLUMNS = [
  'piano',
  'violin',
  'flute',
  'clarinet',
  'oboe',
  'trumpet',
  'horn',
  'cello',
  'viola',
  'guitar',
  'contrabass',
  'string',
  'wind',
  'organ',
];

/**
 * Fetch metadata for a specific work by its full title.
 * The IMSLP API title includes the composer suffix, e.g.
 * "Piano Sonata No.14, Op.27 No.2 (Beethoven, Ludwig van)"
 */
export function getWorkMetadata(title) {
  const conn = getDb();
  if (!conn || !title) return null;

  const row = conn
    .prepare(
      `SELECT w.FK_Type, t.type, w.Mode, w.Tone,
        w.piano, w.violin, w.flute, w.clarinet, w.oboe,
        w.trumpet, w.horn, w.cello, w.viola, w.guitar,
        w.contrabass, w.string, w.wind, w.organ
      FROM works AS w
      LEFT JOIN Types AS t ON w.FK_Type = t.PK_type
      WHERE w.title = ?`
    )
    .get(title);

  if (!row) return null;

  const instruments = [];
  for (const col of INSTRUMENT_COLUMNS) {
    if (row[col]) {
      instruments.push(col);
    }
  }

  return {
    type: row.type || null,
    mode: row.Mode || null,
    tone: row.Tone || null,
    instruments,
  };
}

/**
 * Fetch metadata for a composer by name, e.g. "Beethoven, Ludwig van".
 */
export function getComposerMetadata(name) {
  const conn = getDb();
  if (!conn || !name) return null;

  const composer = conn
    .prepare('SELECT PK_composer, name, FK_period FROM composers WHERE name = ?')
    .get(name);

  if (!composer) return null;

  const period = PERIOD_MAP[composer.FK_period] || null;

  const typeRows = conn
    .prepare(
      `SELECT t.type, COUNT(*) AS count
       FROM works AS w
       LEFT JOIN Types AS t ON w.FK_Type = t.PK_type
       WHERE w.FK_composer = ? AND t.type IS NOT NULL
       GROUP BY w.FK_Type
       ORDER BY count DESC`
    )
    .all(composer.PK_composer);

  const totalWorks = conn
    .prepare('SELECT COUNT(*) AS count FROM works WHERE FK_composer = ?')
    .get(composer.PK_composer).count;

  const instrumentSums = conn
    .prepare(
      `SELECT
        SUM(piano) AS piano, SUM(violin) AS violin,
        SUM(flute) AS flute, SUM(clarinet) AS clarinet,
        SUM(oboe) AS oboe, SUM(trumpet) AS trumpet,
        SUM(horn) AS horn, SUM(cello) AS cello,
        SUM(viola) AS viola, SUM(guitar) AS guitar,
        SUM(contrabass) AS contrabass, SUM(string) AS string,
        SUM(wind) AS wind, SUM(organ) AS organ
      FROM works WHERE FK_composer = ?`
    )
    .get(composer.PK_composer);

  const instrumentDistribution = [];
  for (const col of INSTRUMENT_COLUMNS) {
    const val = instrumentSums?.[col];
    if (val && val > 0) {
      instrumentDistribution.push({ instrument: col, count: val });
    }
  }
  instrumentDistribution.sort((a, b) => b.count - a.count);

  return {
    period,
    totalWorks,
    typeDistribution: typeRows.map((r) => ({ type: r.type, count: r.count })),
    instrumentDistribution,
  };
}

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#f59e0b', '#84cc16', '#10b981',
];

function extractComposerFromTitle(title) {
  const match = title.match(/\(([^,)]+,\s*[^)]+)\)$/);
  if (match) {
    return {
      composer: match[1].trim(),
      worktitle: title.slice(0, match.index).trim(),
    };
  }
  return { composer: '', worktitle: title };
}

/**
 * Search works from the metadata database with optional filters.
 * Returns items shaped like IMSLP proxy results but with metadata attached.
 */
export function searchWorksMeta({ title, composer, period, instrument, type, limit = 50 }) {
  const conn = getDb();
  if (!conn) return [];

  const conditions = [];
  const params = [];

  if (title) {
    conditions.push('w.title LIKE ?');
    params.push(`%${title}%`);
  }
  if (composer) {
    conditions.push('c.name LIKE ?');
    params.push(`%${composer}%`);
  }
  if (period) {
    conditions.push('c.FK_period = ?');
    params.push(period);
  }
  if (type) {
    conditions.push('t.type = ?');
    params.push(type);
  }
  if (instrument && INSTRUMENT_COLUMNS.includes(instrument)) {
    conditions.push(`w.${instrument} > 0`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT w.title, c.name AS composerName, t.type, w.Mode, w.Tone,
      w.piano, w.violin, w.flute, w.clarinet, w.oboe,
      w.trumpet, w.horn, w.cello, w.viola, w.guitar,
      w.contrabass, w.string, w.wind, w.organ
    FROM works AS w
    LEFT JOIN composers AS c ON w.FK_composer = c.PK_composer
    LEFT JOIN Types AS t ON w.FK_Type = t.PK_type
    ${whereClause}
    ORDER BY w.PK_work DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = conn.prepare(sql).all(...params);

  return rows.map((row) => {
    const instruments = [];
    for (const col of INSTRUMENT_COLUMNS) {
      if (row[col]) {
        instruments.push(col);
      }
    }

    const { composer: composerName, worktitle } = extractComposerFromTitle(row.title);

    return {
      id: row.title,
      permlink: row.title.replace(/ /g, '_'),
      intvals: {
        worktitle,
        composer: composerName || row.composerName || '',
      },
      metadata: {
        type: row.type || null,
        mode: row.Mode || null,
        tone: row.Tone || null,
        instruments,
      },
    };
  });
}

/**
 * Search composers from the metadata database with optional filters.
 * Ordered by total works descending.
 */
export function searchComposersMeta({ name, period, instrument, type, limit = 50 }) {
  const conn = getDb();
  if (!conn) return [];

  const conditions = [];
  const params = [];

  if (name) {
    conditions.push('c.name LIKE ?');
    params.push(`%${name}%`);
  }
  if (period) {
    conditions.push('c.FK_period = ?');
    params.push(period);
  }
  if (type) {
    conditions.push('t.type = ?');
    params.push(type);
  }
  if (instrument && INSTRUMENT_COLUMNS.includes(instrument)) {
    conditions.push(`w.${instrument} > 0`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT c.name, c.FK_period, COUNT(*) AS totalWorks
    FROM composers AS c
    LEFT JOIN works AS w ON c.PK_composer = w.FK_composer
    LEFT JOIN Types AS t ON w.FK_Type = t.PK_type
    ${whereClause}
    GROUP BY c.PK_composer
    ORDER BY totalWorks DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = conn.prepare(sql).all(...params);

  return rows.map((row) => ({
    id: row.name,
    permlink: row.name.replace(/ /g, '_'),
    intvals: {
      name: row.name,
    },
    metadata: {
      period: PERIOD_MAP[row.FK_period] || null,
      totalWorks: row.totalWorks,
    },
  }));
}

/**
 * Return available filter options for the frontend.
 */
export function getFilterOptions() {
  const conn = getDb();
  if (!conn) return null;

  const periods = [
    { value: '1', label: 'Baroque' },
    { value: '2', label: 'Classical' },
    { value: '3', label: 'Romantic' },
    { value: '4', label: 'Modern' },
  ];

  const typeRows = conn.prepare('SELECT type FROM Types ORDER BY type').all();
  const types = typeRows.map((r) => r.type).filter(Boolean);

  return {
    periods,
    instruments: INSTRUMENT_COLUMNS,
    types,
  };
}

/**
 * Return composer type distribution formatted for a chart.
 */
export function getComposerTypeDistributionForChart(name) {
  const metadata = getComposerMetadata(name);
  if (!metadata) return null;

  const distribution = metadata.typeDistribution.filter((d) => d.type !== 'Other' && d.type !== 'other');
  if (!distribution || distribution.length === 0) return null;

  const labels = distribution.map((d) => d.type);
  const values = distribution.map((d) => d.count);
  const colors = distribution.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  return { labels, values, colors };
}

/**
 * Return composer instrument distribution formatted for a chart.
 */
export function getComposerInstrumentDistributionForChart(name) {
  const metadata = getComposerMetadata(name);
  if (!metadata) return null;

  const distribution = metadata.instrumentDistribution;
  if (!distribution || distribution.length === 0) return null;

  const labels = distribution.map((d) => d.instrument);
  const values = distribution.map((d) => d.count);
  const colors = distribution.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  return { labels, values, colors };
}
