# Phase 5 Planner Decomposition Report

**Date**: 2026-03-22
**Phase**: Phase 5 Workflow Parity Core
**Status**: completed
**Pinned BASE_SHA**: `df037409230223e7813a23358cc2da993cb6c67f`

## Scope And Sources

Source of truth used:
- repo tree at `df037409230223e7813a23358cc2da993cb6c67f`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-freeze-complete-planner-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
- `docs/workflow-parity-core-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`

Current repo-state read for decomposition:
- CLI currently exposes runtime/operator primitives (`run/task/worker/team/message/approval/artifact/compat`), not public workflow commands (`cdx brainstorm`, `cdx plan`, `cdx cook`).
- Runtime primitives and reconciliation loop exist (Phase 1-4 substrate).
- Phase 5 workflow engine, checkpoint contracts, plan artifact generation, hydration bootstrap, and workflow-level NFR tests are still implementation scope.

## Decomposition: Implementation-Owned Slices

## Slice P5-S0: Workflow Runtime Contract Layer (shared foundation)
- ownership: workflow engine seam + checkpoint state + report-path resolver + handoff contract guardrails
- must change:
  - `packages/codexkit-core/src/domain-types.ts` (run/checkpoint metadata extensions only)
  - `packages/codexkit-core/src/services/run-service.ts`
  - `packages/codexkit-core/src/services/approval-service.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - new workflow runtime modules under `packages/codexkit-daemon/src/workflows/`
- outputs:
  - stable checkpoint ids from spec section 4.5
  - run-scoped approval inheritance rule (`auto` not leaked cross-run unless explicit handoff policy)
  - artifact path resolution contract (active plan dir vs run artifact dir)
- independent verification:
  - workflow contract integration tests for checkpoint transitions, approval inheritance, handoff metadata

## Slice P5-S1: CLI Public Surface For Brainstorm/Plan/Cook
- ownership: parser + command dispatch + typed diagnostics + absolute handoff rendering
- must change:
  - `packages/codexkit-cli/src/index.ts`
  - `packages/codexkit-cli/src/arg-parser.ts`
  - `packages/codexkit-cli/src/render.ts` (if needed for handoff formatting)
- outputs:
  - public commands accepted:
    - `cdx brainstorm ...`
    - `cdx plan ...`
    - `cdx cook ...`
    - `cdx plan validate|red-team|archive ...`
  - deterministic CLI errors for unsupported combinations per `NFR-3.3`
- independent verification:
  - CLI integration suite for command-shape + diagnostics + absolute handoff strings

## Slice P5-S2: Brainstorm Workflow Vertical
- ownership: `cdx brainstorm` orchestration only
- must change:
  - workflow modules under `packages/codexkit-daemon/src/workflows/brainstorm-*.ts`
  - artifact publication wiring in controller/workflow dispatcher
- outputs:
  - checkpoints: `brainstorm-discovery`, `brainstorm-decision`, `brainstorm-handoff`
  - durable `decision-report.md` with minimum shape
  - optional handoff to downstream `cdx plan` run with artifact refs
- independent verification:
  - integration tests assert report shape, gate behavior, handoff link correctness

## Slice P5-S3: Plan Workflow Core (create flow + mode contracts)
- ownership: `cdx plan <task>` baseline behavior, mode handling, plan artifact generation
- must change:
  - workflow modules under `packages/codexkit-daemon/src/workflows/plan-*.ts`
  - plan file writer/parser modules (new under daemon or dedicated package)
- outputs:
  - valid `plan.md` frontmatter contract
  - phase file set creation (`phase-XX-*.md`)
  - mode-to-handoff mapping (`fast/hard/parallel/two/auto`)
  - suggested-plan hint isolation (not active until explicit activation)
- independent verification:
  - golden tests for frontmatter keys + mode handoff outputs + no accidental suggested-plan activation

## Slice P5-S4: Plan Subcommands (validate, red-team, archive)
- ownership: `cdx plan validate|red-team|archive`
- must change:
  - `plan-subcommand` workflow modules
  - shared plan mutation utility (append/update `## Validation Log` and `## Red Team Review` inline)
- outputs:
  - no standalone parity-critical files for validate/red-team
  - inline mutation of `plan.md` and affected phase files
  - correct result states: `valid|revise|blocked`
- independent verification:
  - tests for inline mutation semantics, archive behavior, and handoff emission rules

## Slice P5-S5: Hydration Bootstrap Engine
- ownership: plan-to-task hydration and cook pickup reuse
- must change:
  - new hydration module (`packages/codexkit-daemon/src/workflows/hydration-*.ts`)
  - task creation metadata mapping via existing `taskService`
- outputs:
  - dedupe against existing live tasks
  - skip checked `[x]` items
  - phase-level hydration default + optional critical child tasks
  - `task-hydration-report.md`
- independent verification:
  - hydration dedupe suite, metadata contract suite, skip/threshold suite

