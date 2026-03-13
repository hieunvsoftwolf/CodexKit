# Workflow Parity Core Spec (Phase 5)

**Project**: CodexKit  
**Scope**: Phase 5 workflow parity core  
**Last Updated**: 2026-03-13  
**Status**: Draft

## 1) Purpose

Define the Phase 5 implementation contract for the first three migration-critical workflows:

- `cdx brainstorm`
- `cdx plan`
- `cdx cook`

Phase 5 exists to make these workflows usable on Codex with the same user-facing flow, gate semantics, plan artifacts, and task handoff expectations ClaudeKit users already know.

Public CLI syntax uses `cdx brainstorm`, `cdx plan`, and `cdx cook`. Public and internal workflow references in this spec should use the same space-separated command form unless a ClaudeKit source identifier is being quoted verbatim.

This spec turns the source behavior in:

- `docs/project-overview-pdr.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`
- `.claude/skills/brainstorm/SKILL.md`
- `.claude/skills/plan/SKILL.md`
- `.claude/skills/cook/SKILL.md`
- `.claude/skills/cook/references/workflow-steps.md`
- `.claude/skills/plan/references/task-management.md`
- `.claude/agents/planner.md`

into a concrete CodexKit runtime contract.

## 2) Phase 5 Scope

In scope:

- terminal execution for `cdx brainstorm`, `cdx plan`, `cdx cook`
- workflow checkpointing and user gates
- plan generation with valid `plan.md` and `phase-*.md`
- task graph hydration bootstrap
- implementation orchestration through the post-implementation checkpoint
- required artifact/report output at each checkpoint
- brainstorm-to-plan and plan-to-cook handoff rules

Out of scope:

- review workflow parity
- test workflow parity
- debug workflow parity
- team workflow parity
- packaging and migration installer UX
- full sync-back/finalize behavior after implementation

Phase boundary:

- Phase 5 must get `cdx cook` from input to implementation completion.
- Later workflow stages are specified in later phases and are intentionally excluded here.

## 3) Phase 5 Outcome

Phase 5 is complete only if all of the following are true:

- `cdx brainstorm` can produce a durable decision report and hand off to `cdx plan`
- `cdx plan` can produce a valid plan folder with `plan.md` and phase files
- `cdx plan` can hydrate a usable task graph when the plan is large enough
- `cdx cook` can detect mode, reuse or hydrate tasks, run research/planning when needed, and execute work through the post-implementation gate
- every user-visible checkpoint has a deterministic artifact/report bundle or an explicit `no-file` rule

### 3.1 Phase 5 NFR Coverage

Phase 5 is the first workflow phase that must satisfy the workflow-level metrics in `docs/non-functional-requirements.md`.

- `NFR-1` for deterministic handoff, explicit re-entry, and no hidden approval leakage across `brainstorm`, `plan`, and `cook`
- `NFR-3` for prompt suppression, blocking diagnostics, handoff clarity, and operator decision budget
- `NFR-5.2` for durable terminal-state artifacts on the core workflows in scope
- `NFR-6` for handoff bundle completeness and fresh-session continuity quality from `brainstorm -> plan` and `plan -> cook`

## 4) Shared Runtime Contract

### 4.1 Run Model

Each command invocation creates one workflow run. The run owns:

- workflow name
- selected mode
- current checkpoint
- artifact refs
- approval records
- active plan pointer if present

The runtime ledger is authoritative for in-run state. Markdown plans remain the persistent portability layer.

### 4.2 Workflow Handoff and Worker Sessions

Workflow continuity is state-driven:

- the run ledger is authoritative for handoff, resume, checkpoint, and approval state
- worker continuity is never modeled as "reuse the same Codex transcript or terminal session"
- each worker attempt gets a fresh Codex process/session launched from a compiled bundle
- accepted handoff such as brainstorm -> plan creates a new downstream run linked to the upstream run by artifact refs and inherited context
- approval policy is scoped to the current run and never bleeds into a downstream run unless the workflow source explicitly emits that handoff policy
- if the user accepts the handoff in interactive mode, the CLI remains attached and starts the downstream run immediately without forcing a second shell command
- `cdx resume` attaches to an interrupted run and may re-spawn fresh workers with the same run/task identifiers and updated compiled context
- ClaudeKit-style continuation must also support explicit absolute plan-path re-entry such as `cdx cook /abs/path/to/plan.md` after a cleared or fresh session

