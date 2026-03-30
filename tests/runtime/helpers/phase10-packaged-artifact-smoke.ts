import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PackedCliArtifact {
  tarballPath: string;
  cleanup(): void;
}

export interface InstalledCliArtifact {
  tarballPath: string;
  installRoot: string;
  installedBinPath: string;
  resolvedInstalledBinPath: string;
  env: NodeJS.ProcessEnv;
}

function readExecStderr(error: unknown): string {
  const stderr = (error as { stderr?: string | Buffer }).stderr;
  if (typeof stderr === "string") {
    return stderr;
  }
  if (Buffer.isBuffer(stderr)) {
    return stderr.toString("utf8");
  }
  return "";
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 240_000,
    maxBuffer: 10 * 1024 * 1024
  });
}

function parseJsonResult(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error(`expected JSON payload but received: ${trimmed}`);
  }
}

function parseCliError(error: unknown): Record<string, unknown> {
  const stderr = readExecStderr(error).trim();
  if (stderr.length === 0) {
    throw error;
  }
  return parseJsonResult(stderr);
}

function npmCacheEnv(cacheDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    npm_config_cache: cacheDir
  };
}

function repoLocalCdxPath(rootDir = process.cwd()): string {
  return path.resolve(rootDir, "cdx");
}

function assertNoRepoLocalFallback(install: InstalledCliArtifact): void {
  const repoLocal = repoLocalCdxPath();
  if (
    path.resolve(install.installedBinPath) === repoLocal
    || path.resolve(install.resolvedInstalledBinPath) === repoLocal
  ) {
    throw new Error(`packaged-artifact execution fell back to repo-local ./cdx at ${repoLocal}`);
  }
}

function withExecutionEvidence(
  result: Record<string, unknown>,
  install: InstalledCliArtifact
): Record<string, unknown> {
  return {
    ...result,
    packagedTarballPath: install.tarballPath,
    packagedInstallRoot: install.installRoot,
    packagedInstalledBinPath: install.installedBinPath,
    packagedResolvedBinPath: install.resolvedInstalledBinPath,
    fallbackToRepoCdx: false
  };
}

export function packCliArtifactForSmoke(rootDir = process.cwd()): PackedCliArtifact {
  const packRoot = mkdtempSync(path.join(path.resolve(os.tmpdir()), "codexkit-p10-s4-pack-"));
  const rootCacheDir = path.join(rootDir, ".npm-cache");
  mkdirSync(rootCacheDir, { recursive: true });
  const packedName = run(
    "npm",
    ["pack", "--workspace", "@codexkit/cli", "--silent", "--pack-destination", packRoot],
    rootDir,
    npmCacheEnv(rootCacheDir)
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1);
  if (!packedName) {
    throw new Error("npm pack did not return a tarball name.");
  }
  const tarballPath = path.resolve(packRoot, packedName);
  if (!existsSync(tarballPath)) {
    throw new Error(`packed tarball missing at ${tarballPath}`);
  }
  return {
    tarballPath,
    cleanup(): void {
      rmSync(packRoot, { recursive: true, force: true });
    }
  };
}

export function installPackedCliArtifact(repoDir: string, tarballPath: string): InstalledCliArtifact {
  const absoluteRepoDir = path.resolve(repoDir);
  const cacheDir = path.join(absoluteRepoDir, ".npm-cache");
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(path.join(absoluteRepoDir, "package.json"))) {
    writeFileSync(
      path.join(absoluteRepoDir, "package.json"),
      '{\n  "name": "codexkit-smoke-fixture",\n  "private": true\n}\n',
      "utf8"
    );
  }
  run("npm", ["install", "--no-package-lock", "--no-save", tarballPath], absoluteRepoDir, npmCacheEnv(cacheDir));
  const installedBinPath = path.resolve(absoluteRepoDir, "node_modules", ".bin", process.platform === "win32" ? "cdx.cmd" : "cdx");
  if (!existsSync(installedBinPath)) {
    throw new Error(`installed packaged cdx bin missing at ${installedBinPath}`);
  }
  const install: InstalledCliArtifact = {
    tarballPath: path.resolve(tarballPath),
    installRoot: absoluteRepoDir,
    installedBinPath,
    resolvedInstalledBinPath: realpathSync(installedBinPath),
    env: npmCacheEnv(cacheDir)
  };
  assertNoRepoLocalFallback(install);
  return install;
}

export function runInstalledCli(
  cwd: string,
  install: InstalledCliArtifact,
  args: string[],
  env: NodeJS.ProcessEnv = install.env
): Record<string, unknown> {
  const output = run(install.installedBinPath, [...args, "--json"], path.resolve(cwd), env);
  return withExecutionEvidence(parseJsonResult(output), install);
}

export function runInstalledCliFailure(
  cwd: string,
  install: InstalledCliArtifact,
  args: string[],
  env: NodeJS.ProcessEnv = install.env
): Record<string, unknown> {
  try {
    runInstalledCli(cwd, install, args, env);
    throw new Error("expected packaged CLI failure");
  } catch (error) {
    return withExecutionEvidence(parseCliError(error), install);
  }
}

export function runPackagedCliWithRawNpxFallback(input: {
  cwd: string;
  tarballPath: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}): {
  result: Record<string, unknown>;
  invocation: "raw-npx" | "cache-override-npx";
  caveat: string | null;
} {
  const absoluteCwd = path.resolve(input.cwd);
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...(input.env ?? {})
  };
  delete baseEnv.npm_config_cache;
  delete (baseEnv as Record<string, unknown>).NPM_CONFIG_CACHE;
  try {
    const output = run("npx", ["--yes", "--package", input.tarballPath, "cdx", ...input.args, "--json"], absoluteCwd, baseEnv);
    return {
      result: parseJsonResult(output),
      invocation: "raw-npx",
      caveat: null
    };
  } catch (error) {
    const stderr = readExecStderr(error);
    if (!/EPERM/.test(stderr) || !/\.npm/.test(stderr)) {
      throw error;
    }
    const cacheDir = path.join(absoluteCwd, ".npm-cache");
    mkdirSync(cacheDir, { recursive: true });
    const output = run(
      "npx",
      ["--yes", "--package", input.tarballPath, "cdx", ...input.args, "--json"],
      absoluteCwd,
      {
        ...baseEnv,
        npm_config_cache: cacheDir
      }
    );
    return {
      result: parseJsonResult(output),
      invocation: "cache-override-npx",
      caveat: "raw npx hit EPERM on ~/.npm ownership; reran with npm_config_cache override"
    };
  }
}
