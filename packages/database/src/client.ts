import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

const DEFAULT_LOCAL_DATABASE_URL = "postgres://careeros:careeros@localhost:5433/careeros";

export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL): {
  db: Database;
  pool: pg.Pool;
} {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a PostgreSQL database client.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}

export async function withDatabase<T>(
  callback: (db: Database) => Promise<T>,
  databaseUrl = process.env.DATABASE_URL
): Promise<T> {
  const { db, pool } = createDatabaseClient(databaseUrl);

  try {
    return await callback(db);
  } finally {
    await pool.end();
  }
}
