// Opens the real SQLite file with better-sqlite3 (server only). Seeds demo content on first run.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate, type Db } from "./db.ts";
import { seedContent } from "./content/cbse10-maths.ts";

export function openAppDb(path = process.env.DATABASE_PATH ?? "./data/learnpath.db"): Db {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path) as unknown as Db;
  (db as any).pragma?.("journal_mode = WAL");
  migrate(db);
  const n = db.prepare("SELECT COUNT(*) AS n FROM skills").get().n;
  if (n === 0) seedContent(db);
  return db;
}
