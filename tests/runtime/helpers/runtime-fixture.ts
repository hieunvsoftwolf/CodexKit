import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
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

export async function createGitRuntimeFixture(prefix: string) {
  const fixture = await createRuntimeFixture(prefix);
  execFileSync("git", ["init"], { cwd: fixture.rootDir });
  execFileSync("git", ["config", "user.name", "CodexKit Test"], { cwd: fixture.rootDir });
  execFileSync("git", ["config", "user.email", "codexkit-test@example.com"], { cwd: fixture.rootDir });
  writeFileSync(path.join(fixture.rootDir, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: fixture.rootDir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: fixture.rootDir });
  return fixture;
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
