import type { DatabaseSync } from "node:sqlite";
import type { SettingsRepository } from "../../../codexkit-core/src/index.ts";

export class SettingsRepositorySqlite implements SettingsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  get(key: string): string | null {
    const row = this.database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.database
      .prepare(
        `
          INSERT INTO settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `
      )
      .run(key, value);
  }
}
