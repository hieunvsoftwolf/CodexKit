#!/usr/bin/env node
import process from "node:process";
import { readFile } from "node:fs/promises";

import { loadClaudekitSourceGraph } from "./lib/claudekit-source-graph-io.mjs";
import { analyzeSourceImpact } from "./lib/claudekit-source-graph-maintenance.mjs";

async function readSourceList(filePath) {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function parseArgs(argv) {
  const options = {
    graphDir: "knowledge/claudekit-source",
    json: false,
    sourcePaths: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--graph-dir") {
      options.graphDir = argv[index + 1];
      index += 1;
    } else if (value === "--from-file") {
      options.sourcePaths.push(...await readSourceList(argv[index + 1]));
      index += 1;
    } else if (value === "--json") {
      options.json = true;
    } else {
      options.sourcePaths.push(value);
    }
  }

  return options;
}

function printList(label, values) {
  console.log(`${label}: ${values.length}`);
  values.forEach((value) => console.log(`- ${value}`));
}

async function main() {
  const options = await parseArgs(process.argv.slice(2));

  if (options.sourcePaths.length === 0) {
    console.error("Usage: claudekit-source-impact.mjs [--graph-dir <path>] [--from-file <list>] [--json] <source-path>...");
    process.exitCode = 1;
    return;
  }

  const graph = await loadClaudekitSourceGraph(options.graphDir);
  const impact = analyzeSourceImpact(graph, options.sourcePaths);

  if (options.json) {
    console.log(JSON.stringify(impact, null, 2));
    return;
  }

  console.log("ClaudeKit Source Graph Impact");
  printList("Requested sources", impact.requestedSourcePaths);
  printList("Matched sources", impact.matchedSourcePaths);
  printList("Unmatched sources", impact.unmatchedSourcePaths);
  printList("Evidence to rescout", impact.evidenceIds);
  printList("Nodes to review", impact.nodeIds);
  printList("Edges to review", impact.edgeIds);
  printList("Adjacent edges to spot-check", impact.adjacentEdgeIds);
  console.log("Update order: nodes -> evidence -> edges -> graph-manifest");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
