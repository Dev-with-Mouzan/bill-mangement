const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_PcLi28ZldrNu@ep-curly-dawn-b8wxattl.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require';

const cleanUrl = connectionString
  .replace(/[?&]channel_binding=[^&]+/g, (m) => (m.startsWith('?') ? '?' : ''))
  .replace(/\?&/, '?')
  .replace(/\?$/, '');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Connecting to Neon database...');
  const client = await pool.connect();
  console.log('Connected! Creating tables if they do not exist...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference text NOT NULL,
      payment_amount numeric(14, 2) NOT NULL,
      payment_date date NOT NULL,
      source text NOT NULL DEFAULT 'manual',
      raw_barcode text,
      billing_month text,
      due_date date,
      original_amount numeric(14, 2),
      late_amount numeric(14, 2),
      request_key text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_unique ON payments (reference);
    CREATE UNIQUE INDEX IF NOT EXISTS payments_request_key_unique ON payments (request_key);

    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value text NOT NULL
    );
  `);
  console.log('Schema created successfully!');
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Public tables in your Neon database:', res.rows.map((r) => r.table_name));
  client.release();
  await pool.end();
}

run().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

