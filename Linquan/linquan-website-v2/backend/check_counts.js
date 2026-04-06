const { Client } = require('pg');

(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('Please set DATABASE_URL first');
    process.exit(2);
  }
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }});
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    for (const r of res.rows) {
      const t = r.table_name;
      try {
        const cnt = (await client.query(`SELECT COUNT(*)::int AS cnt FROM "${t}"`)).rows[0].cnt;
        console.log(`${t}: ${cnt}`);
      } catch (e) {
        console.log(`${t}: error (${e.message})`);
      }
    }
    await client.end();
  } catch (err) {
    console.error('Error:', err);
    try { await client.end(); } catch(_) {}
    process.exit(1);
  }
})();
