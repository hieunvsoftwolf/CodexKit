import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export function inTransaction<T>(database: DatabaseSync, callback: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function buildAssignments<T extends object>(
  patch: Partial<T>,
  columnMap: Record<string, string>
): { sql: string; values: SQLInputValue[] } {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  const sql = entries.map(([key]) => `${columnMap[key] ?? key} = ?`).join(", ");
  const values = entries.map(([, value]) => value as SQLInputValue);
  return { sql, values };
}
