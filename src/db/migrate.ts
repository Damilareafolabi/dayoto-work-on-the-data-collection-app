import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration() {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host || !database) {
    console.log('[MIGRATION NOTICE] SQL_HOST or SQL_DB_NAME not provided in environment.');
    console.log('[MIGRATION NOTICE] Server is using in-memory transactional persistence engine.');
    console.log('[MIGRATION NOTICE] To connect to PostgreSQL: configure SQL_HOST, SQL_USER, SQL_PASSWORD, and SQL_DB_NAME in .env.');
    return;
  }

  const pool = new Pool({
    host,
    user,
    password,
    database,
    port: Number(process.env.SQL_PORT) || 5432,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log(`[MIGRATION] Connecting to PostgreSQL at ${host}/${database}...`);
    const client = await pool.connect();
    console.log('[MIGRATION] Connected. Reading schema.sql...');

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[MIGRATION] Executing DDL statements...');
    await client.query(sql);

    console.log('[MIGRATION] Schema migration completed successfully!');
    client.release();
  } catch (err: any) {
    console.error('[MIGRATION ERROR]', err.message);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration();
}
