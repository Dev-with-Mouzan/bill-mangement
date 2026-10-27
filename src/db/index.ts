import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: ReturnType<typeof drizzle>;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is missing. Please set DATABASE_URL in your Vercel Environment Variables or .env file."
    );
  }

  const poolConfig: PoolConfig = {
    connectionString: databaseUrl,
    max: process.env.PG_MAX_CONNECTIONS ? Number(process.env.PG_MAX_CONNECTIONS) : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Support SSL for remote cloud databases (Neon, Supabase, AWS RDS, etc.)
  if (
    process.env.NODE_ENV === "production" ||
    databaseUrl.includes("sslmode=require") ||
    databaseUrl.includes("supabase.co") ||
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("vercel-storage.com")
  ) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  return new Pool(poolConfig);
}

export function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = createPool();
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

export function getDb() {
  if (!globalForDb.__arenaNextJsDrizzleDb) {
    globalForDb.__arenaNextJsDrizzleDb = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsDrizzleDb;
}

// Proxies allow importing `db` and `pool` across routes without failing during Next.js build-time analysis
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const active = getPool();
    const value = (active as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});

export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    const active = getDb();
    const value = (active as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});
