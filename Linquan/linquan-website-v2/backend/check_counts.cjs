const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
  ];

  const envFile = candidates.find((file) => fs.existsSync(file));
  dotenv.config(envFile ? { path: envFile, override: true } : undefined);
}

function normalizeDatabaseUrl(raw) {
  if (!raw) {
    return "";
  }
  return String(raw)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function isPlaceholderUrl(url) {
  return !url || /REAL_|<|>/.test(url);
}

(async () => {
  loadEnvFile();

  const DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (isPlaceholderUrl(DATABASE_URL)) {
    console.error(
      [
        "DATABASE_URL is missing or still placeholder text.",
        "Please use the full Neon connection string, for example:",
        "postgresql://user:password@host/dbname?sslmode=require",
      ].join("\n"),
    );
    process.exit(2);
  }

  try {
    const parsed = new URL(DATABASE_URL);
    // eslint-disable-next-line no-console
    console.log(
      `Checking Neon DB: host=${parsed.hostname} db=${parsed.pathname.replace(/^\//, "")}`,
    );
  } catch (err) {
    console.error("DATABASE_URL format is invalid:", err.message);
    process.exit(2);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    for (const r of res.rows) {
      const t = r.table_name;
      try {
        const cnt = (
          await client.query(`SELECT COUNT(*)::int AS cnt FROM "${t}"`)
        ).rows[0].cnt;
        console.log(`${t}: ${cnt}`);
      } catch (e) {
        console.log(`${t}: error (${e.message})`);
      }
    }
    await client.end();
  } catch (err) {
    console.error("Error:", err);
    try {
      await client.end();
    } catch (_) {
      // ignore close error
    }
    process.exit(1);
  }
})();
