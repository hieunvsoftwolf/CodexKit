import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function readJsonLines(filePath) {
  const content = await readText(filePath);
  const records = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      const prefix = `${path.relative(process.cwd(), filePath)}:${index + 1}`;
      throw new Error(`${prefix}: invalid JSONL record (${error.message})`);
    }
  });

  return records;
}

export async function sha256ForFile(filePath) {
  const content = await readFile(filePath);
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function loadClaudekitSourceGraph(graphDir) {
  const absoluteGraphDir = path.resolve(graphDir);
  const repoRoot = path.resolve(absoluteGraphDir, "..", "..");
  const manifestPath = path.join(absoluteGraphDir, "graph-manifest.json");
  const manifest = await readJson(manifestPath);

  const filePaths = {
    manifest: manifestPath,
    nodes: path.join(absoluteGraphDir, manifest.files.nodes),
    edges: path.join(absoluteGraphDir, manifest.files.edges),
    evidence: path.join(absoluteGraphDir, manifest.files.evidence),
    manifestSchema: path.join(absoluteGraphDir, manifest.schemas.manifest),
    nodeSchema: path.join(absoluteGraphDir, manifest.schemas.node),
    edgeSchema: path.join(absoluteGraphDir, manifest.schemas.edge),
    evidenceSchema: path.join(absoluteGraphDir, manifest.schemas.evidence)
  };

  return {
    absoluteGraphDir,
    repoRoot,
    manifest,
    filePaths,
    schemas: {
      manifest: await readJson(filePaths.manifestSchema),
      node: await readJson(filePaths.nodeSchema),
      edge: await readJson(filePaths.edgeSchema),
      evidence: await readJson(filePaths.evidenceSchema)
    },
    nodes: await readJsonLines(filePaths.nodes),
    edges: await readJsonLines(filePaths.edges),
    evidence: await readJsonLines(filePaths.evidence)
  };
}
