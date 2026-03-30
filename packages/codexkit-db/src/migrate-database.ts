import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const MIGRATION_VERSION = "001-init-from-docs";
const SCHEMA_RELATIVE_PATH_CANDIDATES = [
  "../../../docs/codexkit-sqlite-schema.sql",
  "../../../../docs/codexkit-sqlite-schema.sql"
] as const;

function resolveSchemaPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  for (const relativePath of SCHEMA_RELATIVE_PATH_CANDIDATES) {
    const candidate = path.resolve(moduleDir, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const attempted = SCHEMA_RELATIVE_PATH_CANDIDATES.map((relativePath) => path.resolve(moduleDir, relativePath));
  throw new Error(`Unable to locate codexkit schema file. Checked: ${attempted.join(", ")}`);
}

const SCHEMA_PATH = resolveSchemaPath();

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