## Slice P5-S6: Cook Through Post-Implementation
- ownership: `cdx cook` flow through phase boundary only (no later-phase finalize)
- must change:
  - workflow modules under `packages/codexkit-daemon/src/workflows/cook-*.ts`
  - approval checkpoints wiring for `post-research`, `post-plan`, `post-implementation`
- outputs:
  - mode detector (`interactive|auto|fast|parallel|no-test|code`)
  - plan reuse or generation path
  - implementation orchestration using task reuse first, hydration fallback second
  - `implementation-summary.md` contract
- independent verification:
  - gate matrix tests, mode behavior tests, pickup/hydration fallback tests

## Slice P5-S7: Workflow-Level NFR Evidence Harness
- ownership: Phase 5 NFR metrics tests + evidence artifact generation
- must change:
  - `tests/runtime/` additions for Phase 5 workflows
  - optional test fixtures in `tests/fixtures/`
- outputs:
  - evidence for Phase-5-owned metrics: `NFR-1`, `NFR-3`, `NFR-5.2`, core `NFR-6`
  - explicit pass/fail mapping to spec acceptance criteria
- independent verification:
  - dedicated runtime test subset for phase closure evidence

## Sequential Vs Parallel Plan

Must stay sequential:
1. `P5-S0` before all other slices. Reason: checkpoint ids, run metadata, approval inheritance, report-path semantics are shared contracts.
2. `P5-S3` before `P5-S4`. Reason: validate/red-team/archive mutate plan artifacts produced by plan core.
3. `P5-S5` before final `P5-S6` completion. Reason: cook pickup contract depends on hydration and dedupe behavior.
4. `P5-S6` before final NFR wave close (`P5-S7`). Reason: NFR evidence must target real cook behavior.

Can run in parallel after prerequisites:
- `P5-S1` and `P5-S2` can start after `P5-S0`.
- `P5-S5` can start in parallel with `P5-S2` once `P5-S0` done.
- `P5-S4` can start once `P5-S3` skeleton and parser/writer contracts stable.
- `P5-S7` spec-test-design can run in parallel with Session A implementation (B0 independence), but execution of tester wave waits for A+B0 artifacts.

Dependency graph (condensed):
- `S0 -> S1,S2,S3,S5`
- `S3 -> S4`
- `S5 + S3 -> S6`
- `S1,S2,S4,S6 -> S7`

## Shared Files And Workflow-Engine Seams

Highest-conflict shared files:
- `packages/codexkit-cli/src/index.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-core/src/domain-types.ts`
- `packages/codexkit-core/src/services/run-service.ts`
- `packages/codexkit-core/src/services/approval-service.ts`

Recommended seam split to reduce merge risk:
- keep workflow logic out of `runtime-controller.ts`; use workflow modules invoked by thin controller adapters.
- isolate plan parsing/writing into one utility module; all `plan`, `validate`, `red-team`, `cook code-mode` paths call same utility.
- isolate hydration into one engine; never duplicate hydration logic in `plan` and `cook` handlers.
- isolate handoff string rendering in one CLI helper to prevent drift.

## Checkpoint Contracts (Phase 5)

Hard checkpoint ids (must not drift):
- brainstorm: `brainstorm-discovery`, `brainstorm-decision`, `brainstorm-handoff`
- plan: `plan-context`, `plan-draft`, `plan-hydration`
- cook: `cook-mode`, `post-research`, `post-plan`, `implementation`, `post-implementation`

Contract guardrails:
- checkpoint completion requires required artifact or explicit `no-file` semantics.
- approval statuses in workflow response are `approved|revised|aborted`; ledger status still keeps full enum.
- handoff to downstream run carries explicit policy only when source emits it.

## Hydration Boundaries

In-boundary for Phase 5:
- bootstrap hydration from `plan.md` + `phase-*.md`
- dedupe against live tasks in same run/plan dir
- phase-level default task units
- task metadata minimum fields (`phase`, `priority`, `effort`, `planDir`, `phaseFile`)

Out-of-boundary for Phase 5:
- full markdown sync-back of runtime completion to all plan checkboxes (Phase 7)
- finalize-stage reconciliation after testing/review/docs/git workflows

Boundary risk to enforce:
- do not overreach into Phase 7 sync-back behavior while implementing hydration bootstrap.

## CLI Surface Boundaries

Phase 5 must add:
- `cdx brainstorm`
- `cdx plan`
- `cdx cook`
- `cdx plan validate <plan-path>`
- `cdx plan red-team <plan-path>`
- `cdx plan archive [plan-path-or-selection]`

Phase 5 must not claim done for:
- `cdx review`, `cdx test`, `cdx debug`, `cdx team`, finalize parity steps beyond post-implementation

Continuation boundary:
- output absolute plan-path handoff strings where fresh-session continuation is expected.

## Risky Interfaces (Need Extra Tests)

1. run-scoped approval inheritance
- risk: accidental `auto` leakage to downstream run violates `NFR-1.2`.

