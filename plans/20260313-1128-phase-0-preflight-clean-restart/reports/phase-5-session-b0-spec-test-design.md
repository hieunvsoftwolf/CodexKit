# Phase 5 Session B0 Spec-Test-Design

**Date**: 2026-03-22
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default role contract
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `df037409230223e7813a23358cc2da993cb6c67f`

## Provenance

- source of truth used:
  - `README.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-wave-1-ready-after-planner.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md`
  - `docs/workflow-parity-core-spec.md`
  - `docs/project-roadmap.md`
  - `docs/compatibility-matrix.md`
  - `docs/verification-policy.md`
  - `docs/non-functional-requirements.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
- pinned repo state inspected:
  - `git rev-parse HEAD` -> `df037409230223e7813a23358cc2da993cb6c67f`
  - current baseline runtime floor:
    - `npm run test:runtime` -> pass (`9` files, `49` tests)
- excluded by design:
  - Session A implementation artifacts
  - candidate implementation branches or diffs
  - implementation summaries
  - reviewer output
  - any assumption derived from unverified candidate code shape

## Summary

- froze acceptance for the full Phase 5 workflow parity core spec while prioritizing Wave 1 implementation slices `P5-S0`, `P5-S1`, `P5-S2`, `P5-S3` core only, and `P5-S5`
- defined Wave 1 tester-owned execution expectations around workflow runtime contracts, CLI public surface, brainstorm, plan-core, and hydration bootstrap without weakening the eventual full Phase 5 acceptance bar
- explicitly deferred Wave 2 checks for `P5-S4`, full `P5-S6`, and `P5-S7`, but kept them as frozen pending assertions so later sessions cannot redefine acceptance around implementation shortcuts
- mapped command matrix, fixture matrix, artifact assertions, gate assertions, and NFR coverage to the spec acceptance criteria and planner decomposition
- added no verification-owned tests in B0 because the pinned base has no stable Phase 5 workflow modules, public workflow CLI, or workflow-specific harness seams yet; Session B should first execute doc-derived checks against Session A outputs unchanged

## Phase 5 Acceptance Freeze

Phase 5 passes only if all of these remain true at candidate verification time:

- `cdx brainstorm` finishes with a durable `decision-report.md` and can hand its artifact into a planning run
- `cdx plan` writes valid `plan.md` YAML frontmatter plus `phase-XX-*.md` files before any hydration begins
- `cdx plan` preserves inline `plan.md` and phase-file mutation semantics for `validate` and `red-team`; no standalone parity-critical validation or red-team report files replace those durable plan artifacts
- `cdx plan` hydration never duplicates live tasks for the same active plan
- `cdx cook` reuses live tasks before re-hydrating, and only hydrates when the reusable set is empty or incomplete
- `cdx cook` interactive mode stops at `post-research`, `post-plan`, and `post-implementation`
- `cdx cook --auto` reaches `post-implementation` without human gates
- every completed checkpoint leaves a durable audit trail via artifact publication, approval records, or explicit `no-file` semantics
- Phase 5 claims stay bounded to the workflows and workflow segments actually in scope
- all Phase 5-owned metrics for `NFR-1`, `NFR-3`, `NFR-5.2`, and core `NFR-6` pass on supported workflow fixtures

## Wave Plan

### Wave 1 runnable verification scope

- `P5-S0` workflow runtime contract layer
- `P5-S1` CLI public surface for `cdx brainstorm`, `cdx plan`, `cdx cook`, and `cdx plan validate|red-team|archive`
- `P5-S2` brainstorm workflow vertical
- `P5-S3` plan workflow core only:
  - default create flow
  - mode handling
  - plan artifact generation
  - handoff output
  - suggested-plan isolation
- `P5-S5` hydration bootstrap engine

### Wave 2 deferred checks

These are deferred from Wave 1 execution, but acceptance is frozen now:

- `P5-S4` plan subcommands:
  - inline `## Validation Log`
  - inline `## Red Team Review`
  - archive semantics
  - result states `valid|revise|blocked`
- final `P5-S6` cook through post-implementation:
  - mode detector semantics for `interactive|auto|fast|parallel|no-test|code`
  - research and planning gates
  - plan reuse versus generation
  - implementation summary contract
  - plan-to-cook pickup ordering
