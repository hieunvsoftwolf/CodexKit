import { createStableId } from "../../codexkit-core/src/index.ts";
import { releaseDaemonLock, writeDaemonStatus, type DaemonStatus, acquireDaemonLock } from "./daemon-state.ts";
import { runReconciliationPass } from "./runtime-kernel.ts";
import type { RuntimeContext } from "./runtime-context.ts";

export class RuntimeDaemon {
  private readonly context: RuntimeContext;
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly startedAt: string;
  private readonly lockOwnerId = createStableId("daemon_lock");
  private lockHeld = false;

  constructor(context: RuntimeContext) {
    this.context = context;
    this.startedAt = context.clock.now().toISOString();
  }

  startForeground(): Promise<DaemonStatus> {
    this.acquireLock();
    try {
      const cleanup = () => this.stop();
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      this.runCycle("foreground");
      this.intervalHandle = setInterval(() => this.runCycle("foreground"), this.context.config.sweepIntervalMs);
      return new Promise((resolve) => {
        const poll = setInterval(() => {
          const status = this.currentStatus("foreground");
          if (!this.intervalHandle) {
            clearInterval(poll);
            resolve(status);
          }
        }, 200);
      });
    } catch (error) {
      this.releaseLock();
      this.context.close();
      throw error;
    }
  }

  runOnce(): DaemonStatus {
    this.acquireLock();
    try {
      this.runCycle("oneshot");
      return this.currentStatus("oneshot");
    } finally {
      this.releaseLock();
      this.context.close();
    }
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.releaseLock();
    this.context.close();
  }

  private runCycle(mode: DaemonStatus["mode"]): void {
    const cycle = runReconciliationPass(this.context);
    writeDaemonStatus(this.context.config.paths, {
      ...this.currentStatus(mode),
      lastCycleAt: this.context.clock.now().toISOString(),
      cursor: cycle.cursor
    });
  }

  private currentStatus(mode: DaemonStatus["mode"]): DaemonStatus {
    return {
      pid: process.pid,
      rootDir: this.context.config.paths.rootDir,
      databasePath: this.context.config.paths.databasePath,
      ready: true,
      mode,
      startedAt: this.startedAt,
      lastCycleAt: this.context.clock.now().toISOString(),
      cursor: Number(this.context.store.settings.get("daemon.event_cursor") ?? "0")
    };
  }

  private acquireLock(): void {
    acquireDaemonLock(this.context.config.paths, this.lockOwnerId);
    this.lockHeld = true;
  }

  private releaseLock(): void {
    if (!this.lockHeld) {
      return;
    }
    releaseDaemonLock(this.context.config.paths, this.lockOwnerId);
    this.lockHeld = false;
  }
}
