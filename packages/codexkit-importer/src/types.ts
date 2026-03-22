export type ManifestType = "role" | "workflow" | "policy";

export type SourceKind = "role-source" | "workflow-source" | "policy-source";

export interface ImportSource {
  kind: SourceKind;
  sourcePath: string;
  absolutePath: string;
}

export interface ImportSkippedSource {
  kind: "legacy-source" | "unsupported-source" | "quarantined-source";
  sourcePath: string;
  reason: string;
}

export interface ImportDiscoveryResult {
  sources: ImportSource[];
  skillResourceIndex: Record<string, ManifestResource[]>;
  skipped: ImportSkippedSource[];
  templateDeferred: boolean;
  ckConfigPath: string | null;
  metadataPath: string | null;
  ckConfigPayload: unknown | null;
  metadataPayload: unknown | null;
  provenanceWarnings: string[];
}

export interface ParsedSource {
  source: ImportSource;
  checksum: string;
  rawContent: string;
  bodyMarkdown: string;
  frontmatter: Record<string, unknown> | null;
  frontmatterText: string | null;
  parseError: string | null;
}

export interface ManifestSource {
  path: string;
  kind: "agent-markdown" | "skill-markdown" | "rule-markdown";
  checksum: string;
  importedAt: string;
}

export interface ManifestResource {
  path: string;
  kind: "markdown-reference" | "script-resource" | "asset-resource" | "doc-resource";
  mode: "reference" | "metadata-only";
}

export interface BaseManifest {
  schemaVersion: 1;
  manifestType: ManifestType;
  id: string;
  slug: string;
  aliases: string[];
  status: "active" | "helper" | "deferred" | "legacy" | "manual-review";
  source: ManifestSource;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  resources: ManifestResource[];
  warnings: string[];
  outputPath: string;
}

export interface ImportRegistryEntry {
  manifestType: ManifestType;
  id: string;
  status: BaseManifest["status"];
  sourcePath: string;
  outputPath: string;
  checksum: string;
  warnings: string[];
}

export interface ImportRegistry {
  schemaVersion: 1;
  importedAt: string;
  sourceRoot: ".";
  sourceKit: {
    ckConfigFound: boolean;
    metadataFound: boolean;
    ckConfig: unknown | null;
    metadata: unknown | null;
  };
  summary: {
    roles: number;
    coreWorkflows: number;
    helperWorkflows: number;
    policies: number;
    legacySkipped: number;
    unsupportedSkipped: number;
    quarantined: number;
    templatesDeferred: number;
  };
  entries: ImportRegistryEntry[];
  skipped: ImportSkippedSource[];
  conflicts: Array<{ id: string; sourcePaths: string[]; reason: string }>;
  warnings: string[];
}

export interface ImportResult {
  manifests: BaseManifest[];
  registry: ImportRegistry;
  outputRoot: string;
}

export interface ImportOptions {
  rootDir: string;
  outputDir?: string;
  importedAt?: string;
  emit?: boolean;
  allowManagedTreeReplace?: boolean;
}

export interface WorkflowOverride {
  id: string;
  command: string;
}
