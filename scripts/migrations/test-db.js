const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function testDatabase() {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME;

  console.log('====================================================');
  console.log(' AL-HAMD MOBILE ACCESSORIES - DATABASE HEALTH CHECK');
  console.log('====================================================\n');

  if (!host || !user || !database) {
    console.log('[!] Database environment variables are NOT yet configured in .env:');
    console.log(`    DB_HOST: ${host || '(not set)'}`);
    console.log(`    DB_USER: ${user || '(not set)'}`);
    console.log(`    DB_NAME: ${database || '(not set)'}`);
    console.log('\nTo configure, copy .env.example to .env and fill in your MySQL credentials.');
    return;
  }

  console.log(`Connecting to ${user}@${host}:${port}/${database}...`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });
    console.log('[SUCCESS] MySQL Connection established!\n');
  } catch (err) {
    console.error('[ERROR] Could not connect to MySQL:', err.message);
    return;
  }

  try {
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`Database "${database}" contains ${tableNames.length} tables:\n`);

    console.log('Table Name                  | Record Count');
    console.log('----------------------------|-------------');
    for (const t of tableNames) {
      try {
        const [countRes] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
        const count = countRes[0].c;
        console.log(`${t.padEnd(27, ' ')} | ${String(count).padStart(12, ' ')}`);
      } catch {
        console.log(`${t.padEnd(27, ' ')} |  [Error reading count]`);
      }
    }
    console.log('----------------------------|-------------\n');
    console.log('[SUCCESS] MySQL Database is healthy and operational.\n');
  } catch (err) {
    console.error('[ERROR] Failed reading database schema:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

testDatabase().catch((err) => {
  console.error('Test DB error:', err);
});
