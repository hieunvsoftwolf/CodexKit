import { readFile } from "node:fs/promises";

import { parseMarkdownSource } from "./frontmatter.ts";
import { normalizeLineEndings, sha256 } from "./path-utils.ts";
import type { ImportSource, ParsedSource } from "./types.ts";

export async function parseSource(source: ImportSource): Promise<ParsedSource> {
  const raw = normalizeLineEndings(await readFile(source.absolutePath, "utf8"));
  const parsed = parseMarkdownSource(raw);
  return {
    source,
    checksum: sha256(raw),
    rawContent: raw,
    bodyMarkdown: parsed.bodyMarkdown,
    frontmatter: parsed.frontmatter,
    frontmatterText: parsed.frontmatterText,
    parseError: parsed.parseError
  };
}
