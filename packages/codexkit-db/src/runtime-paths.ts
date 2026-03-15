import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface RuntimePaths {
  rootDir: string;
  codexkitDir: string;
  stateDir: string;
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
  const stateDir = path.join(codexkitDir, "state");
  return {
    rootDir: resolvedRoot,
    codexkitDir,
    stateDir,
    databasePath: path.join(stateDir, "runtime.sqlite"),
    daemonStatusPath: path.join(stateDir, "daemon.json"),
    daemonLockPath: path.join(stateDir, "daemon.lock")
  };
}

export function ensureRuntimePaths(paths: RuntimePaths): void {
  mkdirSync(paths.stateDir, { recursive: true });
}
