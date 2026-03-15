import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RuntimeClock } from "../../../packages/codexkit-core/src/index.ts";

export async function createRuntimeFixture(prefix: string) {
  const rootDir = await mkdtemp(path.join(tmpdir(), `${prefix}-`));
  await mkdir(path.join(rootDir, ".git"), { recursive: true });
  return {
    rootDir,
    async cleanup(): Promise<void> {
      await rm(rootDir, { recursive: true, force: true });
    }
  };
}

export function createFakeClock(start = "2026-03-14T00:00:00.000Z"): { clock: RuntimeClock; advanceMs(ms: number): void } {
  let current = new Date(start);
  return {
    clock: {
      now(): Date {
        return new Date(current);
      }
    },
    advanceMs(ms: number): void {
      current = new Date(current.getTime() + ms);
    }
  };
}
