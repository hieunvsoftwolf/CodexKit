#!/usr/bin/env node
import process from "node:process";

import { loadClaudekitSourceGraph } from "./lib/claudekit-source-graph-io.mjs";
import { validateClaudekitSourceGraph } from "./lib/claudekit-source-graph-checks.mjs";

function parseArgs(argv) {
  const options = {
    graphDir: "knowledge/claudekit-source",
    profile: "base"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--graph-dir") {
      options.graphDir = argv[index + 1];
      index += 1;
    } else if (value === "--profile") {
      options.profile = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const graph = await loadClaudekitSourceGraph(options.graphDir);
  const result = await validateClaudekitSourceGraph(graph, { profile: options.profile });

  console.log(`Profile: ${result.summary.profile}`);
  console.log(`Counts: nodes=${result.summary.nodes} edges=${result.summary.edges} evidence=${result.summary.evidence}`);

  if (result.warnings.length > 0) {
    console.log(`Warnings: ${result.warnings.length}`);
  }

  if (result.errors.length > 0) {
    console.error(`Validation failed with ${result.errors.length} error(s):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
