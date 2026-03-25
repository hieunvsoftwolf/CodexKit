import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createInstallState,
  createManagedFileRecord,
  createReleaseManifest,
  type InstallState,
  type ManagedFileRecord,
  type ReleaseManifest
} from "../../../codexkit-importer/src/index.ts";
import type { PackagingRepoClass } from "./packaging-contracts.ts";
import type { ManagedTemplateFile } from "./phase8-managed-content.ts";

export interface Phase8InstallMetadataPaths {
  releaseManifestPath: string;
  installStatePath: string;
  importRegistryPath: string;
}

function parseJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function resolvePhase8MetadataPaths(rootDir: string): Phase8InstallMetadataPaths {
  return {
    releaseManifestPath: path.join(rootDir, ".codexkit", "manifests", "release-manifest.json"),
    installStatePath: path.join(rootDir, ".codexkit", "state", "install-state.json"),
    importRegistryPath: path.join(rootDir, ".codexkit", "manifests", "import-registry.json")
  };
}

export function readInstallState(rootDir: string): InstallState | null {
  return parseJsonFile<InstallState>(resolvePhase8MetadataPaths(rootDir).installStatePath);
}

export function readReleaseManifest(rootDir: string): ReleaseManifest | null {
  return parseJsonFile<ReleaseManifest>(resolvePhase8MetadataPaths(rootDir).releaseManifestPath);
}

export function createReleaseManifestFromTemplates(templates: ManagedTemplateFile[], generatedAt?: string): ReleaseManifest {
  const files: ManagedFileRecord[] = templates.map((template) => createManagedFileRecord(template.path, template.content, template.class));
  return createReleaseManifest({
    ...(generatedAt ? { generatedAt } : {}),
    files
  });
}

export function writePhase8InstallMetadata(input: {
  rootDir: string;
  repoClass: PackagingRepoClass;
  installOnly: boolean;
  releaseManifest: ReleaseManifest;
  managedFiles: ManagedFileRecord[];
  installedAt?: string;
  updatedAt?: string;
}): InstallState {
  const paths = resolvePhase8MetadataPaths(input.rootDir);
  mkdirSync(path.dirname(paths.releaseManifestPath), { recursive: true });
  mkdirSync(path.dirname(paths.installStatePath), { recursive: true });
  writeFileSync(paths.releaseManifestPath, toJson(input.releaseManifest), "utf8");
  const installState = createInstallState({
    repoClass: input.repoClass,
    installOnly: input.installOnly,
    releaseManifestPath: path.relative(input.rootDir, paths.releaseManifestPath).replace(/\\/g, "/"),
    sourceRegistryPath: path.relative(input.rootDir, paths.importRegistryPath).replace(/\\/g, "/"),
    managedFiles: input.managedFiles,
    ...(input.installedAt ? { installedAt: input.installedAt } : {}),
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {})
  });
  writeFileSync(paths.installStatePath, toJson(installState), "utf8");
  return installState;
}
