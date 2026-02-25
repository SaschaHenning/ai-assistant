import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

let db: ReturnType<typeof createDb> | null = null;
let sqliteInstance: Database | null = null;

function createDb(dbPath?: string) {
  const path = dbPath || process.env.DATABASE_PATH || "./data/assistant.db";
  const sqlite = new Database(path, { create: true });
  sqliteInstance = sqlite;

  // Enable WAL mode for better concurrent read/write performance
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

export function getDb(dbPath?: string) {
  if (!db) {
    db = createDb(dbPath);
  }
  return db;
}

/** Get the raw SQLite database instance for operations that need direct access (e.g., FTS5) */
export function getSqlite(): Database | null {
  return sqliteInstance;
}

/** Close the database connection (call on shutdown for proper WAL checkpoint) */
export function closeDb() {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    db = null;
  }
}

export type AppDatabase = ReturnType<typeof getDb>;
