import { resolveRuntimePaths, type RuntimePaths } from "../../codexkit-db/src/index.ts";

export interface RuntimeConfig {
  paths: RuntimePaths;
  sweepIntervalMs: number;
  workerStaleMs: number;
  eventBatchSize: number;
}

export function loadRuntimeConfig(rootDir = process.cwd()): RuntimeConfig {
  return {
    paths: resolveRuntimePaths(rootDir),
    sweepIntervalMs: Number(process.env.CODEXKIT_SWEEP_INTERVAL_MS ?? 5_000),
    workerStaleMs: Number(process.env.CODEXKIT_WORKER_STALE_MS ?? 60_000),
    eventBatchSize: Number(process.env.CODEXKIT_EVENT_BATCH_SIZE ?? 100)
  };
}