- `P5-S7` workflow-level NFR evidence harness:
  - dedicated evidence suites for `NFR-1`, `NFR-3`, `NFR-5.2`, and core `NFR-6`

Wave 2 deferral rule:

- if Session A introduces any partial `cook`, `validate`, `red-team`, or archive surface in Wave 1, Session B must verify it only as a typed blocked or incomplete surface unless the full spec behavior is actually implemented
- no partial behavior may be counted as Phase 5 completion evidence for deferred slices

## Exit-Criteria Mapping

| Phase 5 exit criterion | Frozen verification target |
|---|---|
| `cdx brainstorm` produces decision reports | candidate must publish durable `decision-report.md`, preserve required report shape, and support optional downstream plan handoff with artifact refs |
| `cdx plan` produces valid plan files | candidate must write `plan.md` with required frontmatter keys plus executable `phase-XX-*.md` files before hydration |
| `cdx plan` hydrates a usable task graph | candidate must create phase-level tasks by default, skip checked items, dedupe existing live tasks, and publish `task-hydration-report.md` when hydration runs |
| `cdx cook` executes feature work through implementation step | Wave 1 only freezes command and contract expectations; final execution proof is deferred to Wave 2 and must satisfy full post-implementation behavior before Phase 5 close |
| Phase 5-owned metrics pass on core workflow fixtures | candidate must satisfy applicable Wave 1 assertions now and leave no contradiction against frozen Wave 2 NFR checks later |

## Artifact Assertions

### Brainstorm

- `brainstorm-discovery`: `no-file` allowed
- `brainstorm-decision`: `decision-report.md` draft/final required before approval completes
- `brainstorm-handoff`: approval response may be artifact-free, but downstream run must carry decision artifact refs when handoff is accepted

`decision-report.md` minimum shape:

- problem statement and constraints
- evaluated approaches with pros and cons
- chosen recommendation and rationale
- implementation considerations and risks
- success criteria
- next-step recommendation

### Plan core

- `plan-context`: `no-file`
- `plan-draft`:
  - `plan.md` required
  - `phase-XX-*.md` set required
- `plan-hydration`:
  - `task-hydration-report.md` required if hydration ran
  - explicit skip state required if `--no-tasks`, fewer than 3 executable phases, or live tasks already cover remaining phases

`plan.md` frontmatter must include:

- `title`
- `description`
- `status`
- `priority`
- `effort`
- `branch`
- `created`

`plan.md` frontmatter expectation:

- new plans start with `status: pending`

Each phase file must include:

- overview
- requirements
- related code files
- implementation steps
- todo checklist
- success criteria
- risk notes

### Cook deferred

These are frozen now for later execution:

- `research-summary.md` when research ran and a research gate exists
- `plan-summary.md` when a plan gate exists
- `implementation-summary.md` at implementation completion
- approval-only semantics allowed at `post-implementation`, not silent checkpoint completion

## Gate Assertions

### Shared runtime and checkpoint assertions

- checkpoint ids must stay exact:
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
- checkpoint completion is invalid if required artifact publication is missing and the stage is not marked `no-file`
- workflow response statuses are limited to `approved|revised|aborted`
- downstream handoff inherits `auto` only when explicitly emitted by the source workflow
- suggested-plan state must not redirect report output or downstream handoff until explicit activation

### Brainstorm gate assertions

- `brainstorm-decision` is blocking
- `brainstorm-handoff` is blocking
- rejecting or revising at decision must preserve a durable decision artifact trail

### Plan core gate assertions

- default create flow has no extra human gate before `plan-draft`
- no unnecessary mode or operation prompt may appear when CLI input is unambiguous
- any blocked plan-path, unsupported command shape, or illegal mode combination must produce a typed diagnostic with one concrete next step
- handoff output after planning must emit an absolute `cdx cook ... <abs-plan-path>` command string

### Cook deferred gate assertions

- interactive mode must stop at `post-research`, `post-plan`, and `post-implementation`
- auto mode must skip human gates through `post-implementation`
- `code` mode must reuse an existing plan and only gate at `post-implementation`
- partial Wave 1 cook stubs are acceptable only if they fail or block explicitly with typed diagnostics and do not masquerade as full cook parity

