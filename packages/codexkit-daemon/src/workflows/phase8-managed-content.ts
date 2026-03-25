import path from "node:path";
import type { ManagedFileClass } from "../../../codexkit-importer/src/index.ts";
import { isProtectedManagedPath } from "./packaging-contracts.ts";

export interface ManagedTemplateFile {
  path: string;
  content: string;
  class: ManagedFileClass;
  protectedPath: boolean;
}

function renderAgentsFile(): string {
  return [
    "# AGENTS.md",
    "",
    "This repository is managed by CodexKit.",
    "",
    "- Keep workflow artifacts under `plans/` and `docs/`.",
    "- Run `cdx doctor` when local runtime state appears degraded.",
    "- Use `cdx update` to refresh managed CodexKit files.",
    ""
  ].join("\n");
}

function renderCodexConfig(): string {
  return [
    "# Codex project config managed by CodexKit",
    "",
    "[project]",
    "name = \"codexkit-managed\"",
    "",
    "[runtime]",
    "approval_mode = \"manual\"",
    ""
  ].join("\n");
}

function renderCodexkitConfig(): string {
  return [
    "# CodexKit runtime config",
    "",
    "schema_version = 1",
    "managed_by = \"codexkit\"",
    ""
  ].join("\n");
}

function renderReadme(repoName: string): string {
  return [
    `# ${repoName}`,
    "",
    "This repository is bootstrapped with CodexKit.",
    "",
    "## Quick Start",
    "",
    "1. Run `cdx doctor` to verify host and repo health.",
    "2. If this repository has no first commit yet, create one before worker-backed workflows.",
    "3. Use `cdx update` for managed content refreshes.",
    ""
  ].join("\n");
}

export function buildPhase8ManagedTemplates(rootDir: string): ManagedTemplateFile[] {
  const repoName = path.basename(path.resolve(rootDir)) || "codexkit-project";
  const templates: ManagedTemplateFile[] = [
    { path: "AGENTS.md", content: renderAgentsFile(), class: "protected-managed", protectedPath: true },
    { path: ".codex/config.toml", content: renderCodexConfig(), class: "protected-managed", protectedPath: true },
    { path: ".codexkit/config.toml", content: renderCodexkitConfig(), class: "managed", protectedPath: false },
    { path: ".codexkit/README.md", content: "CodexKit runtime directory.\n", class: "managed", protectedPath: false },
    { path: "README.md", content: renderReadme(repoName), class: "managed", protectedPath: false }
  ];
  return templates.map((item) => ({
    ...item,
    protectedPath: isProtectedManagedPath(item.path)
  }));
}
