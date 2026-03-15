import path from "node:path";
import { lstatSync, realpathSync } from "node:fs";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";

export interface OwnedPathPolicy {
  ownedWrite: string[];
  sharedWrite: string[];
  artifactWrite: string[];
  readOnly?: string[];
}

const PROTECTED_PREFIXES = [".git", ".codexkit/runtime"];

function normalize(input: string): string {
  const candidate = input.replace(/\\/g, "/").trim().replace(/^\.\/+/, "");
  if (candidate.length === 0) {
    return "";
  }
  const normalized = path.posix.normalize(candidate);
  if (normalized === "." || normalized === "") {
    return "";
  }
  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new CodexkitError("OWNED_PATH_INVALID", `path '${input}' escapes repo root`);
  }
  return normalized.replace(/\/+$/, "");
}

function matchesPrefix(candidate: string, prefix: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

function isProtectedPath(relativePath: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(relativePath, prefix));
}

function isAllowedWrite(relativePath: string, policy: OwnedPathPolicy): boolean {
  const writable = [...policy.ownedWrite, ...policy.sharedWrite, ...policy.artifactWrite].map(normalize).filter(Boolean);
  return writable.some((prefix) => matchesPrefix(relativePath, prefix));
}

export function normalizeOwnedPathPolicy(policy: OwnedPathPolicy): OwnedPathPolicy {
  return {
    ownedWrite: policy.ownedWrite.map(normalize),
    sharedWrite: policy.sharedWrite.map(normalize),
    artifactWrite: policy.artifactWrite.map(normalize),
    readOnly: (policy.readOnly ?? []).map(normalize)
  };
}

export function evaluateOwnedPathViolations(changedPaths: string[], policy: OwnedPathPolicy): string[] {
  const normalizedPolicy = normalizeOwnedPathPolicy(policy);
  return changedPaths
    .map(normalize)
    .filter((changedPath) => changedPath.length > 0)
    .filter((changedPath) => isProtectedPath(changedPath) || !isAllowedWrite(changedPath, normalizedPolicy));
}

export function assertPathInsideRoot(rootDir: string, childPath: string): string {
  const resolvedRoot = realpathSync(rootDir);
  const resolvedChild = path.resolve(rootDir, childPath);
  const relative = path.relative(resolvedRoot, resolvedChild);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CodexkitError("PATH_ESCAPE", `path '${childPath}' escapes root`);
  }
  return resolvedChild;
}

export function assertNoSymlinkEscape(worktreeRoot: string, relativePath: string): void {
  const normalized = normalize(relativePath);
  if (!normalized) {
    return;
  }
  const absolute = assertPathInsideRoot(worktreeRoot, normalized);
  const parent = path.dirname(absolute);
  const current = realpathSync(parent);
  const relative = path.relative(realpathSync(worktreeRoot), current);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CodexkitError("PATH_SYMLINK_ESCAPE", `path '${relativePath}' resolves outside worktree`);
  }
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      throw new CodexkitError("PATH_SYMLINK_DENIED", `path '${relativePath}' cannot be a writable symlink`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}
