import { access } from "node:fs/promises";
import path from "node:path";

import type { BaseManifest } from "./types.ts";

export interface ValidationResult {
  errors: string[];
  conflicts: Array<{ id: string; sourcePaths: string[]; reason: string }>;
}

function isCoreWorkflow(manifest: BaseManifest): boolean {
  return manifest.manifestType === "workflow" && manifest.normalized.workflowClass === "core";
}

function hasKnownHostReference(bodyMarkdown: string): boolean {
  return /\b(AskUserQuestion|TaskCreate|TaskList|TaskGet|TaskUpdate|Task\s*\(|TeamCreate|TeamDelete|SendMessage)\b/.test(bodyMarkdown);
}

async function sourceExists(rootDir: string, sourcePath: string): Promise<boolean> {
  try {
    await access(path.join(rootDir, sourcePath));
    return true;
  } catch {
    return false;
  }
}

function hasBaseEnvelope(manifest: BaseManifest): boolean {
  return manifest.schemaVersion === 1
    && typeof manifest.id === "string"
    && manifest.id.length > 0
    && typeof manifest.slug === "string"
    && manifest.slug.length > 0
    && manifest.source.path.length > 0;
}

function validateWorkflowNormalizedShape(manifest: BaseManifest): string[] {
  if (manifest.manifestType !== "workflow") {
    return [];
  }

  const normalized = manifest.normalized as Record<string, unknown>;
  const requiredKeys = ["version", "license", "allowed-tools", "metadata"] as const;
  const missingKeys = requiredKeys.filter((key) => !Object.prototype.hasOwnProperty.call(normalized, key));
  const errors = missingKeys.map((key) => `workflow ${manifest.id} missing normalized field: ${key}`);

  const version = normalized.version;
  if (!(version === null || typeof version === "string")) {
    errors.push(`workflow ${manifest.id} has invalid normalized.version type`);
  }
  const license = normalized.license;
  if (!(license === null || typeof license === "string")) {
    errors.push(`workflow ${manifest.id} has invalid normalized.license type`);
  }
  const allowedTools = normalized["allowed-tools"];
  if (!(Array.isArray(allowedTools) && allowedTools.every((item) => typeof item === "string"))) {
    errors.push(`workflow ${manifest.id} has invalid normalized.allowed-tools type`);
  }
  const metadata = normalized.metadata;
  if (!(
    metadata === null
    || (typeof metadata === "object" && !Array.isArray(metadata))
  )) {
    errors.push(`workflow ${manifest.id} has invalid normalized.metadata type`);
  }

  return errors;
}

export async function validateManifestBatch(manifests: BaseManifest[], rootDir: string, outputRoot: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const conflicts: Array<{ id: string; sourcePaths: string[]; reason: string }> = [];
  const idMap = new Map<string, BaseManifest[]>();
  const outputPaths = new Set<string>();

  for (const manifest of manifests) {
    if (!hasBaseEnvelope(manifest)) {
      errors.push(`manifest envelope invalid for source ${manifest.source.path}`);
    }
    const safeOutputRoot = path.resolve(outputRoot);
    const absoluteOutput = path.resolve(outputRoot, manifest.outputPath);
    if (!absoluteOutput.startsWith(`${safeOutputRoot}${path.sep}`)) {
      errors.push(`output path escapes manifests root: ${manifest.outputPath}`);
    }
    if (outputPaths.has(manifest.outputPath)) {
      errors.push(`duplicate output path: ${manifest.outputPath}`);
    }
    outputPaths.add(manifest.outputPath);

    const key = `${manifest.manifestType}:${manifest.id}`;
    const bucket = idMap.get(key) ?? [];
    bucket.push(manifest);
    idMap.set(key, bucket);

    if (!(await sourceExists(rootDir, manifest.source.path))) {
      errors.push(`source path missing: ${manifest.source.path}`);
    }

    if (
      (manifest.manifestType === "role" || manifest.manifestType === "workflow")
      && (manifest.raw.frontmatter === undefined || manifest.raw.frontmatter === null)
    ) {
      errors.push(`missing frontmatter parse for ${manifest.source.path}`);
    }
    errors.push(...validateWorkflowNormalizedShape(manifest));

    if (isCoreWorkflow(manifest)) {
      const compatRewrites = Array.isArray(manifest.normalized.compatRewrites)
        ? manifest.normalized.compatRewrites as unknown[]
        : [];
      const bodyMarkdown = typeof manifest.raw.bodyMarkdown === "string" ? manifest.raw.bodyMarkdown : "";
      if (hasKnownHostReference(bodyMarkdown) && compatRewrites.length === 0) {
        errors.push(`core workflow missing compat rewrites: ${manifest.id}`);
      }
    }

    for (const resource of manifest.resources) {
      if (!(await sourceExists(rootDir, resource.path))) {
        errors.push(`resource path missing for ${manifest.id}: ${resource.path}`);
      }
    }
  }

  for (const [id, bucket] of idMap.entries()) {
    if (bucket.length <= 1) {
      continue;
    }
    conflicts.push({
      id,
      sourcePaths: bucket.map((manifest) => manifest.source.path).sort(),
      reason: "duplicate canonical id in same manifest type"
    });
    const hasCore = bucket.some((manifest) => manifest.manifestType !== "workflow" || manifest.normalized.workflowClass === "core");
    if (hasCore) {
      errors.push(`core duplicate id conflict: ${id}`);
    }
  }

  return { errors: Array.from(new Set(errors)).sort(), conflicts };
}
