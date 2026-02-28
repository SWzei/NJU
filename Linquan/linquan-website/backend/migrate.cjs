const Database = require('better-sqlite3');
const { Client } = require('pg');

const sqlite = new Database('../database/linquan.db', { readonly: true });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to Neon");

  // 获取所有表
  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all().map(t => t.name);

  console.log("Tables:", tables);

  for (const table of tables) {
    console.log(`\nMigrating ${table}...`);

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);

    // 创建表（全部 TEXT，最安全）
    const colsSQL = columns.map(c => `"${c}" TEXT`).join(', ');
    await client.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colsSQL});`);

    for (const row of rows) {
      const vals = columns.map(c => row[c]);
      const params = columns.map((_, i) => `$${i+1}`).join(',');

      await client.query(
        `INSERT INTO "${table}" (${columns.map(c=>`"${c}"`).join(',')}) VALUES (${params})`,
        vals
      );
    }

    console.log(`${table}: ${rows.length} rows migrated`);
  }

  console.log("\nDONE");
  await client.end();
}

main();
