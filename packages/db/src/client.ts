import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

let db: ReturnType<typeof createDb> | null = null;

function createDb(dbPath?: string) {
  const path = dbPath || process.env.DATABASE_PATH || "./data/assistant.db";
  const sqlite = new Database(path, { create: true });

  // Enable WAL mode for better concurrent read/write performance
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

export function getDb(dbPath?: string) {
  if (!db) {
    db = createDb(dbPath);
  }
  return db;
}

export type AppDatabase = ReturnType<typeof getDb>;
