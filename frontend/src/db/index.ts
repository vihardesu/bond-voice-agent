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

export const db = drizzle(sqlite, { schema });

const migrationsFolder = path.join(process.cwd(), "drizzle");
if (fs.existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
}

export { schema };