### 4.3 Path Resolution

Artifact output uses the resolver below:

1. If an active plan directory exists, write workflow reports under `{planDir}/reports/`
2. If the workflow is creating a new plan, write transient reports to the run artifact path until the plan dir exists, then move or re-register them under `{planDir}/reports/`
3. If no plan exists and no plan will be created, keep artifacts in the run artifact path managed by the artifact service

Suggested-plan rule:

- a branch-matched `Suggested:` plan is a hint only, not an active plan pointer
- suggested plans must be stored separately from the active plan state
- suggested plans must not redirect report output under that plan dir until the user explicitly activates or continues them

Handoff output rule:

- whenever a workflow expects continuation in a fresh session, the CLI must emit an absolute plan path handoff string rather than rely on ambient session memory alone

### 4.4 Checkpoint Rules

A checkpoint is complete only when:

- required work for the stage is finished
- required artifacts are published or the spec marks the stage `no-file`
- any blocking approval for the stage is resolved
- the run checkpoint pointer advances

Workflow checkpoint response codes:

- `approved`
- `revised`
- `aborted`

Runtime approval records remain broader and follow the Phase 1 and Phase 3 specs:

- `pending`
- `approved`
- `revised`
- `rejected`
- `aborted`
- `expired`

### 4.5 Checkpoint Naming

Phase 5 must use stable checkpoint ids so resume and audit stay deterministic:

- `brainstorm-discovery`
- `brainstorm-decision`
- `brainstorm-handoff`
- `plan-context`
- `plan-draft`
- `plan-hydration`
- `cook-mode`
- `post-research`
- `post-plan`
- `implementation`
- `post-implementation`

## 5) `cdx brainstorm`

### 5.1 Goal

Recreate ClaudeKit brainstorming as an advise-first workflow that:

- clarifies the problem
- evaluates multiple approaches
- produces a concise decision report
- optionally hands off directly to planning

`cdx brainstorm` never implements code.

### 5.2 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| B0 | run start | No | Normalize topic, constraints, naming context |
| B1 | `brainstorm-discovery` | No | Problem statement, constraints, success criteria captured |
| B2 | `brainstorm-decision` | Yes | Options compared, recommendation ready |
| B3 | report publish | No | Decision report written and registered as artifact |
| B4 | `brainstorm-handoff` | Yes | User chooses stop or continue to `cdx plan` |

### 5.3 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| B0 | none | Run metadata only |
| B1 | none | Discovery can stay in run state unless external research is invoked |
| B2 | `decision-report.md` draft | Must include problem, options, trade-offs, recommendation |
| B3 | `decision-report.md` final | Durable report artifact |
| B4 | handoff record | Can be stored as approval response, no separate file required |

### 5.4 Decision Report Minimum Shape

The final brainstorm report must include:

- problem statement and constraints
- evaluated approaches with pros/cons
- chosen recommendation and rationale
- implementation considerations and risks
- success criteria
- next step recommendation

If the user selects planning handoff, the report artifact id must be attached to the `cdx plan` run context.

## 6) `cdx plan`

### 6.1 Goal

Recreate ClaudeKit planning as a workflow that:

- resolves active plan context correctly
- produces `plan.md` and `phase-*.md`
- optionally runs research first
- preserves ClaudeKit planning modes and subcommands
- hydrates tasks by default
- emits a direct handoff command for `cdx cook`

`cdx plan` never implements code.

### 6.2 Public Command Surface

Phase 5 must preserve the public `plan` command surface users already have in ClaudeKit:

- `cdx plan <task>`
- `cdx plan <task> --auto|--fast|--hard|--parallel|--two [--no-tasks]`
- `cdx plan validate <plan-path>`
- `cdx plan red-team <plan-path>`
- `cdx plan archive [plan-path-or-selection]`

