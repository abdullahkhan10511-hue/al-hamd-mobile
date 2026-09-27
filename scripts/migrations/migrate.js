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

async function runMigration() {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME;

  console.log('====================================================');
  console.log(' AL-HAMD MOBILE ACCESSORIES - DATABASE SCHEMA RUNNER');
  console.log('====================================================\n');

  if (!host || !user || !database) {
    console.error('ERROR: Missing required database environment variables:');
    if (!host) console.error('  - DB_HOST');
    if (!user) console.error('  - DB_USER');
    if (!database) console.error('  - DB_NAME');
    console.error('\nPlease configure your .env file with valid MySQL credentials.');
    process.exit(1);
  }

  console.log(`Connecting to MySQL host: ${host}:${port} as user "${user}"...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
    });
    console.log(`Connected successfully to database "${database}".\n`);
  } catch (err) {
    console.error(`ERROR: Failed to connect to MySQL database "${database}":`, err.message);
    console.error('\nEnsure:');
    console.error('1. MySQL server is running.');
    console.error(`2. Database "${database}" exists (or create it with "CREATE DATABASE ${database};").`);
    console.error('3. User credentials and network/firewall permissions are correct.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`ERROR: Schema file not found at ${schemaPath}`);
    await connection.end();
    process.exit(1);
  }

  console.log(`Reading SQL schema from ${schemaPath}...`);
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('Executing database schema migrations...');
    await connection.query(sql);
    console.log('All schema tables and indexes created/verified successfully!\n');

    // Verify created tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`Verified ${tableNames.length} tables in database:`);
    tableNames.forEach((t) => console.log(`  [OK] ${t}`));

    console.log('\n====================================================');
    console.log(' Migration completed successfully!');
    console.log(' Next step: Run "node scripts/migrations/import-data.js"');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Migration failed during SQL execution:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration().catch((err) => {
  console.error('Unexpected migration error:', err);
  process.exit(1);
});
