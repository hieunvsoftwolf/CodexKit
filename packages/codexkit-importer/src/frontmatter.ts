import { normalizeLineEndings, stripQuotes } from "./path-utils.ts";

export interface ParsedMarkdown {
  bodyMarkdown: string;
  frontmatterText: string | null;
  frontmatter: Record<string, unknown> | null;
  parseError: string | null;
}

interface ParseBlockResult {
  value: unknown;
  nextIndex: number;
  error: string | null;
}

function countIndent(line: string): number {
  let index = 0;
  while (index < line.length && line[index] === " ") {
    index += 1;
  }
  return index;
}

function parseScalar(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null" || trimmed === "~") {
    return null;
  }
  if (trimmed === "[]") {
    return [];
  }
  if (trimmed === "{}") {
    return {};
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return stripQuotes(trimmed);
}

function parseBlockScalar(lines: string[], startIndex: number, folded: boolean, minIndent: number): ParseBlockResult {
  const content: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      content.push("");
      index += 1;
      continue;
    }
    const indent = countIndent(line);
    if (indent < minIndent) {
      break;
    }
    content.push(line.slice(minIndent));
    index += 1;
  }

  if (folded) {
    const foldedLines: string[] = [];
    for (const line of content) {
      if (line.length === 0) {
        foldedLines.push("\n");
      } else if (foldedLines.length === 0 || foldedLines[foldedLines.length - 1] === "\n") {
        foldedLines.push(line);
      } else {
        foldedLines.push(` ${line}`);
      }
    }
    return { value: foldedLines.join(""), nextIndex: index, error: null };
  }
  return { value: content.join("\n"), nextIndex: index, error: null };
}

function parseNestedValue(lines: string[], startIndex: number, minIndent: number): ParseBlockResult {
  let index = startIndex;
  while (index < lines.length && (lines[index] ?? "").trim().length === 0) {
    index += 1;
  }
  if (index >= lines.length) {
    return { value: "", nextIndex: index, error: null };
  }
  const line = lines[index] ?? "";
  const indent = countIndent(line);
  if (indent < minIndent) {
    return { value: "", nextIndex: index, error: null };
  }
  const content = line.slice(indent);
  if (content.startsWith("- ")) {
    return parseSequence(lines, index, indent);
  }
  return parseMapping(lines, index, indent);
}

function parseSequence(lines: string[], startIndex: number, baseIndent: number): ParseBlockResult {
  const values: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const indent = countIndent(line);
    if (indent < baseIndent) {
      break;
    }
    if (indent > baseIndent) {
      return { value: null, nextIndex: index, error: `invalid list indentation at line ${index + 1}` };
    }

    const content = line.slice(baseIndent);
    if (!content.startsWith("- ")) {
      break;
    }

    const itemText = content.slice(2).trim();
    if (itemText.length === 0) {
      const nested = parseNestedValue(lines, index + 1, baseIndent + 2);
      if (nested.error) {
        return nested;
      }
      values.push(nested.value);
      index = nested.nextIndex;
      continue;
    }

    values.push(parseScalar(itemText));
    index += 1;
  }

  return { value: values, nextIndex: index, error: null };
}

function parseMapping(lines: string[], startIndex: number, baseIndent: number): ParseBlockResult {
  const data: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const indent = countIndent(line);
    if (indent < baseIndent) {
      break;
    }
    if (indent > baseIndent) {
      return { value: null, nextIndex: index, error: `invalid mapping indentation at line ${index + 1}` };
    }

    const content = line.slice(baseIndent);
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(content);
    if (!match) {
      return { value: null, nextIndex: index, error: `invalid frontmatter line ${index + 1}: ${content}` };
    }

    const key = match[1];
    const rawValue = match[2] ?? "";
    if (!key) {
      return { value: null, nextIndex: index, error: `invalid frontmatter key at line ${index + 1}` };
    }

    if (rawValue === ">" || rawValue === ">-" || rawValue === "|" || rawValue === "|-") {
      const parsed = parseBlockScalar(lines, index + 1, rawValue.startsWith(">"), baseIndent + 2);
      if (parsed.error) {
        return parsed;
      }
      data[key] = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (rawValue.length === 0) {
      const nested = parseNestedValue(lines, index + 1, baseIndent + 2);
      if (nested.error) {
        return nested;
      }
      data[key] = nested.value;
      index = nested.nextIndex;
      continue;
    }

    data[key] = parseScalar(rawValue);
    index += 1;
  }

  return { value: data, nextIndex: index, error: null };
}

function parseFrontmatterBlock(frontmatterText: string): { data: Record<string, unknown> | null; error: string | null } {
  const parsed = parseMapping(frontmatterText.split("\n"), 0, 0);
  if (parsed.error) {
    return { data: null, error: parsed.error };
  }
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return { data: null, error: "frontmatter root must be a mapping" };
  }
  return { data: parsed.value as Record<string, unknown>, error: null };
}

export function parseMarkdownSource(sourceText: string): ParsedMarkdown {
  const normalized = normalizeLineEndings(sourceText);
  if (!normalized.startsWith("---\n")) {
    return { bodyMarkdown: normalized, frontmatterText: null, frontmatter: null, parseError: null };
  }

  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) {
    return {
      bodyMarkdown: normalized,
      frontmatterText: null,
      frontmatter: null,
      parseError: "frontmatter opening delimiter found without closing delimiter"
    };
  }

  const frontmatterText = match[1] ?? "";
  const parsed = parseFrontmatterBlock(frontmatterText);
  const bodyMarkdown = normalized.slice(match[0].length);
  return {
    bodyMarkdown,
    frontmatterText,
    frontmatter: parsed.data,
    parseError: parsed.error
  };
}
