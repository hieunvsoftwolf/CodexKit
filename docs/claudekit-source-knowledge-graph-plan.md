# ClaudeKit Source Knowledge Capture Reference

**Purpose**: Capture reusable ClaudeKit source knowledge once so future ports do not need to scout the same source tree from scratch  
**Status**: Wave 1 active, Wave 2 planned  
**Last Updated**: 2026-03-13

## 1) Why This Exists

This repo contains a large amount of reusable ClaudeKit source knowledge:

- agent roles in `.claude/agents/`
- skill intent and workflow logic in `.claude/skills/`
- policy and operating rules in `.claude/rules/`
- templates and artifact shapes in `plans/templates/`

That knowledge should be captured once and kept separate from any one host runtime plan.

This document is not part of the CodexKit execution roadmap.
It is a reusable reference for future migration or port projects.

## 2) Separation Rule

Keep these concerns separate:

1. **ClaudeKit source knowledge**
- what the source kit means
- which role does what
- which workflow produces what artifacts
- which gates, handoffs, and tools exist

2. **Codex implementation**
- how CodexKit chooses to realize that behavior on Codex

3. **OpenCode implementation**
- how a future OpenCode-focused project chooses to realize that behavior on OpenCode

This document covers only layer 1.

## 3) Scope

In scope:

- reusable knowledge extracted from `.claude/**` and `plans/templates/**`
- evidence-backed nodes and edges
- graph outputs that can be regenerated deterministically
- handoff data useful for future host-specific projects

Out of scope:

- CodexKit runtime state
- worker pids, heartbeats, or task ledgers
- chat transcripts as knowledge storage
- any host-specific execution plan

## 4) Minimum Graph Model

### 4.1 Node Types

Minimum node types:

- `agent`
- `skill`
- `rule`
- `template`
- `workflow`
- `artifact`
- `gate`
- `tool_ref`
- `runtime_primitive`
- `host_assumption`
- `resource`

### 4.2 Edge Types

Minimum edge types:

- `defines`
- `uses`
- `requires`
- `produces`
- `gated_by`
- `hands_off_to`
- `delegates_to`
- `references`
- `maps_to`
- `derived_from`

### 4.3 Evidence Contract

Every node or edge must be traceable back to evidence:

- source path
- source checksum
- line span when known
- extraction method: `manual-scout`, `import-parser`, or `projection-derived`
- warning list when meaning is uncertain

## 5) Storage Shape

V1 should keep the graph simple and file-based:

```text
knowledge/
  claudekit-source/
    graph-manifest.json
    nodes.jsonl
    edges.jsonl
    evidence.jsonl
```

Why this shape:

- easy to diff
- easy to regenerate
- host-neutral from day one
- easy for future Codex or OpenCode projects to consume

## 6) Initial Capture Targets

The first useful graph does not need every file in the repo.

Initial seed capture should focus on:

- core roles: planner, researcher, debugger, tester, code-reviewer, project-manager, docs-manager, git-manager, brainstormer
- core workflows: brainstorm, plan, cook, fix, debug, review, test, team
- core rules: primary workflow, orchestration protocol, development rules, documentation management
- core artifact shapes: `decision-report.md`, `plan.md`, `phase-*.md`, review report, debug report, docs impact report, git handoff report
- core handoffs: brainstorm -> plan, plan -> cook, debug -> fix, review -> fix, finalize -> git handoff
- core runtime rewrite references: `AskUserQuestion`, `Task*`, `Team*`, `SendMessage`, hook-injected context

## 7) Recommended Capture Timing

Do now:

- define graph schema and evidence contract
- capture manual seed knowledge from current scouting and docs verification
- keep the captured data outside the CodexKit runtime execution plan

Do later in any future dedicated tooling project:

- build a deterministic extractor/exporter
- build host-specific projections from the captured source knowledge

## 8) Acceptance Criteria

The plan is successful when all of the following are true:

- core ClaudeKit sources can be represented as nodes and edges with evidence
- core workflow handoffs and artifact contracts are queryable from the graph
- future Codex or OpenCode ports can start from graph data instead of a new manual scout

## 9) Recommended Next Steps

1. Keep CodexKit execution work focused on Codex runtime phases only.
2. Capture ClaudeKit source knowledge in a host-neutral location such as `knowledge/claudekit-source/`.
3. Use this captured knowledge as input to future port projects rather than reparsing raw ClaudeKit source ad hoc.
4. Use `docs/claudekit-source-wave-2-plan.md` for the next graph-expansion stage after Wave 1.

## 10) Unresolved Questions

- Whether `nodes.jsonl` and `edges.jsonl` are enough, or whether a small SQLite graph cache is worth it later
- Whether prompt bodies should be stored raw in graph evidence or referenced by checksum plus path only
- Whether the future port projects should read directly from checked-in JSONL files or from a generated package artifact
