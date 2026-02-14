import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDb, type AppDatabase } from "./client";

export function runMigrations(db: AppDatabase, migrationsFolder: string) {
  migrate(db, { migrationsFolder });
}

// Run directly if called as a script
if (import.meta.main) {
  const db = getDb();
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");
}
