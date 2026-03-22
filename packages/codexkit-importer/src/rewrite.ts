import { CLAUDE_TOOL_REWRITES } from "./constants.ts";

export function splitToolList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeToolName(tool: string): string {
  const match = /^([A-Za-z0-9_-]+)/.exec(tool);
  return (match?.[1] ?? tool).trim();
}

export function collectCompatRewrites(bodyMarkdown: string, tools: string[]): string[] {
  const source = `${tools.join(" ")}\n${bodyMarkdown}`;
  const rewrites = new Set<string>();
  for (const rule of CLAUDE_TOOL_REWRITES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(source)) {
      rewrites.add(rule.target);
    }
  }
  return [...rewrites].sort();
}

export function extractUnknownToolReferences(bodyMarkdown: string, tools: string[], knownCapabilities: Set<string>): string[] {
  const unresolved = new Set<string>();
  for (const tool of tools.map((entry) => normalizeToolName(entry))) {
    if (tool.length === 0) {
      continue;
    }
    const capabilityKey = tool.toLowerCase();
    if (knownCapabilities.has(capabilityKey)) {
      continue;
    }
    if (collectCompatRewrites("", [tool]).length > 0) {
      continue;
    }
    unresolved.add(tool);
  }

  const hostLikeTokens = bodyMarkdown.match(/\b[A-Z][A-Za-z0-9]+(?:\([^)]+\))?\b/g) ?? [];
  for (const token of hostLikeTokens) {
    if (collectCompatRewrites("", [token]).length > 0) {
      continue;
    }
    const normalized = normalizeToolName(token);
    const capabilityKey = normalized.toLowerCase();
    if (knownCapabilities.has(capabilityKey)) {
      continue;
    }
    if (normalized.length > 2 && normalized !== "IMPORTANT") {
      unresolved.add(normalized);
    }
  }
  return [...unresolved].sort();
}

export function collectRequiredRoles(bodyMarkdown: string, knownRoles: string[]): string[] {
  const required = new Set<string>();
  const lowerBody = bodyMarkdown.toLowerCase();
  for (const role of knownRoles) {
    if (lowerBody.includes(role.toLowerCase())) {
      required.add(role);
    }
  }
  return [...required].sort();
}