## Fixture Matrix

| Fixture | Purpose | Wave | Primary slices |
|---|---|---|---|
| `F1 git-clean-workflow-core` | happy-path repo with clean git state; baseline public workflow surface | 1 | `S0`, `S1`, `S2`, `S3` |
| `F2 suggested-plan-hint` | branch-matched suggested plan exists but no active plan pointer | 1 | `S0`, `S3` |
| `F3 active-plan-existing-live-tasks` | active plan plus existing ready or in-progress tasks | 1 | `S0`, `S3`, `S5` |
| `F4 active-plan-no-live-tasks` | active plan with unchecked executable phases and no reusable tasks | 1 | `S3`, `S5` |
| `F5 plan-too-small-for-hydration` | plan has fewer than 3 executable phases | 1 | `S3`, `S5` |
| `F6 no-tasks-flag` | `cdx plan --no-tasks <task>` skips hydration but still writes plan artifacts | 1 | `S1`, `S3` |
| `F7 brainstorm-to-plan-handoff` | accepted brainstorm handoff into planning run with artifact refs | 1 | `S0`, `S1`, `S2` |
| `F8 cli-invalid-shapes` | unsupported command shapes, illegal flag combinations, bad paths | 1 | `S1` |
| `F9 fresh-session-handoff` | downstream workflow started only from absolute handoff command and artifacts | 1 | `S0`, `S2`, `S3` |
| `F10 control-state-reroute-context` | durable report path already exists and downstream routing changes | 1 informational | `S0` contract carry-forward into later tester expectations |
| `F11 plan-validate-inline-mutation` | inline validation mutation semantics | 2 | `S4` |
| `F12 plan-red-team-inline-mutation` | inline red-team mutation semantics | 2 | `S4` |
| `F13 plan-archive` | archive selection and journal/archive summary semantics | 2 | `S4` |
| `F14 cook-interactive` | research, planning, implementation, and three interactive gates | 2 | `S6` |
| `F15 cook-auto` | autonomous path with no human stops through post-implementation | 2 | `S6` |
| `F16 cook-code-reentry` | explicit `cdx cook /abs/path/to/plan.md` fresh-session continuation | 2 | `S6` |
| `F17 workflow-nfr-evidence` | timing, prompt-count, handoff-fidelity, and terminal-artifact evidence | 2 | `S7` |

## Command Matrix

### Baseline commands on pinned base

These are safe pre-candidate commands for Session B reference:

1. `git rev-parse HEAD`
2. `git status --short`
3. `npm run test:runtime`
4. `rg --files tests/runtime packages/codexkit-cli packages/codexkit-daemon packages/codexkit-core`

Expected baseline result:

- `HEAD` resolves to `df037409230223e7813a23358cc2da993cb6c67f`
- current pinned-base runtime floor passes unchanged:
  - `9` runtime files
  - `49` tests
- no stable public Phase 5 workflow implementation is expected at `BASE_SHA`

### Candidate verification order for Session B

Session B should run in this order after Session A exists:

1. confirm candidate provenance:
   - `git rev-parse HEAD`
   - `git merge-base --is-ancestor df037409230223e7813a23358cc2da993cb6c67f HEAD`
2. rerun the frozen baseline floor:
   - `npm run test:runtime`
3. inspect workflow CLI exposure and command shapes:
   - `node ./cdx --help`
   - `node ./cdx brainstorm --help`
   - `node ./cdx plan --help`
   - `node ./cdx cook --help`
4. execute Wave 1 CLI diagnostics checks against invalid inputs
5. execute brainstorm happy-path and handoff cases
6. execute plan create-flow and handoff cases
7. execute hydration dedupe, skip, and metadata cases
8. run any Phase 5-specific runtime or integration tests added by Session A
9. if Session A added partial Wave 2 surfaces, verify them only for explicit blocked or deferred behavior and record them as not yet acceptance-closing

Suggested candidate-level test command groups:

- `npm run test:integration`
- `npm run test:runtime`
- targeted Vitest invocations for any new Phase 5 workflow suites under `tests/runtime/**` or `tests/integration/**`

