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
