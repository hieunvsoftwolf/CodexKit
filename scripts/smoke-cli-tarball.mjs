#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const smokeRootDir = path.join(rootDir, ".tmp", "p10-s1-cli-smoke");
const npmCacheDir = path.join(rootDir, ".npm-cache");

function run(command, args, cwd = rootDir) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir
    }
  });
}

mkdirSync(smokeRootDir, { recursive: true });
mkdirSync(npmCacheDir, { recursive: true });
const runDir = mkdtempSync(path.join(smokeRootDir, "run-"));
const globalPrefix = path.join(runDir, "global-prefix");
mkdirSync(globalPrefix, { recursive: true });

run("npm", ["run", "build:cli-artifact"]);
const packOutput = run("npm", ["pack", "--workspace", "@codexkit/cli", "--silent"]).trim();
const tarballName = packOutput.split(/\r?\n/).filter(Boolean).at(-1);

if (!tarballName) {
  throw new Error("npm pack did not return a tarball name.");
}

const tarballPath = path.join(rootDir, tarballName);
const npxDoctor = run("npx", ["--yes", "--package", tarballPath, "cdx", "doctor", "--json"]);
JSON.parse(npxDoctor);

run("npm", ["install", "--global", "--prefix", globalPrefix, tarballPath]);
const globalBin = path.join(globalPrefix, "bin", process.platform === "win32" ? "cdx.cmd" : "cdx");
const globalDoctor = run(globalBin, ["doctor", "--json"]);
JSON.parse(globalDoctor);

console.log(`CLI tarball smoke passed: ${tarballPath}`);
console.log(`Local global-style prefix: ${globalPrefix}`);
