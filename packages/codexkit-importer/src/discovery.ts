import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { ImportDiscoveryResult, ImportSkippedSource, ImportSource, ManifestResource } from "./types.ts";
import { toPosixPath } from "./path-utils.ts";

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(next)));
      continue;
    }
    if (entry.isFile()) {
      files.push(next);
    }
  }
  return files;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function classifySkillResource(repoPath: string): ManifestResource | null {
  const normalized = repoPath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalized);
  if (normalized.includes("/references/") || normalized.includes("/workflows/")) {
    return { path: normalized, kind: "markdown-reference", mode: "reference" };
  }
  if (normalized.includes("/scripts/")) {
    return { path: normalized, kind: "script-resource", mode: "reference" };
  }
  if (normalized.includes("/assets/")) {
    return { path: normalized, kind: "asset-resource", mode: "metadata-only" };
  }
  if (/^README\.md$/i.test(fileName) || /^LICENSE/i.test(fileName)) {
    return { path: normalized, kind: "doc-resource", mode: "reference" };
  }
  return null;
}

function dedupeResources(resources: ManifestResource[]): ManifestResource[] {
  const index = new Map<string, ManifestResource>();
  for (const resource of resources) {
    index.set(resource.path, resource);
  }
  return [...index.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function extractTopLevelScriptReferences(content: string): string[] {
  const references = new Set<string>();
  const pattern = /\.claude\/scripts\/[A-Za-z0-9._/-]+/g;
  for (const match of content.matchAll(pattern)) {
    const rawPath = match[0]?.replace(/[)\]>,;'"`]+$/g, "");
    if (!rawPath) {
      continue;
    }
    const normalized = path.posix.normalize(rawPath);
    if (!normalized.startsWith(".claude/scripts/") || normalized.includes("..")) {
      continue;
    }
    references.add(normalized);
  }
  return [...references].sort();
}

async function collectReferencedTopLevelScripts(
  rootDir: string,
  absolutePaths: string[]
): Promise<string[]> {
  const references = new Set<string>();
  for (const absolutePath of absolutePaths) {
    const content = await readFile(absolutePath, "utf8");
    for (const scriptPath of extractTopLevelScriptReferences(content)) {
      if (await pathExists(path.join(rootDir, scriptPath))) {
        references.add(scriptPath);
      }
    }
  }
  return [...references].sort();
}

async function readJsonPayload(
  rootDir: string,
  relativePath: string
): Promise<{ found: boolean; payload: unknown | null; warning: string | null }> {
  const absolutePath = path.join(rootDir, relativePath);
  if (!(await pathExists(absolutePath))) {
    return { found: false, payload: null, warning: null };
  }
  try {
    const content = await readFile(absolutePath, "utf8");
    return { found: true, payload: JSON.parse(content), warning: null };
  } catch (error) {
    return {
      found: true,
      payload: null,
      warning: `failed to parse provenance file ${relativePath}: ${(error as Error).message}`
    };
  }
}

async function discoverUnsupported(rootDir: string): Promise<ImportSkippedSource[]> {
  const skipped: ImportSkippedSource[] = [];
  const addFiles = async (relativeDir: string, reason: string) => {
    const absoluteDir = path.join(rootDir, relativeDir);
    if (!(await pathExists(absoluteDir))) {
      return;
    }
    const files = await listFilesRecursive(absoluteDir);
    for (const file of files) {
      skipped.push({ kind: "unsupported-source", sourcePath: toPosixPath(path.relative(rootDir, file)), reason });
    }
  };

  for (const file of [".claude/settings.json", ".claude/statusline.cjs", ".claude/statusline.ps1", ".claude/statusline.sh"]) {
    const absolutePath = path.join(rootDir, file);
    if (await pathExists(absolutePath)) {
      skipped.push({ kind: "unsupported-source", sourcePath: file, reason: "out-of-scope for phase 4 wave 1" });
    }
  }
  await addFiles(".claude/hooks", "hook-runtime content is skip-only for wave 1");
  await addFiles(".claude/output-styles", "output styles are skip-only for wave 1");
  await addFiles(".claude/schemas", "schema files are support artifacts, not manifests");
  return skipped;
}

export async function discoverWave1Sources(rootDir: string): Promise<ImportDiscoveryResult> {
  const sources: ImportSource[] = [];
  const skipped: ImportSkippedSource[] = [];
  const skillResourceIndex: Record<string, ManifestResource[]> = {};
  const referencedTopLevelScripts = new Set<string>();
  const addSource = (kind: ImportSource["kind"], absolutePath: string) => {
    sources.push({ kind, absolutePath, sourcePath: toPosixPath(path.relative(rootDir, absolutePath)) });
  };

  for (const file of (await readdir(path.join(rootDir, ".claude/agents"), { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".md"))) {
    addSource("role-source", path.join(rootDir, ".claude/agents", file.name));
  }

  const allSkillFiles = await listFilesRecursive(path.join(rootDir, ".claude/skills"));
  for (const absolutePath of allSkillFiles) {
    const relative = toPosixPath(path.relative(rootDir, absolutePath));
    if (path.posix.basename(relative) !== "SKILL.md") {
      continue;
    }
    addSource("workflow-source", absolutePath);
    const skillDir = path.posix.dirname(relative);
    const resources = allSkillFiles
      .map((candidate) => toPosixPath(path.relative(rootDir, candidate)))
      .filter((candidate) => candidate.startsWith(`${skillDir}/`) && candidate !== relative)
      .map((candidate) => classifySkillResource(candidate))
      .filter((resource): resource is ManifestResource => resource !== null)
      .sort((a, b) => a.path.localeCompare(b.path));

    const companionMarkdownPaths = allSkillFiles.filter((candidate) => {
      const candidateRelative = toPosixPath(path.relative(rootDir, candidate));
      return candidateRelative.startsWith(`${skillDir}/`)
        && candidateRelative !== relative
        && (candidateRelative.includes("/references/") || candidateRelative.includes("/workflows/"));
    });

    for (const scriptPath of await collectReferencedTopLevelScripts(rootDir, [absolutePath, ...companionMarkdownPaths])) {
      referencedTopLevelScripts.add(scriptPath);
      resources.push({ path: scriptPath, kind: "script-resource", mode: "reference" });
    }

    skillResourceIndex[relative] = dedupeResources(resources);
  }

  for (const file of (await readdir(path.join(rootDir, ".claude/rules"), { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".md"))) {
    addSource("policy-source", path.join(rootDir, ".claude/rules", file.name));
  }

  if (await pathExists(path.join(rootDir, ".claude/command-archive"))) {
    const archived = await listFilesRecursive(path.join(rootDir, ".claude/command-archive"));
    for (const file of archived) {
      skipped.push({
        kind: "legacy-source",
        sourcePath: toPosixPath(path.relative(rootDir, file)),
        reason: "legacy command archive skipped by default"
      });
    }
  }
  if (await pathExists(path.join(rootDir, ".claude/scripts"))) {
    const topLevelScripts = await listFilesRecursive(path.join(rootDir, ".claude/scripts"));
    for (const file of topLevelScripts) {
      const sourcePath = toPosixPath(path.relative(rootDir, file));
      if (referencedTopLevelScripts.has(sourcePath)) {
        continue;
      }
      skipped.push({
        kind: "unsupported-source",
        sourcePath,
        reason: "top-level .claude/scripts content is skipped unless directly referenced by an imported skill"
      });
    }
  }
  skipped.push(...(await discoverUnsupported(rootDir)));

  const templateDeferred = !(await pathExists(path.join(rootDir, "plans/templates")));
  const ckConfigPath = ".claude/.ck.json";
  const metadataPath = ".claude/metadata.json";
  const [ckConfigData, metadataData] = await Promise.all([
    readJsonPayload(rootDir, ckConfigPath),
    readJsonPayload(rootDir, metadataPath)
  ]);

  sources.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  skipped.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  const provenanceWarnings = [ckConfigData.warning, metadataData.warning].filter((warning): warning is string => Boolean(warning)).sort();

  return {
    sources,
    skillResourceIndex,
    skipped,
    templateDeferred,
    ckConfigPath: ckConfigData.found ? ckConfigPath : null,
    metadataPath: metadataData.found ? metadataPath : null,
    ckConfigPayload: ckConfigData.payload,
    metadataPayload: metadataData.payload,
    provenanceWarnings
  };
}
