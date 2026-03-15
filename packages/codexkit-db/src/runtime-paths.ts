import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface RuntimePaths {
  rootDir: string;
  codexkitDir: string;
  stateDir: string;
  runtimeDir: string;
  worktreesDir: string;
  launchDir: string;
  controlDir: string;
  logsDir: string;
  artifactsDir: string;
  databasePath: string;
  daemonStatusPath: string;
  daemonLockPath: string;
}

export function resolveRepoRoot(rootDir = process.cwd()): string {
  const startingDir = path.resolve(rootDir);
  let currentDir = startingDir;
  while (true) {
    if (existsSync(path.join(currentDir, ".git"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startingDir;
    }
    currentDir = parentDir;
  }
}

export function resolveRuntimePaths(rootDir = process.cwd()): RuntimePaths {
  const resolvedRoot = resolveRepoRoot(rootDir);
  const codexkitDir = path.join(resolvedRoot, ".codexkit");
  const runtimeDir = path.join(codexkitDir, "runtime");
  const worktreesDir = path.join(runtimeDir, "worktrees");
  const launchDir = path.join(runtimeDir, "launch");
  const controlDir = path.join(runtimeDir, "control");
  const logsDir = path.join(runtimeDir, "logs");
  const artifactsDir = path.join(runtimeDir, "artifacts");
  const stateDir = path.join(codexkitDir, "state");
  return {
    rootDir: resolvedRoot,
    codexkitDir,
    stateDir,
    runtimeDir,
    worktreesDir,
    launchDir,
    controlDir,
    logsDir,
    artifactsDir,
    databasePath: path.join(stateDir, "runtime.sqlite"),
    daemonStatusPath: path.join(stateDir, "daemon.json"),
    daemonLockPath: path.join(stateDir, "daemon.lock")
  };
}

export function ensureRuntimePaths(paths: RuntimePaths): void {
  mkdirSync(paths.stateDir, { recursive: true });
  mkdirSync(paths.worktreesDir, { recursive: true });
  mkdirSync(paths.launchDir, { recursive: true });
  mkdirSync(paths.controlDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.artifactsDir, { recursive: true });
}
