import type { ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import type { OwnedPathPolicy } from "./path-policy.ts";
import type { WorkerIsolationBaseline } from "./worker-isolation-guard.ts";
import type { LaunchStateEntry } from "./artifact-capture.ts";

export interface SpawnWorkerInput {
  runId: string;
  taskId: string;
  role: string;
  displayName: string;
  prompt: string;
  context: Record<string, unknown>;
  ownedPaths: OwnedPathPolicy;
  command?: string[];
  allowlistEnv?: string[];
  snapshotRef?: string;
}

export interface WorkerRuntimeResult {
  workerId: string;
  state: "stopped" | "failed";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  violations: string[];
  artifactDir: string;
}

export interface SpawnWorkerResult {
  workerId: string;
  pid: number;
  launchStartedAt: number;
  spawnedAt: number;
}

export interface ActiveWorker {
  runId: string;
  taskId: string;
  workerId: string;
  child: ChildProcess;
  worktreePath: string;
  ownedPaths: OwnedPathPolicy;
  artifactDir: string;
  logPaths: { stdout: string; stderr: string; supervisor: string };
  stdoutStream: WriteStream;
  stderrStream: WriteStream;
  isolationBaseline: WorkerIsolationBaseline;
  launchState: Record<string, LaunchStateEntry>;
  heartbeat: NodeJS.Timeout;
  finalized: boolean;
  shutdownRequested: boolean;
  forcedShutdown: boolean;
  finalizePromise: Promise<WorkerRuntimeResult>;
  resolve: (value: WorkerRuntimeResult) => void;
}
