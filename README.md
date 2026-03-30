# CodexKit Workspace

This workspace is the active planning and porting repo for `CodexKit`.

`CodexKit` is a Codex-first runtime that aims to preserve ClaudeKit workflow parity on top of Codex CLI:

- durable runs, tasks, claims, approvals, and mailbox state
- plan-first execution with `plan.md` and `phase-*.md`
- worker isolation via worktrees
- workflow continuity through `cdx resume` and explicit plan-path re-entry
- imported ClaudeKit roles, skills, rules, and templates

## Public Beta Install and Onboarding

### Prerequisites

- Node.js 20+
- git with `git worktree` support
- Codex CLI in `PATH` (or a configured wrapper runner command)

### Canonical `npx`-first command forms

```bash
npx @codexkit/cli init
npx @codexkit/cli doctor
```

Host caveat for this machine: raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid. Use a repo-local npm cache override:

```bash
npm_config_cache="$PWD/.npm-cache" npx @codexkit/cli init
npm_config_cache="$PWD/.npm-cache" npx @codexkit/cli doctor
```

### Global install alternative

```bash
npm install -g @codexkit/cli
cdx init
cdx doctor
```

### First Workflow Quickstart

Run one end-to-end onboarding path from `init` through `brainstorm -> plan -> cook`:

- `docs/public-beta-quickstart.md`

### Wrapped Runner Setup Example

Runner resolution order:

1. env override via `CODEXKIT_RUNNER`
2. `.codexkit/config.toml` `[runner] command = "..."`
3. default built-in `codex exec`

Concrete wrapper example:

```bash
CODEXKIT_RUNNER="codex-safe exec --profile beta" cdx doctor
```

```toml
# .codexkit/config.toml
schema_version = 1
managed_by = "codexkit"

[runner]
command = "codex-safe exec --profile beta"
```

CodexKit binds to the selected runner and does not manage Codex account login state.

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

## Phase 10 Shared Contract Freeze (P10-S0)

This repo is freezing the public beta contract before implementation lanes fan out:

- public npm package identity: `@codexkit/cli`
- public bin identity: `cdx`
- runner resolution order:
  1. env override via `CODEXKIT_RUNNER`
  2. `.codexkit/config.toml` `[runner] command = "..."`
  3. default built-in `codex exec`
- `cdx doctor` must surface active runner source and effective runner command, and block with typed diagnostics when the selected runner is unavailable
- `cdx init` preview/apply must surface the active runner source and effective runner command
- public install and quickstart command forms:
  - `npx @codexkit/cli init`
  - `npx @codexkit/cli doctor`
  - `npm install -g @codexkit/cli`
  - `cdx init`
  - `cdx doctor`
- CodexKit binds to the selected runner and does not own Codex account login state

Packaging publication, docs onboarding expansion, and packaged-artifact harness implementation stay out of `P10-S0`.

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
