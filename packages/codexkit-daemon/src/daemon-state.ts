import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import type { RuntimePaths } from "../../codexkit-db/src/index.ts";

interface DaemonLock {
  pid: number;
  ownerId: string | null;
}

export interface DaemonStatus {
  pid: number;
  rootDir: string;
  databasePath: string;
  ready: boolean;
  mode: "foreground" | "oneshot";
  startedAt: string;
  lastCycleAt: string;
  cursor: number;
}

function probePid(pid: number): "live" | "missing" {
  try {
    process.kill(pid, 0);
    return "live";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ESRCH" ? "missing" : "live";
  }
}

export function readDaemonStatus(paths: RuntimePaths): (DaemonStatus & { live: boolean }) | null {
  if (!existsSync(paths.daemonStatusPath)) {
    return null;
  }
  let status: DaemonStatus;
  try {
    status = JSON.parse(readFileSync(paths.daemonStatusPath, "utf8")) as DaemonStatus;
  } catch {
    return null;
  }
  return { ...status, live: probePid(status.pid) === "live" };
}

export function writeDaemonStatus(paths: RuntimePaths, status: DaemonStatus): void {
  const tempPath = `${paths.daemonStatusPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  renameSync(tempPath, paths.daemonStatusPath);
}

function readDaemonLock(paths: RuntimePaths): DaemonLock | null {
  if (!existsSync(paths.daemonLockPath)) {
    return null;
  }

  const lock = JSON.parse(readFileSync(paths.daemonLockPath, "utf8")) as { pid: number; ownerId?: string };
  return { pid: lock.pid, ownerId: lock.ownerId ?? null };
}

export function acquireDaemonLock(paths: RuntimePaths, ownerId: string): void {
  const current = readDaemonLock(paths);
  if (current) {
    if (probePid(current.pid) === "live") {
      throw new Error(`daemon already running with pid ${current.pid}`);
    }
    unlinkSync(paths.daemonLockPath);
  }

  writeFileSync(paths.daemonLockPath, `${JSON.stringify({ pid: process.pid, ownerId })}\n`, { encoding: "utf8", flag: "wx" });
}

export function releaseDaemonLock(paths: RuntimePaths, ownerId: string): boolean {
  const current = readDaemonLock(paths);
  if (!current || current.ownerId !== ownerId) {
    return false;
  }
  unlinkSync(paths.daemonLockPath);
  return true;
}
