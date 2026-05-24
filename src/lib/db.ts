import { Pool, PoolConfig } from 'pg';
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:postgres@localhost:5432/yanxue_cost`,
  max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, ssl: false,
};
const pool = new Pool(poolConfig);
pool.on('error', (err: Error) => { console.error('Unexpected error on idle client', err); });
export async function getClient() { return pool.connect(); }
export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) { console.log('Slow query:', { text, duration, rows: res.rowCount }); }
  return res;
}
export async function transaction<T>(callback: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
