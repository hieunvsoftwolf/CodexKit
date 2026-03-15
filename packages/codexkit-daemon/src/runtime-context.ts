import {
  ApprovalService,
  EventService,
  RunService,
  TaskService,
  WorkerService,
  ClaimService,
  type RuntimeClock
} from "../../codexkit-core/src/index.ts";
import { createRuntimeStore, migrateDatabase, openRuntimeDatabase } from "../../codexkit-db/src/index.ts";
import type { RuntimeConfig } from "./runtime-config.ts";

export function createSystemClock(): RuntimeClock {
  return { now: () => new Date() };
}

export function openRuntimeContext(config: RuntimeConfig, clock: RuntimeClock = createSystemClock()) {
  const database = openRuntimeDatabase(config.paths);
  migrateDatabase(database);
  const store = createRuntimeStore(database);
  return {
    config,
    clock,
    database,
    store,
    runService: new RunService(store, clock),
    taskService: new TaskService(store, clock),
    workerService: new WorkerService(store, clock),
    claimService: new ClaimService(store, clock),
    approvalService: new ApprovalService(store, clock),
    eventService: new EventService(store),
    close(): void {
      database.close();
    }
  };
}

export type RuntimeContext = ReturnType<typeof openRuntimeContext>;