CodexKit may implement these through one workflow engine plus helper adapters, but the public command shapes must remain stable.

### 6.3 Mode Contract

| Mode | Research | Red-team | Validation | Expected handoff |
|---|---|---|---|---|
| `auto` | auto-detected | follows selected mode | follows selected mode | emit cook handoff for the resolved mode; do not assume sticky `auto` |
| `fast` | skipped | skipped | skipped | emit `cdx cook --auto <abs-plan-path>` |
| `hard` | required | required | optional but recommended | emit `cdx cook <abs-plan-path>` |
| `parallel` | required | required | optional | emit `cdx cook --parallel <abs-plan-path>` and preserve parallel-safe ownership and dependency data |
| `two` | 2+ approaches required | after approach selection | after approach selection | after selection emit `cdx cook <abs-plan-path>` unless a later explicit validation step upgrades to auto |

`--no-tasks` disables hydration after plan generation but does not skip plan file creation.

### 6.4 Default Plan Creation Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| P0 | `plan-context` | No | Detect active/suggested/none plan state without auto-activating suggested plans |
| P1 | operation select | No | Default planning path selected instead of `validate`, `red-team`, or `archive` |
| P2 | mode select | No | Resolve planning mode and whether research is needed |
| P3 | evidence gather | No | Research/scout bundle ready or skipped by mode |
| P4 | `plan-draft` | No | `plan.md` and phase files created |
| P5 | challenge cycle | Conditional | Red-team and validation results are applied inline to `plan.md` and phase files when the selected mode requires them |
| P6 | `plan-hydration` | No | Task graph hydrated or explicitly skipped |
| P7 | handoff output | No | Emit absolute plan path for `cdx cook` and any mode hints |

At `P0`, a `Suggested:` plan must remain a branch hint only. It does not become the active plan, it does not switch report paths, and it does not change downstream handoff until the user explicitly continues or activates it.

### 6.5 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| P0 | none | Context resolution only |
| P1 | none | Operation choice stored in run state |
| P2 | none | Mode stored in run state |
| P3 | optional research/scout reports | Required only if that work ran |
| P4 | `plan.md` | Must include YAML frontmatter |
| P4 | `phase-XX-*.md` set | One file per executable phase |
| P5 | updated `plan.md` | Required when red-team or validation runs; append `## Red Team Review` and/or `## Validation Log` in the same durable plan artifact |
| P5 | optional updated `phase-XX-*.md` set | Required when accepted red-team findings or validation answers propagate into phase files |
| P6 | `task-hydration-report.md` | Required if hydration ran |
| P7 | none | CLI handoff string plus plan artifact refs |

### 6.6 `plan.md` Contract

Every `plan.md` must include YAML frontmatter with:

- `title`
- `description`
- `status`
- `priority`
- `effort`
- `branch`
- `created`

Recommended when available:

- `issue`
- `tags`

New plans always start with:

- `status: pending`

### 6.7 Phase File Contract

Each phase file must be specific enough for execution handoff. Minimum sections:

- overview
- requirements
- related code files
- implementation steps
- todo checklist
- success criteria
- risk notes

The phase checklist is the persistent source for later task hydration and later sync-back.

### 6.8 Subcommand Contracts

`cdx plan validate <plan-path>` must:

- load the referenced plan and phase files
- run a critical-question interview against the plan
- append or update a durable `## Validation Log` section in `plan.md`
- propagate accepted changes into referenced phase files inline when the answers affect execution
- return either `valid`, `revise`, or `blocked`
- treat `plan.md` and the updated phase files as the parity-critical durable artifacts; a transient run summary may exist, but no standalone validation report file is required for ClaudeKit parity
- if the plan is accepted, emit an absolute `cdx cook --auto <plan-path>` handoff because validated plans in ClaudeKit are treated as safe to skip review gates on entry

`cdx plan red-team <plan-path>` must:

