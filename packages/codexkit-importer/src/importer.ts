import path from "node:path";

import { CORE_WORKFLOW_OVERRIDES, DEFAULT_IMPORTED_AT } from "./constants.ts";
import { discoverWave1Sources } from "./discovery.ts";
import { emitManifestBatch } from "./emit.ts";
import { ImporterError } from "./errors.ts";
import { normalizePolicy } from "./normalize-policy.ts";
import { normalizeRole } from "./normalize-role.ts";
import { normalizeWorkflow } from "./normalize-workflow.ts";
import { parseSource } from "./parse.ts";
import { validateManifestBatch } from "./validate.ts";
import type { BaseManifest, ImportOptions, ImportRegistry, ImportResult, ImportSkippedSource, ParsedSource } from "./types.ts";

function isCoreWorkflowSource(sourcePath: string): boolean {
  const relative = sourcePath.replace(/^\.claude\/skills\//, "");
  const topLevel = relative.split("/")[0] ?? "";
  return CORE_WORKFLOW_OVERRIDES.has(topLevel);
}

function isCoreRoleSource(sourcePath: string): boolean {
  return sourcePath.startsWith(".claude/agents/");
}

function createRegistry(
  importedAt: string,
  manifests: BaseManifest[],
  skipped: ImportSkippedSource[],
  conflicts: Array<{ id: string; sourcePaths: string[]; reason: string }>,
  ckConfigFound: boolean,
  metadataFound: boolean,
  ckConfigPayload: unknown | null,
  metadataPayload: unknown | null,
  provenanceWarnings: string[],
  templateDeferred: boolean
): ImportRegistry {
  const entries = manifests
    .map((manifest) => ({
      manifestType: manifest.manifestType,
      id: manifest.id,
      status: manifest.status,
      sourcePath: manifest.source.path,
      outputPath: `.codexkit/manifests/${manifest.outputPath}`,
      checksum: manifest.source.checksum,
      warnings: manifest.warnings
    }))
    .sort((a, b) => `${a.manifestType}:${a.id}`.localeCompare(`${b.manifestType}:${b.id}`));

  const coreWorkflows = manifests.filter(
    (manifest) => manifest.manifestType === "workflow" && manifest.normalized.workflowClass === "core"
  ).length;
  const helperWorkflows = manifests.filter(
    (manifest) => manifest.manifestType === "workflow" && manifest.normalized.workflowClass !== "core"
  ).length;
  return {
    schemaVersion: 1,
    importedAt,
    sourceRoot: ".",
    sourceKit: {
      ckConfigFound,
      metadataFound,
      ckConfig: ckConfigPayload,
      metadata: metadataPayload
    },
    summary: {
      roles: manifests.filter((manifest) => manifest.manifestType === "role").length,
      coreWorkflows,
      helperWorkflows,
      policies: manifests.filter((manifest) => manifest.manifestType === "policy").length,
      legacySkipped: skipped.filter((entry) => entry.kind === "legacy-source").length,
      unsupportedSkipped: skipped.filter((entry) => entry.kind === "unsupported-source").length,
      quarantined: skipped.filter((entry) => entry.kind === "quarantined-source").length,
      templatesDeferred: templateDeferred ? 1 : 0
    },
    entries,
    skipped,
    conflicts,
    warnings: Array.from(
      new Set([
        ...(templateDeferred ? ["template import deferred: plans/templates is absent in current baseline"] : []),
        ...provenanceWarnings,
        ...manifests.flatMap((manifest) => manifest.warnings)
      ])
    ).sort()
  };
}

async function parseAndNormalize(parsed: ParsedSource, importedAt: string, skillResources: Record<string, BaseManifest["resources"]>): Promise<BaseManifest> {
  if (parsed.source.kind === "role-source") {
    return normalizeRole(parsed, importedAt);
  }
  if (parsed.source.kind === "workflow-source") {
    return normalizeWorkflow(parsed, importedAt, skillResources[parsed.source.sourcePath] ?? []);
  }
  return normalizePolicy(parsed, importedAt);
}

export async function importClaudekitWave1(options: ImportOptions): Promise<ImportResult> {
  const rootDir = path.resolve(options.rootDir);
  const outputRoot = path.resolve(rootDir, options.outputDir ?? ".codexkit/manifests");
  const importedAt = options.importedAt ?? DEFAULT_IMPORTED_AT;
  const discovery = await discoverWave1Sources(rootDir);
  const manifests: BaseManifest[] = [];
  const skipped = [...discovery.skipped];

  for (const source of discovery.sources) {
    const parsed = await parseSource(source);
    const parseFailed = Boolean(parsed.parseError) || parsed.frontmatter === null;
    if ((source.kind === "role-source" || source.kind === "workflow-source") && parseFailed) {
      const reason = parsed.parseError ?? "missing required frontmatter block";
      if (source.kind === "workflow-source" && !isCoreWorkflowSource(source.sourcePath)) {
        skipped.push({ kind: "quarantined-source", sourcePath: source.sourcePath, reason });
        continue;
      }
      if (source.kind === "role-source" && !isCoreRoleSource(source.sourcePath)) {
        skipped.push({ kind: "quarantined-source", sourcePath: source.sourcePath, reason });
        continue;
      }
      throw new ImporterError("parse-failed", `core source parse failed for ${source.sourcePath}: ${reason}`);
    }
    manifests.push(await parseAndNormalize(parsed, importedAt, discovery.skillResourceIndex));
  }

  manifests.sort((a, b) => a.outputPath.localeCompare(b.outputPath));
  const validation = await validateManifestBatch(manifests, rootDir, outputRoot);
  if (validation.errors.length > 0) {
    throw new ImporterError("validation-failed", validation.errors.join("\n"));
  }

  const registry = createRegistry(
    importedAt,
    manifests,
    skipped.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)),
    validation.conflicts,
    discovery.ckConfigPath !== null,
    discovery.metadataPath !== null,
    discovery.ckConfigPayload,
    discovery.metadataPayload,
    discovery.provenanceWarnings,
    discovery.templateDeferred
  );

  if (options.emit !== false) {
    const emitOptions = options.allowManagedTreeReplace === undefined
      ? {}
      : { allowManagedTreeReplace: options.allowManagedTreeReplace };
    await emitManifestBatch(outputRoot, manifests, registry, {
      ...emitOptions
    });
  }

  return { manifests, registry, outputRoot };
}
