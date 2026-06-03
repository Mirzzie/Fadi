import "dotenv/config";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabaseClient } from "./client";

const { db, pool } = createDatabaseClient();

async function waitForDatabase(retries = 30) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

try {
  await waitForDatabase();
  await migrate(db, {
    migrationsFolder: "migrations",
  });
} finally {
  await pool.end();
}
