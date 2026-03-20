import {
  ApprovalService,
  ArtifactService,
  EventService,
  MessageService,
  RunService,
  TaskService,
  TeamService,
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
  const messageService = new MessageService(store, clock);
  return {
    config,
    clock,
    database,
    store,
    runService: new RunService(store, clock),
    teamService: new TeamService(store, clock),
    taskService: new TaskService(store, clock),
    workerService: new WorkerService(store, clock),
    claimService: new ClaimService(store, clock),
    messageService,
    approvalService: new ApprovalService(store, clock),
    artifactService: new ArtifactService(store, clock),
    eventService: new EventService(store),
    close(): void {
      database.close();
    }
  };
}

export type RuntimeContext = ReturnType<typeof openRuntimeContext>;
