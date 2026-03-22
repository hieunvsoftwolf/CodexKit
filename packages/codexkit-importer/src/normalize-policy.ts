import path from "node:path";

import { POLICY_APPLICABILITY } from "./constants.ts";
import { canonicalId, ensureSafeOutputPath, toTitleCase } from "./path-utils.ts";
import type { BaseManifest, ParsedSource } from "./types.ts";

function extractDirectives(bodyMarkdown: string): Array<{ level: "must" | "should"; text: string }> {
  const directives: Array<{ level: "must" | "should"; text: string }> = [];
  for (const line of bodyMarkdown.split("\n")) {
    const match = /^\s*-\s+(.+)$/.exec(line);
    if (!match?.[1]) {
      continue;
    }
    const text = match[1].trim();
    if (text.length === 0) {
      continue;
    }
    const level = /must|always|do not|never|important/i.test(text) ? "must" : "should";
    directives.push({ level, text });
  }
  return directives;
}

export function normalizePolicy(parsed: ParsedSource, importedAt: string): BaseManifest {
  const baseName = path.posix.basename(parsed.source.sourcePath, ".md");
  const id = canonicalId(baseName);
  const slug = canonicalId(id);
  const outputPath = ensureSafeOutputPath(`policies/${slug}.policy.json`);
  return {
    schemaVersion: 1,
    manifestType: "policy",
    id,
    slug,
    aliases: [id],
    status: "active",
    source: {
      path: parsed.source.sourcePath,
      kind: "rule-markdown",
      checksum: parsed.checksum,
      importedAt
    },
    raw: {
      bodyMarkdown: parsed.bodyMarkdown
    },
    normalized: {
      displayName: toTitleCase(id),
      appliesTo: POLICY_APPLICABILITY.get(id) ?? ["all"],
      promptMarkdown: parsed.bodyMarkdown,
      directives: extractDirectives(parsed.bodyMarkdown),
      tags: Array.from(new Set(["global", ...id.split("-")])).sort()
    },
    resources: [],
    warnings: [],
    outputPath
  };
}
