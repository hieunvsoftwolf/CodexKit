import type { DatabaseSync } from "node:sqlite";
import type { RuntimeStore } from "../../codexkit-core/src/index.ts";
import { ApprovalsRepositorySqlite } from "./repositories/approvals-repository.ts";
import { ArtifactsRepositorySqlite } from "./repositories/artifacts-repository.ts";
import { ClaimsRepositorySqlite } from "./repositories/claims-repository.ts";
import { EventsRepositorySqlite } from "./repositories/events-repository.ts";
import { RunsRepositorySqlite } from "./repositories/runs-repository.ts";
import { SettingsRepositorySqlite } from "./repositories/settings-repository.ts";
import { TasksRepositorySqlite } from "./repositories/tasks-repository.ts";
import { WorkersRepositorySqlite } from "./repositories/workers-repository.ts";
import { inTransaction } from "./sqlite-helpers.ts";

export function createRuntimeStore(database: DatabaseSync): RuntimeStore {
  return {
    transaction<T>(callback: () => T): T {
      return inTransaction(database, callback);
    },
    settings: new SettingsRepositorySqlite(database),
    runs: new RunsRepositorySqlite(database),
    tasks: new TasksRepositorySqlite(database),
    workers: new WorkersRepositorySqlite(database),
    claims: new ClaimsRepositorySqlite(database),
    approvals: new ApprovalsRepositorySqlite(database),
    artifacts: new ArtifactsRepositorySqlite(database),
    events: new EventsRepositorySqlite(database)
  };
}
