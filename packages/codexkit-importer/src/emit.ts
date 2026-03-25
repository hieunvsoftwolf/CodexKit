import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { ImporterError } from "./errors.ts";
import type { BaseManifest, ImportRegistry } from "./types.ts";

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listRelativeFiles(rootDir: string, prefix = ""): Promise<string[]> {
  const absoluteDir = prefix.length === 0 ? rootDir : path.join(rootDir, prefix);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix.length === 0 ? entry.name : path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(rootDir, relativePath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

export interface ManagedTreeDiff {
  changedFiles: string[];
  extraFiles: string[];
  missingFiles: string[];
  unchangedFiles: string[];
}

export async function inspectManagedTreeDiff(
  outputRoot: string,
  plannedFiles: Record<string, string>
): Promise<ManagedTreeDiff> {
  if (!(await pathExists(outputRoot))) {
    return {
      changedFiles: [],
      extraFiles: [],
      missingFiles: Object.keys(plannedFiles).sort(),
      unchangedFiles: []
    };
  }

  const existingFiles = await listRelativeFiles(outputRoot);
  const plannedPaths = Object.keys(plannedFiles).sort();
  const plannedPathSet = new Set(plannedPaths);
  const existingPathSet = new Set(existingFiles);
  const extraFiles = existingFiles.filter((file) => !plannedPathSet.has(file)).sort();
  const missingFiles = plannedPaths.filter((file) => !existingPathSet.has(file)).sort();
  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];

  for (const relativePath of existingFiles) {
    if (!plannedPathSet.has(relativePath)) {
      continue;
    }
    const absolutePath = path.join(outputRoot, relativePath);
    const currentContent = await readFile(absolutePath, "utf8");
    if (currentContent !== plannedFiles[relativePath]) {
      changedFiles.push(relativePath);
      continue;
    }
    unchangedFiles.push(relativePath);
  }

  return {
    changedFiles: changedFiles.sort(),
    extraFiles,
    missingFiles,
    unchangedFiles: unchangedFiles.sort()
  };
}

function trimList(items: string[]): string {
  if (items.length === 0) {
    return "(none)";
  }
  const sample = items.slice(0, 8);
  const suffix = items.length > sample.length ? ` ... (+${items.length - sample.length} more)` : "";
  return `${sample.join(", ")}${suffix}`;
}

async function ensureNonDestructivePreflight(
  outputRoot: string,
  plannedFiles: Record<string, string>,
  allowManagedTreeReplace: boolean
): Promise<"create" | "noop" | "replace"> {
  if (!(await pathExists(outputRoot))) {
    return "create";
  }

  const diff = await inspectManagedTreeDiff(outputRoot, plannedFiles);

  if (diff.extraFiles.length === 0 && diff.missingFiles.length === 0 && diff.changedFiles.length === 0) {
    return "noop";
  }

  if (!allowManagedTreeReplace) {
    throw new ImporterError(
      "emit-preflight-conflict",
      [
        `existing managed manifests differ under ${outputRoot}`,
        "refusing to replace without explicit opt-in",
        `changed files: ${trimList(diff.changedFiles)}`,
        `extra files: ${trimList(diff.extraFiles)}`,
        `missing files: ${trimList(diff.missingFiles)}`,
        "rerun with allowManagedTreeReplace=true to authorize replacement"
      ].join("\n")
    );
  }

  return "replace";
}

export async function emitManifestBatch(
  outputRoot: string,
  manifests: BaseManifest[],
  registry: ImportRegistry,
  options: { allowManagedTreeReplace?: boolean } = {}
): Promise<void> {
  const plannedFiles: Record<string, string> = {};
  for (const manifest of manifests) {
    plannedFiles[manifest.outputPath] = toJson(manifest);
  }
  plannedFiles["import-registry.json"] = toJson(registry);

  const preflightAction = await ensureNonDestructivePreflight(
    outputRoot,
    plannedFiles,
    options.allowManagedTreeReplace === true
  );
  if (preflightAction === "noop") {
    return;
  }

  const parentDir = path.dirname(outputRoot);
  await mkdir(parentDir, { recursive: true });

  const tempRoot = `${outputRoot}.tmp-${process.pid}-${Date.now()}`;
  const backupRoot = `${outputRoot}.bak-${process.pid}-${Date.now()}`;
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });

  try {
    for (const [relativePath, content] of Object.entries(plannedFiles)) {
      const absolutePath = path.join(tempRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, "utf8");
    }
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw new ImporterError("emit-write-failed", `failed writing temporary manifests: ${(error as Error).message}`);
  }

  if (preflightAction === "replace") {
    try {
      await rename(outputRoot, backupRoot);
    } catch {
      // Existing output is optional. Continue.
    }
  }

  try {
    await rename(tempRoot, outputRoot);
    if (preflightAction === "replace") {
      await rm(backupRoot, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    if (preflightAction === "replace") {
      try {
        await rename(backupRoot, outputRoot);
      } catch {
        // best effort rollback
      }
    }
    throw new ImporterError("emit-rename-failed", `failed finalizing manifest batch: ${(error as Error).message}`);
  }
}
