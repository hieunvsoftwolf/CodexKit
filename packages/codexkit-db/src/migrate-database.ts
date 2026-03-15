import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const MIGRATION_VERSION = "001-init-from-docs";
const SCHEMA_PATH = new URL("../../../docs/codexkit-sqlite-schema.sql", import.meta.url);

function hasTable(database: DatabaseSync, tableName: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { present?: number } | undefined;
  return row?.present === 1;
}

export function migrateDatabase(database: DatabaseSync): void {
  const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

  if (!hasTable(database, "schema_migrations")) {
    database.exec(schemaSql);
    database.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)").run(MIGRATION_VERSION);
    return;
  }

  const applied = database
    .prepare("SELECT version FROM schema_migrations WHERE version = ?")
    .get(MIGRATION_VERSION) as { version?: string } | undefined;
  if (applied?.version === MIGRATION_VERSION) {
    return;
  }

  database.exec(schemaSql);
  database.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)").run(MIGRATION_VERSION);
}
