import path from "node:path";

import { LOCAL_TOOL_CAPABILITIES, ROLE_DEFAULT_ACCESS, ROLE_STATUS_OVERRIDES } from "./constants.ts";
import { canonicalId, ensureSafeOutputPath, toTitleCase } from "./path-utils.ts";
import { collectCompatRewrites, extractUnknownToolReferences, splitToolList } from "./rewrite.ts";
import type { BaseManifest, ParsedSource } from "./types.ts";

function extractTeamModeSection(bodyMarkdown: string): string | null {
  const match = /##\s+Team Mode[\s\S]*?(?=\n##\s+|\n#\s+|$)/i.exec(bodyMarkdown);
  return match?.[0]?.trim() ?? null;
}

function detectReadOnly(bodyMarkdown: string): boolean {
  return /do not make code changes|do not implement/i.test(bodyMarkdown);
}

export function normalizeRole(parsed: ParsedSource, importedAt: string): BaseManifest {
  const frontmatter = parsed.frontmatter ?? {};
  const sourceName = typeof frontmatter.name === "string" ? frontmatter.name : path.posix.basename(parsed.source.sourcePath, ".md");
  const id = canonicalId(sourceName);
  const slug = canonicalId(id);
  const tools = splitToolList(frontmatter.tools);
  const compatRewrites = collectCompatRewrites(parsed.bodyMarkdown, tools);
  const unresolved = extractUnknownToolReferences(parsed.bodyMarkdown, tools, LOCAL_TOOL_CAPABILITIES);
  const defaultAccessOverride = ROLE_DEFAULT_ACCESS.get(id);
  const defaultAccess = defaultAccessOverride ?? (detectReadOnly(parsed.bodyMarkdown) ? "read-only" : "owned-scope");
  const status = ROLE_STATUS_OVERRIDES.get(id) ?? "active";
  const outputPath = ensureSafeOutputPath(`roles/${slug}.role.json`);
  return {
    schemaVersion: 1,
    manifestType: "role",
    id,
    slug,
    aliases: Array.from(new Set([id, sourceName])).filter(Boolean).sort(),
    status,
    source: {
      path: parsed.source.sourcePath,
      kind: "agent-markdown",
      checksum: parsed.checksum,
      importedAt
    },
    raw: {
      frontmatter,
      bodyMarkdown: parsed.bodyMarkdown
    },
    normalized: {
      displayName: toTitleCase(id),
      summary: typeof frontmatter.description === "string" ? frontmatter.description : "",
      modelPreference: typeof frontmatter.model === "string" ? frontmatter.model : null,
      memoryScope: typeof frontmatter.memory === "string" ? frontmatter.memory : null,
      toolCapabilities: {
        local: tools.map((tool) => tool.toLowerCase()).filter((tool) => LOCAL_TOOL_CAPABILITIES.has(tool)).sort(),
        compat: compatRewrites,
        unresolved
      },
      promptMarkdown: parsed.bodyMarkdown,
      constraints: {
        advisoryOnly: detectReadOnly(parsed.bodyMarkdown),
        defaultAccess,
        ownedPathRequired: defaultAccess === "owned-scope"
      },
      teamMode: extractTeamModeSection(parsed.bodyMarkdown)
    },
    resources: [],
    warnings: unresolved.map((tool) => `unresolved host tool reference: ${tool}`),
    outputPath
  };
}