- run an adversarial review against the plan
- focus on hidden risks, security, rollback, dependency gaps, and scope weakness
- append a durable `## Red Team Review` section in `plan.md`
- feed accepted findings back into the same plan folder and affected phase files rather than forking a new workflow family
- treat `plan.md` and any updated phase files as the parity-critical durable artifacts; a transient run summary may exist, but no standalone red-team report file is required for ClaudeKit parity
- if the plan remains active after red-team, recommend `cdx plan validate <plan-path>` first and only then emit `cdx cook --auto <plan-path>` when that validation path is accepted

`cdx plan archive [plan-path-or-selection]` must:

- identify the target plan or present an explicit selection step
- publish a journal/archive summary
- mark the plan archived without mutating historical report contents
- preserve enough metadata for later `resume` and migration audit

## 7) `cdx cook`

### 7.1 Phase 5 Boundary

This spec defines `cdx cook` only through the post-implementation gate.

Included here:

- mode detection
- optional research
- optional planning
- implementation orchestration
- task reuse and re-hydration
- post-research, post-plan, post-implementation gates

Excluded here:

- downstream validation/finalize stages after implementation

### 7.2 Supported Behavior in Phase 5

The mode parser must accept ClaudeKit-compatible inputs. Phase 5 must define behavior through implementation for:

- `interactive`
- `auto`
- `fast`
- `parallel`
- `no-test`
- `code`

`code` means an existing `plan.md` or `phase-*.md` path was supplied.
If no explicit flag or keyword selects another mode, default to `interactive`, matching ClaudeKit cook behavior.

### 7.3 Flow

| Step | Checkpoint | Gate | Required result |
|---|---|---|---|
| C0 | `cook-mode` | No | Detect mode and active plan path |
| C1 | research | No | Run research if mode requires it |
| C2 | `post-research` | Yes except `auto` | Research approved, revised, or aborted |
| C3 | planning | No | Reuse existing plan or generate one |
| C4 | `post-plan` | Yes except `auto` | Plan approved, revised, or aborted |
| C5 | `implementation` | No | Tasks claimed or hydrated, code work executed |
| C6 | `post-implementation` | Yes except `auto` | Implementation summary approved, revised, or aborted |

### 7.4 Required Artifacts

| Checkpoint | Required artifact | Notes |
|---|---|---|
| C0 | none | Mode and path resolution only |
| C1 | optional research reports | Required only if research ran |
| C2 | `research-summary.md` | Required when research ran and a gate is shown |
| C3 | reused or new plan artifacts | `plan.md` and phase files if planning ran |
| C4 | `plan-summary.md` | Required when plan gate is shown |
| C5 | `implementation-summary.md` | Must list task progress, touched files, unresolved blockers |
| C6 | none | Approval record is enough |

### 7.5 Mode Semantics Through Implementation

| Mode | Research | Planning | Implementation style | Gates |
|---|---|---|---|---|
| `interactive` | yes | yes | sequential | all three |
| `auto` | yes | yes | sequential or grouped | no human stops |
| `fast` | no | yes, minimal | sequential | post-plan, post-implementation |
| `parallel` | optional | yes, with dependency/ownership emphasis | grouped execution | all three when the checkpoint exists |
| `no-test` | yes | yes | sequential | same as interactive through the post-implementation gate; later testing is skipped in downstream phases |
| `code` | no | reuse existing | execute plan directly | post-implementation only before leaving phase 5 scope |

## 8) Task Graph Hydration Rules

### 8.1 Source of Truth

Hydration uses this authority order:

1. live runtime tasks for the same run and same `planDir`
2. markdown phase files for persistent unchecked work
3. explicit user revisions made at a gate in the current run

Rule:

- never create duplicate tasks when matching live tasks already exist
- never hydrate checked `[x]` items

### 8.2 When Hydration Runs

Hydration runs in two places:

- after `cdx plan` writes plan files, unless `--no-tasks`
- inside `cdx cook` implementation entry when no reusable live task graph exists

Skip hydration when:

- the plan has fewer than 3 executable phases
- the user explicitly disables task creation in planning
- live tasks already cover all remaining executable phases

### 8.3 Hydration Unit

Default unit is phase-level, not checkbox-line-level.

Required behavior:

