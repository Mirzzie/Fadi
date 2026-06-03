import { createDatabaseClient, type Database } from "@careeros/database";
import type pg from "pg";

type DatabaseClientState = {
  db: Database;
  pool: pg.Pool;
};

const globalForDatabase = globalThis as typeof globalThis & {
  careerosDatabase?: DatabaseClientState;
};

export function getDatabase(): Database {
  if (!globalForDatabase.careerosDatabase) {
    globalForDatabase.careerosDatabase = createDatabaseClient();
  }

  return globalForDatabase.careerosDatabase.db;
}
