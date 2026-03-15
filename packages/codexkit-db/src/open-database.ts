import { DatabaseSync } from "node:sqlite";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { ensureRuntimePaths, type RuntimePaths } from "./runtime-paths.ts";

export function openRuntimeDatabase(paths: RuntimePaths): DatabaseSyncType {
  ensureRuntimePaths(paths);
  const database = new DatabaseSync(paths.databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}
