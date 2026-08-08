import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/libsql/migrator";

import { db } from "./index.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
  console.log(`Database migrations applied from ${migrationsFolder}`);
}