## Detailed Acceptance Cases

### S0. Workflow runtime contracts

`R-01 exact checkpoint ids`
- fixture: `F1`
- expect:
  - every emitted workflow checkpoint id matches the frozen list exactly
  - no alias ids or renamed ids appear in persisted run state

`R-02 run-scoped approval inheritance`
- fixture: `F7`, `F9`
- expect:
  - downstream run inherits `auto` only when explicit handoff policy says so
  - no implicit `auto` leakage across brainstorm->plan or plan->cook

`R-03 report-path resolution`
- fixture: `F1`, `F2`
- expect:
  - active plan writes to `{planDir}/reports/`
  - creating-plan flow may start with transient run-artifact output, but final registered artifacts land under the plan dir once it exists
  - suggested plan does not redirect report output

`R-04 absolute handoff rendering`
- fixture: `F7`, `F9`
- expect:
  - CLI renders absolute plan-path continuation commands whenever fresh-session continuation is expected

### S1. CLI public surface

`C-01 public commands exist`
- fixture: `F1`
- expect:
  - parser accepts `cdx brainstorm`
  - parser accepts `cdx plan`
  - parser accepts `cdx cook`
  - parser accepts `cdx plan validate`
  - parser accepts `cdx plan red-team`
  - parser accepts `cdx plan archive`

`C-02 deterministic typed diagnostics`
- fixture: `F8`
- expect:
  - every blocking CLI error includes stable code or category, plain-language cause, blocking path or command context when relevant, and one next step

`C-03 no unnecessary prompt regression`
- fixture: `F1`, `F6`
- expect:
  - explicit flags and unambiguous command shapes do not trigger extra mode or operation prompts

`C-04 deferred surface honesty`
- fixture: `F8`
- expect:
  - if `cook` or plan subcommands are not fully implemented in Wave 1, CLI reports a typed blocked or deferred state instead of silent fallback

### S2. Brainstorm vertical

`B-01 discovery to decision report`
- fixture: `F1`
- expect:
  - brainstorm captures problem statement, constraints, and success criteria
  - `decision-report.md` is published before decision gate completes

`B-02 report minimum shape`
- fixture: `F1`
- expect:
  - final report includes every required section from the spec

`B-03 accepted handoff to plan`
- fixture: `F7`
- expect:
  - accepted handoff starts or prepares a downstream planning run
  - decision artifact refs are attached to downstream context

`B-04 declined handoff`
- fixture: `F1`
- expect:
  - declining plan continuation leaves brainstorm run terminal with durable artifact trail and no accidental plan activation

### S3. Plan core

`P-01 suggested plan stays hint-only`
- fixture: `F2`
- expect:
  - `Suggested:` plan does not become active automatically
  - report paths and continuation stay bound to actual active plan state only

`P-02 plan artifact generation`
- fixture: `F1`
- expect:
  - `plan.md` and executable phase files are created before hydration
  - frontmatter keys are complete and valid

`P-03 mode-to-handoff mapping`
- fixture: `F1`, `F6`
- expect:
  - `fast` emits `cdx cook --auto <abs-plan-path>`
  - `hard` emits `cdx cook <abs-plan-path>`
  - `parallel` emits `cdx cook --parallel <abs-plan-path>`
  - `two` emits `cdx cook <abs-plan-path>` unless later validation explicitly upgrades to auto
  - `auto` does not assume sticky downstream auto unless explicit handoff rules say so

`P-04 no accidental suggested-plan activation`
- fixture: `F2`
- expect:
  - branch-matched suggestion is stored separately from active plan pointer
  - later artifact writes remain isolated from the suggested plan unless activated

`P-05 no-tasks still writes plan artifacts`
- fixture: `F6`
- expect:
  - `--no-tasks` suppresses hydration only
  - plan files still exist and handoff output still renders

### S5. Hydration bootstrap

`H-01 phase-level default hydration`
- fixture: `F4`
- expect:
  - one task per executable phase file by default
  - child tasks created only for explicit critical or high-risk steps when the plan calls them out

`H-02 skip checked work`
- fixture: `F4`
- expect:
  - checked `[x]` items never hydrate into new tasks

