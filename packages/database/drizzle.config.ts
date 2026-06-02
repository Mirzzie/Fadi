import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://careeros:careeros_dev_password@localhost:5433/careeros_dev",
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
