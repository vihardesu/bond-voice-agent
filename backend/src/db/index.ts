import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const url = process.env.DB_FILE_NAME ?? "file:local.db";

const client = createClient({ url });

export const db = drizzle({ client });
