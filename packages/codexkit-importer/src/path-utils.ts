import { createHash } from "node:crypto";
import path from "node:path";

export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, "\n");
}

export function sha256(input: string): string {
  const hash = createHash("sha256").update(input, "utf8").digest("hex");
  return `sha256:${hash}`;
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

export function toRepoPath(rootDir: string, absolutePath: string): string {
  return toPosixPath(path.relative(rootDir, absolutePath));
}

export function canonicalId(input: string): string {
  const value = input.replace(/\.md$/i, "").replace(/^ck:/i, "");
  return value
    .trim()
    .replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
    .replace(/[:_/\\\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function ensureSafeOutputPath(outputPath: string): string {
  const value = outputPath.replace(/\\/g, "/");
  if (value.startsWith("../") || value.includes("/../") || value.startsWith("/")) {
    throw new Error(`unsafe output path: ${outputPath}`);
  }
  return value;
}

export function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

export function toTitleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
