import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

/**
 * The handle Drizzle hands a `db.transaction(...)` callback. Derived from `Database`
 * rather than imported, so it tracks the schema automatically.
 */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * What a repository factory accepts: either the pool or an open transaction.
 *
 * This is what makes multi-step writes atomic. Several user-visible operations are
 * sequences of independent writes — completing a learning commitment inserts an
 * evidence item and then updates the commitment — and a failure between them left the
 * user with an orphaned record AND the ability to repeat the action, duplicating it.
 * Taking `DbOrTx` lets the caller compose those writes into one atomic unit without
 * every repository having to know about transactions.
 *
 * Note the deliberate exclusion: `Transaction` has no `.transaction()` method, so a
 * repository that opens its OWN transaction internally cannot accept this type — the
 * compiler enforces that rather than leaving it to reviewer memory.
 */
export type DbOrTx = Database | Transaction;

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
