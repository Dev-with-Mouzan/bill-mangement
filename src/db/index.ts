import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: ReturnType<typeof drizzle>;
};

function cleanConnectionString(rawUrl: string): string {
  // Remove channel_binding parameter as node-postgres doesn't support SCRAM channel binding
  return rawUrl
    .replace(/[?&]channel_binding=[^&]+/g, (match) => (match.startsWith("?") ? "?" : ""))
    .replace(/\?&/, "?")
    .replace(/\?$/, "");
}

function createPool(): Pool {
  const rawUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL or POSTGRES_URL is missing. Please set DATABASE_URL in your Vercel Environment Variables or .env file."
    );
  }

  const databaseUrl = cleanConnectionString(rawUrl);

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