- create one task per executable phase file
- create child tasks only for explicit high-risk or critical steps when the plan calls them out
- keep low-value leaf checklist items in markdown only

This keeps parity on user outcome while avoiding noisy runtime graphs.

### 8.4 Required Task Metadata

Every hydrated task must include:

- `phase`
- `priority`
- `effort`
- `planDir`
- `phaseFile`

Optional when available:

- `step`
- `critical`
- `riskLevel`
- `ownership`

### 8.5 Dependency Rules

Default chain:

- phase 1 has no blockers
- each later phase is blocked by the previous executable phase

Parallel adaptation:

- independent phases may be unblocked together
- ownership boundaries must be attached before execution starts
- the hydration report must state which phases are parallel-safe

### 8.6 `cdx cook` Pickup Rules

At implementation start, `cdx cook` must:

1. call task listing for the current run or active plan
2. reuse matching ready or in-progress tasks if they exist
3. hydrate from markdown only when the reusable set is empty or incomplete
4. mark claimed tasks `in_progress` before code changes begin

### 8.7 Phase 5 Persistence Limitation

Phase 5 includes hydration bootstrap, not full markdown sync-back.

Implication:

- same-run resume is supported from the runtime ledger
- new-run re-hydration can trust only markdown state
- partially completed implementation work that was not synced back yet is not guaranteed to reconstruct perfectly across a fresh run
- the CLI must therefore keep `cdx cook <absolute-plan-path>` usable as a first-class cross-session continuation path

Full reconciliation of completed runtime tasks back into all phase files belongs to the later sync-back phase.

## 9) Checkpoint Artifact Matrix

| Workflow | Checkpoint | Blocking gate | Required artifact/report |
|---|---|---|---|
| `cdx brainstorm` | `brainstorm-discovery` | No | none |
| `cdx brainstorm` | `brainstorm-decision` | Yes | `decision-report.md` draft/final |
| `cdx brainstorm` | `brainstorm-handoff` | Yes | approval response only |
| `cdx plan` | `plan-context` | No | none |
| `cdx plan` | `plan-draft` | No | `plan.md`, `phase-XX-*.md` |
| `cdx plan` | challenge cycle | Conditional | inline `plan.md` and phase-file updates when red-team or validation runs |
| `cdx plan` | `plan-hydration` | No | `task-hydration-report.md` when hydration runs |
| `cdx cook` | `cook-mode` | No | none |
| `cdx cook` | `post-research` | Yes except `auto` | `research-summary.md` when research runs |
| `cdx cook` | `post-plan` | Yes except `auto` | `plan-summary.md` when planning runs |
| `cdx cook` | `implementation` | No | `implementation-summary.md` |
| `cdx cook` | `post-implementation` | Yes except `auto` | approval response only |

## 10) Acceptance Criteria

Phase 5 implementation passes this spec only if:

- `cdx brainstorm` can finish with a durable decision report and pass that artifact into a planning run
- `cdx plan` always writes valid `plan.md` frontmatter and phase files before hydration starts
- `cdx plan` preserves ClaudeKit-style red-team and validation persistence by updating `plan.md` and affected phase files inline instead of forking standalone parity-critical report files
- `cdx plan` hydration never duplicates existing live tasks for the same plan
- `cdx cook` starts implementation by reusing live tasks first, then re-hydrating only if needed
- `cdx cook` interactive mode stops at post-research, post-plan, and post-implementation gates
- `cdx cook` auto mode reaches post-implementation without waiting on human approval
- every completed checkpoint leaves a durable audit trail through artifact publication, approval records, or explicit `no-file` semantics
- phase 5 docs and code do not claim parity for workflows intentionally deferred to later phases
- all Phase 5-owned metrics in `docs/non-functional-requirements.md` pass on supported core workflow fixtures

## 11) Unresolved Questions

- Whether `decision-report.md`, `research-summary.md`, `plan-summary.md`, and `implementation-summary.md` should be normalized into one shared summary schema or stay workflow-specific in V1
- Whether `cdx cook --auto` in phase 5 should stop after the first approved implementation phase or continue phase-by-phase until a later-phase boundary is reached
