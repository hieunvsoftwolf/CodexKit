import path from "node:path";

import { CORE_WORKFLOW_OVERRIDES, KNOWN_ROLES } from "./constants.ts";
import { canonicalId, ensureSafeOutputPath, toTitleCase } from "./path-utils.ts";
import { collectCompatRewrites, collectRequiredRoles } from "./rewrite.ts";
import type { BaseManifest, ManifestResource, ParsedSource } from "./types.ts";

const POLICY_NAMES = [
  "development-rules",
  "primary-workflow",
  "orchestration-protocol",
  "documentation-management",
  "team-coordination-rules"
];

function detectModes(bodyMarkdown: string): string[] {
  const modes = new Set<string>();
  const tableMatches = bodyMarkdown.matchAll(/\|\s*--([a-z][a-z0-9-]*)\s*\|/gi);
  for (const match of tableMatches) {
    if (match[1]) {
      modes.add(match[1]);
    }
  }
  for (const match of bodyMarkdown.matchAll(/--([a-z][a-z0-9-]*)\b/gi)) {
    if (match[1]) {
      modes.add(match[1]);
    }
  }
  return [...modes].sort();
}

function detectSubcommands(bodyMarkdown: string): string[] {
  const commands = new Set<string>();
  for (const match of bodyMarkdown.matchAll(/\/ck:[a-z0-9-]+\s+([a-z0-9-]+)/gi)) {
    if (match[1]) {
      commands.add(match[1]);
    }
  }
  return [...commands].sort();
}

function classifyWorkflowStatus(resources: ManifestResource[]): "active" | "manual-review" {
  const opaqueAsset = resources.some((resource) => {
    if (resource.kind !== "asset-resource") {
      return false;
    }
    return !/\.(md|txt|json|yaml|yml|toml|ini|csv|xml|html|js|ts|cjs|mjs|py|sh|ps1)$/i.test(resource.path);
  });
  return opaqueAsset ? "manual-review" : "active";
}

function normalizeSkillId(parsed: ParsedSource, frontmatterName: string | null): { id: string; command: string | null; aliases: string[]; className: string } {
  const relative = parsed.source.sourcePath.replace(/^\.claude\/skills\//, "");
  const skillDir = path.posix.dirname(relative);
  const topLevelDir = skillDir.split("/")[0] ?? skillDir;
  const override = CORE_WORKFLOW_OVERRIDES.get(topLevelDir);
  if (override) {
    return {
      id: override.id,
      command: override.command,
      aliases: [override.id, frontmatterName ?? `ck:${topLevelDir}`, topLevelDir],
      className: "core"
    };
  }
  const pathDerivedId = canonicalId(skillDir);
  return {
    id: pathDerivedId,
    command: null,
    aliases: [pathDerivedId, ...(frontmatterName ? [frontmatterName] : [])],
    className: "helper"
  };
}

function detectApprovalGates(bodyMarkdown: string): string[] {
  const gates = new Set<string>();
  if (/approval/i.test(bodyMarkdown)) {
    gates.add("approval");
  }
  if (/checkpoint/i.test(bodyMarkdown)) {
    gates.add("checkpoint");
  }
  return [...gates];
}

function normalizeAllowedTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function normalizeWorkflow(
  parsed: ParsedSource,
  importedAt: string,
  resources: ManifestResource[]
): BaseManifest {
  const frontmatter = parsed.frontmatter ?? {};
  const frontmatterName = typeof frontmatter.name === "string" ? frontmatter.name : null;
  const identity = normalizeSkillId(parsed, frontmatterName);
  const id = canonicalId(identity.id);
  const slug = canonicalId(id);
  const outputPath = ensureSafeOutputPath(`workflows/${slug}.workflow.json`);
  const compatRewrites = collectCompatRewrites(parsed.bodyMarkdown, []);
  const workflowClass = identity.className;
  const subcommands = detectSubcommands(parsed.bodyMarkdown);

  const requiredPolicies = POLICY_NAMES.filter((policyName) => parsed.bodyMarkdown.includes(`${policyName}.md`));
  const requiredRoles = collectRequiredRoles(parsed.bodyMarkdown, KNOWN_ROLES);
  const warningList: string[] = [];
  const normalizedVersion = typeof frontmatter.version === "string" || typeof frontmatter.version === "number"
    ? String(frontmatter.version)
    : null;
  const normalizedLicense = typeof frontmatter.license === "string" ? frontmatter.license : null;
  const normalizedAllowedTools = normalizeAllowedTools(frontmatter["allowed-tools"]);
  const normalizedMetadata = normalizeMetadata(frontmatter.metadata);
  if (workflowClass === "core" && compatRewrites.length === 0) {
    warningList.push("core workflow has no detected compatibility rewrites");
  }

  return {
    schemaVersion: 1,
    manifestType: "workflow",
    id,
    slug,
    aliases: Array.from(new Set(identity.aliases.map((value) => value.trim()).filter(Boolean))).sort(),
    status: workflowClass === "core" ? "active" : classifyWorkflowStatus(resources),
    source: {
      path: parsed.source.sourcePath,
      kind: "skill-markdown",
      checksum: parsed.checksum,
      importedAt
    },
    raw: {
      frontmatter,
      bodyMarkdown: parsed.bodyMarkdown
    },
    normalized: {
      workflowClass,
      command: identity.command,
      displayName: toTitleCase(id),
      argumentHint: typeof frontmatter["argument-hint"] === "string" ? frontmatter["argument-hint"] : null,
      version: normalizedVersion,
      license: normalizedLicense,
      "allowed-tools": normalizedAllowedTools,
      // Keep the legacy camelCase key to avoid breaking existing consumers.
      allowedTools: normalizedAllowedTools,
      metadata: normalizedMetadata,
      summary: typeof frontmatter.description === "string" ? frontmatter.description : "",
      promptMarkdown: parsed.bodyMarkdown,
      modes: detectModes(parsed.bodyMarkdown),
      subcommands,
      approvalGates: detectApprovalGates(parsed.bodyMarkdown),
      requiredRoles,
      requiredPolicies,
      compatRewrites,
      executionHints: {
        supportsPlanHydration: /hydrate tasks|plan hydration|TaskCreate/i.test(parsed.bodyMarkdown),
        requiresUserReview: /askuserquestion|approval/i.test(parsed.bodyMarkdown)
      }
    },
    resources,
    warnings: warningList,
    outputPath
  };
}
