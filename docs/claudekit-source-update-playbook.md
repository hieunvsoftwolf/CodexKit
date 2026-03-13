# ClaudeKit Source Graph Update Playbook

Use this when ClaudeKit source changes and the knowledge graph must stay reusable as source-of-truth.

## Goal

Keep `knowledge/claudekit-source/` aligned with ClaudeKit source while preserving:

- host-neutral ids
- evidence-backed claims
- stable query behavior for future CLI and IDE ports

## Fast Update Flow

1. Identify changed ClaudeKit source files.
2. Run impact scan:
   `npm run impact:claudekit-source-graph -- <changed-source-paths...>`
3. Rescout only matched source files plus any adjacent edges that need semantic spot-checking.
4. Update graph files in strict order:
   `nodes.jsonl -> evidence.jsonl -> edges.jsonl -> graph-manifest.json`
5. Run automated gates:
   - `npm run validate:claudekit-source-graph`
   - `npm run validate:claudekit-source-graph:wave1`
   - `npm run smoke:claudekit-source-graph`
   - `npm test`
6. Run the manual checklist and refresh the audit report.

## Command Notes

### Impact Scan

Use repo-relative paths from `git diff --name-only` or explicit file paths:

```bash
npm run impact:claudekit-source-graph -- .claude/skills/cook/SKILL.md .claude/skills/team/SKILL.md
```

Optional list-file mode:

```bash
npm run impact:claudekit-source-graph -- --from-file changed-files.txt
```

The impact report tells you:

- which evidence rows must be rescanned
- which nodes and edges are directly affected
- which adjacent edges should be spot-checked

### Query Smoke

Run:

```bash
npm run smoke:claudekit-source-graph
```

This verifies the port-critical query contract stays intact:

- canonical handoffs
- core workflow outputs
- `AskUserQuestion` coverage
- `Task*` and `Team*` runtime coverage
- hook-injected context dependencies
- finalize to git handoff

## Change Discipline

- Do not rename ids unless semantics actually changed.
- Do not invent filenames when source only supports an artifact contract.
- Do not add host-specific `maps_to` projections in this source graph.
- Do not keep placeholder checksum or line spans.
- If meaning becomes weaker after an upstream change, downgrade to `manual-review` or defer it.

## Done Criteria

An update is done only when:

- validators pass
- smoke queries pass
- tests pass
- manual checklist passes
- audit report is refreshed

## Unresolved Questions

- none
