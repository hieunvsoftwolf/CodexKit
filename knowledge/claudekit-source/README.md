# ClaudeKit Source Knowledge Graph

This directory stores host-neutral ClaudeKit source knowledge.

It is intentionally outside the CodexKit execution roadmap and runtime state.
Use it as reusable input for future Codex or OpenCode port projects.

## Files

- `graph-manifest.json`: graph metadata and file inventory
- `schemas/graph-manifest.schema.json`: JSON Schema for the manifest
- `schemas/node.schema.json`: JSON Schema for node records
- `schemas/edge.schema.json`: JSON Schema for edge records
- `schemas/evidence.schema.json`: JSON Schema for evidence records
- `nodes.jsonl`: one JSON object per node
- `edges.jsonl`: one JSON object per edge
- `evidence.jsonl`: one JSON object per evidence record

## Graph Rules

- keep records host-neutral
- store ClaudeKit source meaning, not Codex runtime state
- prefer one fact per record
- every node and edge should be backed by at least one evidence record
- append new records; avoid in-place rewrites unless fixing bad seed data

## Current Scope

Wave 1 core coverage plus Wave 2 Batch 0, Batch 1, and Batch 2 additions are active:

- 70 nodes
- 82 edges
- 159 evidence rows
- core agents, workflows, rules, artifacts, gates, handoffs, and runtime/tool references for ClaudeKit source
- Wave 2 baseline research workflow/resource coverage, first-class plan template nodes, and support workflow modeling for docs, scout, and preview
- validation and regression tests for future updates

This JSONL set is the validated source of truth for any future importer, graph database init, SQLite cache, CLI projection, or IDE projection.

## Validation

Before treating this directory as reusable source knowledge, run:

- `npm run validate:claudekit-source-graph`
- `npm run validate:claudekit-source-graph:wave1`
- `npm run smoke:claudekit-source-graph`
- `npm test`

Manual review should also use:

- `docs/claudekit-source-wave-1-verification-contract.md`
- `docs/claudekit-source-wave-1-review-checklist.md`
- `docs/claudekit-source-wave-1-audit-report.md`
- `docs/claudekit-source-update-playbook.md`

## Update Rule

When ClaudeKit source changes:

1. run `npm run impact:claudekit-source-graph -- <changed-source-paths...>`
2. rescout only affected source files
3. update `nodes.jsonl`
4. update `evidence.jsonl`
5. update `edges.jsonl`
6. run automated validation, smoke, and tests
7. run the manual checklist and refresh the audit report
8. update `graph-manifest.json` last
9. validate again before any downstream graph import/init
