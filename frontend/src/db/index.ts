import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
const dbPath =
  process.env.DATABASE_URL?.replace(/^file:/, "") ??
  path.join(dataDir, "sqlite.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

const migrationsFolder = path.join(process.cwd(), "drizzle");
const isProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

// Skip migrations during `next build` page-data collection — multiple workers
// race on the same SQLite file and can fail with "table already exists".
if (fs.existsSync(migrationsFolder) && !isProductionBuild) {
  try {
    migrate(db, { migrationsFolder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }
}

export { schema };
