# CodexKit Workspace

This workspace is the active planning and porting repo for `CodexKit`.

`CodexKit` is a Codex-first runtime that aims to preserve ClaudeKit workflow parity on top of Codex CLI:

- durable runs, tasks, claims, approvals, and mailbox state
- plan-first execution with `plan.md` and `phase-*.md`
- worker isolation via worktrees
- workflow continuity through `cdx resume` and explicit plan-path re-entry
- imported ClaudeKit roles, skills, rules, and templates

## Current Layout

- `docs/` — product, runtime, workflow, and compatibility specs for CodexKit
- `.claude/` — ClaudeKit source material used as parity reference
- `knowledge/claudekit-source/` — host-neutral ClaudeKit source knowledge seed
- `plans/` — planning artifacts and reports
- `claudekit-engineer-main/` — upstream/reference boilerplate snapshot

## Ground Rules

- read this file before planning or implementation
- treat `.claude/**` as source behavior for ClaudeKit parity decisions
- treat `docs/**` as the working source of truth for CodexKit design
- keep OpenCode-port reference material separate from CodexKit execution scope

## Current Priorities

1. lock CodexKit runtime and workflow contracts against ClaudeKit source behavior
2. preserve core ClaudeKit workflow parity for `brainstorm`, `plan`, `cook`, `fix`, `debug`, `review`, `test`, and `team`
3. keep continuation deterministic through ledger state, plan files, and explicit handoff commands

## Important Parity Rules

- `cdx cook` defaults to interactive behavior unless an explicit mode says otherwise
- `cdx fix` preserves ClaudeKit's autonomous-first mode chooser; autonomous is the recommended/default selection, but a bare fix request may still prompt for mode selection
- downstream runs do not inherit `auto` approval implicitly; they inherit it only when the source workflow emits it explicitly
- plan files are the persistent portability layer across sessions
- parity or release claims are valid only when backed by the metrics and evidence bundles in `docs/non-functional-requirements.md`

## Reference Starting Points

- `docs/project-overview-pdr.md`
- `docs/non-functional-requirements.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/workflow-parity-core-spec.md`
- `docs/workflow-extended-and-release-spec.md`
