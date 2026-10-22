import { Pool, type PoolClient } from "pg";

const globalForPg = globalThis as unknown as { dukaanSaathiPool?: Pool };

export const pool = globalForPg.dukaanSaathiPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(process.env.NODE_ENV === "production" ? { ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } } : {})
});

if (process.env.NODE_ENV !== "production") globalForPg.dukaanSaathiPool = pool;

export async function withUserContext<T>(
  client: PoolClient,
  userId: string,
  action: () => Promise<T>
): Promise<T> {
  await client.query("select set_config('app.user_id', $1, true)", [userId]);
  return action();
}
