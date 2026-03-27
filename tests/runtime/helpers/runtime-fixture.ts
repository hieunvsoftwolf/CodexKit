import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { RuntimeClock, ValidationHostManifest } from "../../../packages/codexkit-core/src/index.ts";

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

function readCommandOutput(command: string, args: string[], cwd: string): string | null {
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: "utf8"
    }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function detectFilesystemType(rootDir: string): string {
  const darwinStyle = readCommandOutput("stat", ["-f", "%T", rootDir], rootDir);
  if (darwinStyle) {
    return darwinStyle;
  }
  const linuxStyle = readCommandOutput("stat", ["-f", "-c", "%T", rootDir], rootDir);
  if (linuxStyle) {
    return linuxStyle;
  }
  return "filesystem-unreported";
}

function detectCodexCliVersion(rootDir: string): string {
  if (typeof process.env.CODEX_CLI_VERSION === "string" && process.env.CODEX_CLI_VERSION.trim().length > 0) {
    return process.env.CODEX_CLI_VERSION.trim();
  }
  const explicitVersion = readCommandOutput("codex", ["--version"], rootDir)
    ?? readCommandOutput("codex", ["version"], rootDir);
  return explicitVersion ?? "codex-cli-unavailable";
}

export function createValidationHostManifest(rootDir = process.cwd()): ValidationHostManifest {
  const gitVersion = readCommandOutput("git", ["--version"], rootDir) ?? "git-unavailable";
  return {
    os: `${os.platform()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? "cpu-unreported",
    ramBytes: os.totalmem(),
    filesystem: detectFilesystemType(rootDir),
    nodeVersion: process.version,
    gitVersion,
    codexCliVersion: detectCodexCliVersion(rootDir)
  };
}