2. suggested plan vs active plan pointer
- risk: report path silently redirected to suggested plan dir without explicit activation.

3. plan mutation by validate/red-team
- risk: standalone report files created instead of inline `plan.md`/phase updates; parity drift.

4. cook task pickup ordering
- risk: duplicate tasks if hydration runs before checking reusable live tasks.

5. artifact resolver during plan creation
- risk: transient reports not re-registered/moved after plan dir exists.

6. CLI mode ambiguity
- risk: extra prompts or silent fallback violates `NFR-3.2` and typed diagnostics contract.

7. checkpoint artifact omissions
- risk: checkpoint advanced without required artifact; violates `NFR-5.2` auditability.

## Recommended First Implementation Wave (post planner)

Wave 1 recommendation: implement `S0 + S1 + S2 + S3 (core only) + S5`.

Reason:
- delivers end-to-end usable `brainstorm` and baseline `plan` with hydration bootstrap.
- creates stable contracts for harder `cook` and plan subcommands in Wave 2.
- maximizes parallel-safe work while reducing risk of cross-file churn later.

Wave 1 explicit non-goals:
- full `cdx cook` through post-implementation.
- full `plan validate/red-team/archive` completion.
- final NFR evidence close.

## Downstream Routing Guidance

## Session A implement
- role/modal used: fullstack-developer / default implementation modal
- suggested model: `gpt-5.3-codex / high`
- fallback model: `gpt-5.2-codex / high`
- skills route: `none required`
- run mode: high-rigor, fresh branch/worktree from `df037409230223e7813a23358cc2da993cb6c67f`
- scope for first wave:
  - implement `S0 + S1 + S2 + S3(core) + S5`
  - no production changes for deferred Phase 6+ workflows
- hard constraints:
  - keep checkpoint ids exact
  - keep policy inheritance explicit-only on handoff
  - no finalize/sync-back overreach
- required artifact:
  - `phase-5-session-a-implementation-summary.md` with files changed, tests run, known risks, deferred scope

## Session B0 spec-test-design
- role/modal used: spec-test-designer / default verification modal
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.2 / medium`
- skills route: `none required`
- run mode: high-rigor, separate fresh branch/worktree from same pinned `BASE_SHA`
- source-of-truth constraints:
  - pinned base docs + repo at `df037409230223e7813a23358cc2da993cb6c67f`
  - do not inspect Session A implementation artifacts
- scope:
  - freeze acceptance tests for full Phase 5 spec, prioritize Wave 1 slices and explicit deferred checks for Wave 2
  - define fixture matrix, command matrix, artifact assertions, gate assertions, NFR mapping
- required artifact:
  - `phase-5-session-b0-spec-test-design.md`

## Session B tester
- role/modal used: tester / default testing modal
- suggested model: `gpt-5.3-codex / medium`
- fallback model: `gpt-5.2-codex / medium`
- skills route: `none required`
- readiness gate:
  - wait for Session A summary and Session B0 spec-test-design artifact
- source-of-truth constraints:
  - current candidate tree + phase docs
  - B0 artifact treated as frozen expectation
- scope:
  - execute B0-authored tests unchanged first
  - add verification-only tests only for doc-derived gaps
- required artifact:
  - `phase-5-session-b-test-report.md` with commands, failures, criteria mapping, B0-change note

## Session C reviewer
- role/modal used: code-reviewer / default review modal
- suggested model: `gpt-5.4 / high`
- fallback model: `gpt-5.2 / high`
- skills route: `none required`
- readiness gate:
  - wait for Session A summary
- source-of-truth constraints:
  - current candidate tree + phase docs
  - findings-first independent review, no code edits
- focus:
  - invariants, checkpoint correctness, handoff policy leakage, hydration dedupe, CLI boundary drift, test coverage gaps
- required artifact:
  - `phase-5-session-c-review-report.md` with `CRITICAL/IMPORTANT/MODERATE` sections or explicit `no findings`

## Session D lead verdict
- role/modal used: lead verdict / default lead modal
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.2 / medium`
- skills route: `none required`
- readiness gate:
  - wait for Session B and Session C artifacts
- source-of-truth constraints:
  - candidate tree + phase docs; prior artifacts are handoff context only
- output contract:
  - pass/fail against Phase 5 scope for current wave
  - blocker list and reroute target if fail
  - next runnable wave if pass
- required artifact:
  - `phase-5-session-d-verdict.md`

## Artifact Checklist For This Planner Step

Produced:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md` (this report)

Still waiting before downstream Wave 2 routing:
- Session A implementation summary
- Session B0 spec-test-design
- Session B test report
- Session C review report
- Session D lead verdict

## Unresolved Questions

- whether Wave 1 should include minimal `cdx cook` stub routing early (CLI + typed blocked diagnostic) or defer all cook entry until Wave 2 to avoid partial-semantic confusion
- whether plan parser/writer should be placed inside `codexkit-daemon` now or introduced as new package immediately for Phase 7 reuse