`H-03 dedupe existing live tasks`
- fixture: `F3`
- expect:
  - existing ready or in-progress tasks for the same run and `planDir` are reused
  - no duplicate live-task hydration occurs

`H-04 skip undersized plans`
- fixture: `F5`
- expect:
  - fewer than 3 executable phases skips hydration explicitly

`H-05 metadata contract`
- fixture: `F4`
- expect:
  - each hydrated task includes `phase`, `priority`, `effort`, `planDir`, and `phaseFile`

`H-06 dependency chain and parallel-safe reporting`
- fixture: `F4`
- expect:
  - default dependency chain blocks each later executable phase on the previous phase
  - hydration report states any parallel-safe phases when applicable

## NFR Mapping

| NFR | Frozen Phase 5 expectation | Wave |
|---|---|---|
| `NFR-1.2` | no implicit `auto` leaks into downstream runs in handoff or resume paths | 1 |
| `NFR-1.3` | no duplicate live-task hydration for the same active plan during plan-path re-entry or reuse | 1 |
| `NFR-1.5` | successful continuation returns attached run context or one explicit absolute next command | 1 |
| `NFR-3.1` | median explicit user-decision count from `cdx plan <task>` to first durable artifact remains `<=3` on happy-path fixtures | 2 evidence close |
| `NFR-3.2` | no unnecessary prompts when command line or locked context is unambiguous | 1 |
| `NFR-3.3` | all blocking CLI errors are typed diagnostics with cause and next step | 1 |
| `NFR-3.4` | first progress signal latency `p95 <=2s` for `cdx plan`, `cdx cook <plan-path>`, `cdx resume`, and `cdx doctor` | 2 evidence close |
| `NFR-5.2` | every terminal workflow run publishes durable success summary artifact or typed failure diagnostic artifact | 1 for brainstorm and plan core; 2 for cook |
| `NFR-5.6` | rerouted control-state snapshots persist before new runnable downstream prompts | 1 contract carry-forward |
| `NFR-6.1` | handoff bundles contain goal, constraints, accepted decisions, evidence refs, unresolved questions or blockers, and next action | 1 |
| `NFR-6.2` | fresh-session handoff bundles pass blinded sufficiency rubric on core workflow fixtures | 2 evidence close |
| `NFR-6.3` | no operator restatement of accepted decisions on golden handoff fixtures | 2 evidence close |
| `NFR-6.5` | persisted control-state snapshots include all required fields and accurate waiting/runnable routing | 1 contract carry-forward |

## Tester-Owned Execution Expectations

- treat this B0 artifact as frozen acceptance
- run B0-authored checks unchanged first
- do not weaken assertions to match Session A implementation shortcuts
- treat implementation summaries as context only, never as proof
- if the candidate exposes partial Wave 2 behavior, record it as deferred unless it satisfies the frozen full-spec contract
- prefer artifact inspection and CLI-observable behavior over internal implementation rationale
- if verification-only amendments are required because Session A created new stable test seams, preserve the same acceptance targets and document the gap plainly

## Verification-Owned Test Policy

- B0 adds no new tests or harness files at `BASE_SHA`
- reason:
  - pinned base lacks stable Phase 5 workflow modules
  - public workflow commands are not yet implemented on the pinned tree
  - adding tests now would require inventing future file names and seams rather than freezing behavior from the spec
- Session B may add verification-only tests only when the candidate creates stable public seams and only when those tests enforce this frozen acceptance unchanged

## Blocking Assumptions

- Session A keeps checkpoint ids and handoff semantics exact
- Session A does not claim full `cook` parity from a Wave 1-only delivery
- candidate verification can execute workflow commands in a fresh branch or worktree without relying on dirty control-session state
- any new workflow tests added by Session A remain runnable from repo root with the existing `npm run test:*` harness shape or obvious targeted Vitest commands

## Unresolved Questions

- whether Wave 1 will expose a minimal `cdx cook` command that blocks with a typed deferred diagnostic or defer public cook entry entirely until Wave 2
- whether Session A will place plan parser or writer modules under `codexkit-daemon` only or split them earlier for reuse; acceptance is behavior-bound either way
