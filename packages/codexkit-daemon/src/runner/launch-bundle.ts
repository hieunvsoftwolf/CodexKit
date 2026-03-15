import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RuntimePaths } from "../../../codexkit-db/src/index.ts";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";
import type { OwnedPathPolicy } from "./path-policy.ts";
import { assertPathInsideRoot, normalizeOwnedPathPolicy } from "./path-policy.ts";

const BASELINE_ENV_ALLOWLIST = ["PATH", "HOME", "SHELL", "LANG", "TERM"] as const;

export interface LaunchBundleInput {
  workerId: string;
  runId: string;
  taskId: string;
  prompt: string;
  context: Record<string, unknown>;
  ownedPaths: OwnedPathPolicy;
  allowlistEnv?: string[];
}

export interface LaunchBundleFiles {
  bundleDir: string;
  promptPath: string;
  contextPath: string;
  ownedPathsPath: string;
  envPath: string;
  runtimeEnv: NodeJS.ProcessEnv;
}

function uniqueAllowlist(entries: string[]): string[] {
  return [...new Set(entries.map((entry) => entry.trim()).filter((entry) => /^[A-Z0-9_]+$/.test(entry)))];
}

export function buildWorkerEnvironment(
  inherited: NodeJS.ProcessEnv,
  input: Pick<LaunchBundleInput, "runId" | "workerId" | "taskId" | "allowlistEnv">
): { runtimeEnv: NodeJS.ProcessEnv; auditKeys: string[] } {
  const keys = uniqueAllowlist([...BASELINE_ENV_ALLOWLIST, ...(input.allowlistEnv ?? [])]);
  const runtimeEnv: NodeJS.ProcessEnv = {};
  for (const key of keys) {
    if (inherited[key] !== undefined) {
      runtimeEnv[key] = inherited[key];
    }
  }
  runtimeEnv.CODEXKIT_RUN_ID = input.runId;
  runtimeEnv.CODEXKIT_WORKER_ID = input.workerId;
  runtimeEnv.CODEXKIT_TASK_ID = input.taskId;
  return { runtimeEnv, auditKeys: [...keys, "CODEXKIT_RUN_ID", "CODEXKIT_WORKER_ID", "CODEXKIT_TASK_ID"] };
}

export function writeLaunchBundle(paths: RuntimePaths, input: LaunchBundleInput): LaunchBundleFiles {
  if (!input.prompt.trim()) {
    throw new CodexkitError("WORKER_PROMPT_REQUIRED", "worker prompt is required");
  }
  const bundleDir = path.join(paths.launchDir, input.workerId);
  assertPathInsideRoot(paths.runtimeDir, path.relative(paths.runtimeDir, bundleDir));
  mkdirSync(bundleDir, { recursive: true });
  const promptPath = path.join(bundleDir, "prompt.md");
  const contextPath = path.join(bundleDir, "context.json");
  const ownedPathsPath = path.join(bundleDir, "owned-paths.json");
  const envPath = path.join(bundleDir, "env.json");

  const normalizedPolicy = normalizeOwnedPathPolicy(input.ownedPaths);
  const { runtimeEnv, auditKeys } = buildWorkerEnvironment(process.env, input);
  runtimeEnv.CODEXKIT_OWNED_PATHS_FILE = ownedPathsPath;

  writeFileSync(promptPath, `${input.prompt.trim()}\n`, "utf8");
  writeFileSync(contextPath, `${JSON.stringify(input.context, null, 2)}\n`, "utf8");
  writeFileSync(ownedPathsPath, `${JSON.stringify(normalizedPolicy, null, 2)}\n`, "utf8");
  writeFileSync(
    envPath,
    `${JSON.stringify({ keys: auditKeys, redacted: true, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8"
  );

  return { bundleDir, promptPath, contextPath, ownedPathsPath, envPath, runtimeEnv };
}
