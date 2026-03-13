#!/usr/bin/env node
import process from "node:process";

import { loadClaudekitSourceGraph } from "./lib/claudekit-source-graph-io.mjs";
import { runWave1SmokeQueries } from "./lib/claudekit-source-graph-maintenance.mjs";

function parseArgs(argv) {
  const options = {
    graphDir: "knowledge/claudekit-source",
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--graph-dir") {
      options.graphDir = argv[index + 1];
      index += 1;
    } else if (value === "--json") {
      options.json = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const graph = await loadClaudekitSourceGraph(options.graphDir);
  const results = runWave1SmokeQueries(graph);
  const failures = results.filter((result) => !result.ok);

  if (options.json) {
    console.log(JSON.stringify({ passed: failures.length === 0, results }, null, 2));
  } else {
    console.log("ClaudeKit Source Graph Query Smoke");
    for (const result of results) {
      const status = result.ok ? "PASS" : "FAIL";
      console.log(`- ${status} ${result.id}`);
      console.log(`  expected (${result.operator}): ${result.expected.join(", ")}`);
      console.log(`  actual: ${result.actual.join(", ") || "(none)"}`);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
