# Phase 6 Planner Decomposition Report

**Date**: 2026-03-23
**Phase**: Phase 6 Workflow Parity Extended
**Status**: completed
**Pinned BASE_SHA**: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## Scope And Sources

Source of truth used:
- repo tree at `cfdac9eecc918672082ab4d460b8236e2aea9566`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-freeze-complete-planner-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-base-freeze-rerun-3-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/workflow-parity-core-spec.md`
- `docs/worker-execution-and-isolation-spec.md`
- `docs/tdd-test-plan.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`

Current repo-state read for decomposition:
- public workflow commands currently stop at Phase 5 surface: `cdx brainstorm`, `cdx plan`, `cdx cook`
- workflow engine modules exist under `packages/codexkit-daemon/src/workflows/` for Phase 5 only
- workflow checkpoint enum currently stops at the Phase 5 ids in `packages/codexkit-core/src/domain-types.ts`
- approval-driven continuation is currently cook-specific via `resumeCookWorkflowFromApproval()` in `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
- lower-level runtime substrate for Phase 6 already exists:
  - run/task/worker/team/message/approval/artifact services
  - event dispatcher wake-on-message behavior
  - task completion events
  - team create/delete primitives
- `cdx team` is not yet a workflow; current CLI only exposes low-level `team create|list|delete`

## Decomposition: Implementation-Owned Slices

## Slice P6-S0: Shared Workflow Runtime Extension
- ownership: shared Phase 6 workflow contracts, checkpoint ids, generic continuation plumbing, shared diagnostic/report helpers
- must change:
  - `packages/codexkit-core/src/domain-types.ts`
  - `packages/codexkit-core/src/services/run-service.ts`
  - `packages/codexkit-core/src/services/approval-service.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-daemon/src/workflows/contracts.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - shared helpers under `packages/codexkit-daemon/src/workflows/`
- outputs:
  - stable Phase 6 checkpoint ids from spec section 3.2
  - workflow result types expanded beyond `brainstorm|plan|cook`
  - generic approval continuation entrypoint for non-cook workflows
  - shared typed-failure and report-publication helpers for `review`, `test`, `fix`, `debug`, `team`
- independent verification:
  - contract tests for checkpoint recording, artifact/no-file rules, and generic continuation metadata

## Slice P6-S1: CLI Public Surface For Review/Test/Fix/Debug/Team
- ownership: parser, command dispatch, route/mode flags, typed diagnostics, no-extra-prompt command behavior
- must change:
  - `packages/codexkit-cli/src/arg-parser.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
  - `packages/codexkit-cli/src/index.ts`
  - `packages/codexkit-cli/src/render.ts` if workflow-specific summaries need formatting support
- outputs:
  - public commands accepted:
    - `cdx review <context>`
    - `cdx review codebase`
    - `cdx review codebase parallel`
    - `cdx test <context>`
    - `cdx test ui [url]`
    - `cdx test <context> --coverage`
    - `cdx fix <issue> [--auto|--review|--quick|--parallel]`
    - `cdx debug <issue>`
    - `cdx team <template> <context>` with team-size and delegate flags
  - typed CLI diagnostics for ambiguous or unsupported shapes per `NFR-3.2` and `NFR-3.3`
- independent verification:
  - CLI integration suite for command shapes, mode conflicts, and exact diagnostic payloads

## Slice P6-S2: `cdx review` Workflow Vertical
- ownership: review orchestration only
- must change:
  - new `packages/codexkit-daemon/src/workflows/review-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - any shared report helper introduced in `P6-S0`
- outputs:
  - checkpoints: `review-scout`, `review-analysis`, `review-publish`
  - `review-report.md` with findings-only, severity ordering, evidence, and recommended action
  - support for recent-change review, `codebase`, and `codebase parallel`
  - explicit task-managed review pipeline for multi-file or iterative review/fix cases
- checkpoint ownership:
  - `review-scout`
  - `review-analysis`
  - `review-publish`
- independent verification:
  - integration tests for report shape, severity ordering, scoped reviewer outputs, and retry-cycle cap behavior

## Slice P6-S3: `cdx test` Workflow Vertical
- ownership: test preflight, delegated execution, QA report generation, retry-after-fix loop metadata
- must change:
  - new `packages/codexkit-daemon/src/workflows/test-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - any shared report helper introduced in `P6-S0`
- outputs:
  - checkpoints: `test-preflight`, `test-execution`, `test-report`
  - `test-report.md` with totals, failed-test causes, suggested fixes, build status, warnings, unresolved questions
  - default, `ui`, and coverage modes with typed blocked/degraded behavior when prerequisites are missing
  - explicit retry loop handoff instead of silent pass-through
- checkpoint ownership:
  - `test-preflight`
  - `test-execution`
  - `test-report`
- independent verification:
  - integration tests for report contract, coverage metrics inclusion, preflight capture, and failed-test handoff behavior

## Slice P6-S4: `cdx debug` Workflow Vertical
- ownership: root-cause-first debugging flow, branch dispatch, task-graph investigation, publishable debug report
- must change:
  - new `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - any shared report helper introduced in `P6-S0`
- outputs:
  - checkpoints: `debug-precheck`, `debug-route`, `debug-hypotheses`, `debug-evidence`, `debug-conclusion`
  - `debug-report.md` with root-cause chain, disproven hypotheses, evidence refs, and recommended next action
  - branch dispatch for `code`, `logs-ci`, `database`, `performance`, `frontend`
  - 3-task-rule graph for non-trivial investigations
- checkpoint ownership:
  - `debug-precheck`
  - `debug-route`
  - `debug-hypotheses`
  - `debug-evidence`
  - `debug-conclusion`
- independent verification:
  - integration tests for mandatory pre-hypothesis guardrails, branch dispatch, evidence bundle rules, and cycle escalation

## Slice P6-S5: `cdx fix` Routed Workflow
- ownership: fix mode selection, diagnose-first entry, route locking, implementation/verify orchestration, Phase 7 finalize handoff stub
- must change:
  - new `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
- outputs:
  - checkpoints: `fix-mode`, `fix-diagnose`, `fix-route`, `fix-implement`, `fix-verify`
  - distinct approval policy vs route decision model
  - quick, standard, deep, parallel route semantics
  - explicit dependency on `cdx debug` semantics before any implementation
  - explicit verify bundle using fresh test and review evidence
  - finalize-entry metadata only; do not implement Phase 7 finalize behavior here
- checkpoint ownership:
  - `fix-mode`
  - `fix-diagnose`
  - `fix-route`
  - `fix-implement`
  - `fix-verify`
- independent verification:
  - route matrix tests, escalation tests, and verify-bundle tests proving no diagnosis skip

## Slice P6-S6: Team Runtime Foundation
- ownership: team-scoped task/event/message behavior shared by all team templates
- must change:
  - `packages/codexkit-core/src/services/team-service.ts`
  - `packages/codexkit-core/src/services/task-service.ts`
  - `packages/codexkit-core/src/services/worker-service.ts`
  - `packages/codexkit-core/src/services/message-service.ts`
  - `packages/codexkit-daemon/src/event-dispatcher.ts`
  - `packages/codexkit-daemon/src/runtime-kernel.ts`
- outputs:
  - stable runtime events and state transitions for:
    - `task.completed`
    - `worker.idle`
    - wake-on-message
    - coordinated shutdown
  - replacement-safe teammate reassignment hooks
  - team-scoped ownership metadata for write-capable tasks
  - no silent fallback from requested team mode to sequential single-run mode
- independent verification:
  - runtime integration tests for idle/wake, direct messaging, shutdown drain, and reassignment without corrupted team state

## Slice P6-S7: `cdx team` Workflow And Template Layer
- ownership: team bootstrap, template task seeding, monitor loop, shutdown flow, delegate mode
- must change:
  - new `packages/codexkit-daemon/src/workflows/team-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
- outputs:
  - checkpoints: `team-bootstrap`, `team-monitor`, `team-shutdown`
  - supported templates:
    - `cdx team research`
    - `cdx team cook`
    - `cdx team review`
    - `cdx team debug`
  - `--delegate`, `--plan-approval`, `--no-plan-approval`, team-size flag handling
  - team-scoped run behavior with task claiming, direct messaging, idle/wake, shutdown, cleanup
- checkpoint ownership:
  - `team-bootstrap`
  - `team-monitor`
  - `team-shutdown`
- independent verification:
  - integration tests for bootstrap failure behavior, monitor events, task claiming, replacement flow, and cleanup

## Slice P6-S8: Phase 6 Outcome And NFR Evidence Harness
- ownership: executable acceptance, workflow fixtures, and phase-owned NFR evidence
- must change:
  - new tests under `tests/runtime/`
  - optional new fixtures under `tests/fixtures/`
- outputs:
  - executable coverage for every Phase 6 outcome criterion
  - explicit pass/fail mapping for Phase 6-owned `NFR-3`, `NFR-5`, `NFR-6`, `NFR-7`
  - durable evidence artifact for phase close
- independent verification:
  - dedicated runtime test subset for Phase 6 closeout

## Sequential Vs Parallel Plan

Must stay sequential:
1. `P6-S0` before every other slice.
   Reason: checkpoint ids, workflow result types, shared artifact helpers, and generic continuation rules are phase-wide contracts.
2. `P6-S4` before `P6-S5`.
   Reason: `cdx fix` is diagnose-first by contract and must bind to finalized debug semantics.
3. `P6-S6` before `P6-S7`.
   Reason: team workflow behavior depends on runtime events, teammate states, and shutdown semantics that belong below the workflow layer.
4. `P6-S2` and `P6-S3` before final `P6-S5` completion.
   Reason: fix verify bundles require stable review/test contracts, not provisional local copies.
5. `P6-S5` and `P6-S7` before final `P6-S8` phase-close evidence.
   Reason: acceptance and NFR evidence must target the real integrator workflows.

Can run in parallel after prerequisites:
- `P6-S1`, `P6-S2`, `P6-S3`, `P6-S4`, and `P6-S6` can start after `P6-S0`.
- `P6-S2`, `P6-S3`, and `P6-S4` are parallel-safe once CLI command-shape ownership is isolated.
- `P6-S5` can start after `P6-S4` is stable enough to freeze debug handoff/report contracts and after `P6-S2` plus `P6-S3` report schemas are fixed.
- `P6-S7` can start after `P6-S6` plus whichever templates it binds to are stable enough:
  - `team review` waits for `P6-S2`
  - `team debug` waits for `P6-S4`
  - `team cook` can bind to existing Phase 5 cook flow but will still rely on `P6-S6` runtime behavior
- `P6-S8` spec-test-design may run in parallel with Session A implementation after this planner artifact exists, but tester execution still waits for Session A plus Session B0 artifacts.

Dependency graph (condensed):
- `S0 -> S1,S2,S3,S4,S6`
- `S2,S3,S4 -> S5`
- `S6 + S2 + S4 + existing Phase 5 cook -> S7`
- `S1,S2,S3,S4,S5,S6,S7 -> S8`

## Shared Files, Shared Contracts, And Checkpoint Ownership

Highest-conflict shared files:
- `packages/codexkit-core/src/domain-types.ts`
- `packages/codexkit-core/src/services/run-service.ts`
- `packages/codexkit-core/src/services/approval-service.ts`
- `packages/codexkit-core/src/services/team-service.ts`
- `packages/codexkit-core/src/services/task-service.ts`
- `packages/codexkit-core/src/services/worker-service.ts`
- `packages/codexkit-core/src/services/message-service.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/event-dispatcher.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-cli/src/index.ts`

Shared contracts that must not drift across slices:
- checkpoint enum and checkpoint recording semantics
- typed workflow diagnostic shape
- report-path resolution under active plan dir vs run artifact dir
- workflow handoff bundle minimum fields
- approval-policy inheritance and continuation rules
- task graph ownership and file-ownership metadata
- team event names and worker/team state transitions
- `fix` separation of approval policy from execution route
- Phase 6 boundary to Phase 7 finalize: handoff only, no finalize reimplementation

Recommended seam split to reduce merge risk:
- keep new workflow logic in one file per workflow under `packages/codexkit-daemon/src/workflows/`; keep `runtime-controller.ts` thin
- centralize checkpoint/report publication helpers in `P6-S0`; do not duplicate artifact-writing logic per workflow
- keep command-line parsing in CLI handlers only; do not leak route parsing into workflow modules
- keep team runtime event/state logic below `cdx team`; workflow layer should consume stable events, not redefine them

## Risky Interfaces (Need Extra Tests)

1. Phase 6 checkpoint expansion
- risk: enum drift or missing checkpoint persistence breaks resume/audit behavior across all five workflows

2. Generic approval continuation
- risk: continuation logic remains cook-only or becomes workflow-specific spaghetti inside `runtime-controller.ts`

3. Review/test/fix shared verify loop
- risk: `cdx fix` silently inlines stale review/test results instead of requiring fresh evidence

4. Debug branch dispatch
- risk: branch classification is recorded loosely and later evidence bundles do not prove why a branch was chosen or ruled out

5. Team runtime events
- risk: `worker.idle`, wake-on-message, and task completion semantics diverge between services and the event dispatcher, producing stuck teams or false-idle teams

6. Team fallback behavior
- risk: `cdx team` degrades to sequential single-run execution without an explicit blocked/degraded notice, violating the command contract

7. Ownership boundaries in parallel fix/team paths
- risk: worker scopes are implicit, causing overlapping writes and Phase 2 isolation regressions

8. Phase 6 to Phase 7 boundary
- risk: fix/team implementations smuggle finalize logic into Phase 6 or omit finalize-entry metadata required later

9. `cdx test ui` and browser-dependent paths
- risk: missing helper capability becomes silent success or silent skip instead of typed blocked/degraded behavior with report output

10. CLI prompt suppression
- risk: ambiguous command handling adds extra prompts even when route or operation is explicit, violating `NFR-3.2`

## Recommended First Implementation Wave

Wave 1 recommendation:
- `P6-S0`
- `P6-S1`
- `P6-S2`
- `P6-S3`
- `P6-S4`

Reason:
- establishes the shared Phase 6 contracts once
- delivers three standalone delegated workflows with durable artifacts first
- freezes the report and handoff shapes that `cdx fix` must consume
- leaves the two integrator-heavy slices, `fix` and `team`, for a second wave after the substrate is less ambiguous
- creates the safest point to let later implementation run in parallel without fighting over core contracts

Wave 1 explicit non-goals:
- full `cdx fix`
- full `cdx team`
- final Phase 6 NFR closeout

Recommended later waves:
- Wave 2: `P6-S5 + P6-S6`
- Wave 3: `P6-S7 + P6-S8`

## Exact Ownership Boundaries For Later Session A And Session B0 Prompts

Wave 1 Session A implement should own:
- `packages/codexkit-cli/src/arg-parser.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-cli/src/index.ts`
- `packages/codexkit-cli/src/render.ts` only if needed for workflow summaries
- `packages/codexkit-core/src/domain-types.ts`
- `packages/codexkit-core/src/services/run-service.ts`
- `packages/codexkit-core/src/services/approval-service.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/**`
- implementation-adjacent smoke coverage only in existing shared runtime tests if strictly required

Wave 1 Session A implement must not edit:
- any new Phase 6 verification-owned files reserved for B0 under `tests/runtime/runtime-workflow-phase6-*.test.ts`
- any new Phase 6 fixture data under `tests/fixtures/phase6/**`

Wave 1 Session B0 spec-test-design should own:
- `tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-review.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-test.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- optional fixture additions under `tests/fixtures/phase6/**`

Wave 1 Session B0 spec-test-design must not edit:
- any production code under `packages/**`
- existing Phase 5 tests except to reference them for gap analysis

Wave 2 reserved ownership boundaries:
- Session A implement for `fix` and team runtime/template work:
  - `packages/codexkit-core/src/services/team-service.ts`
  - `packages/codexkit-core/src/services/task-service.ts`
  - `packages/codexkit-core/src/services/worker-service.ts`
  - `packages/codexkit-core/src/services/message-service.ts`
  - `packages/codexkit-daemon/src/event-dispatcher.ts`
  - `packages/codexkit-daemon/src/runtime-kernel.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/team-workflow.ts`
  - CLI handler files for new flags only
- Session B0 spec-test-design for Wave 2:
  - `tests/runtime/runtime-workflow-phase6-fix.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase6-team.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase6-nfr-evidence.integration.test.ts`
  - optional fixture additions under `tests/fixtures/phase6/**`

## Mapping To Phase 6 Outcome Criteria And NFR Coverage

| Outcome / NFR target | Primary owning slices | Notes |
|---|---|---|
| `cdx review` produces severity-ordered findings with evidence and recommendations | `S0`, `S1`, `S2`, `S8` | `S2` owns report behavior; `S8` proves acceptance |
| `cdx test` supports delegated test execution, report output, and retry-after-fix loops | `S0`, `S1`, `S3`, `S8` | `S3` owns QA report and retry metadata |
| `cdx fix` preserves quick, standard, deep, and parallel routing semantics | `S0`, `S1`, `S4`, `S5`, `S8` | `S4` must freeze debug semantics before `S5` completes |
| `cdx debug` produces a durable root-cause report before any fix handoff | `S0`, `S1`, `S4`, `S8` | `S4` owns root-cause-first behavior |
| `cdx team` supports team-scoped runs, task claiming, direct messaging, idle/wake, shutdown, cleanup | `S0`, `S1`, `S6`, `S7`, `S8` | split runtime foundation vs workflow/template layer |
| `NFR-3.2` no unnecessary prompts | `S1`, `S8` | mostly CLI command-shape enforcement |
| `NFR-3.3` typed blocking diagnostics | `S0`, `S1`, `S3`, `S7`, `S8` | shared diagnostic helper plus workflow-specific blocked states |
| `NFR-3.5` default next-action handoff prompts match parity rules | `S1`, `S2`, `S3`, `S5`, `S7`, `S8` | especially review/test/fix handoffs |
| `NFR-5.2` durable success or typed failure artifact for every terminal workflow run | `S0`, `S2`, `S3`, `S4`, `S5`, `S7`, `S8` | Phase 6 extends this to all added workflows |
| `NFR-5.6` refreshed control-state snapshot before reroute | planner/control-session responsibility, not implementation slice | tracked by this report and later control-state updates |
| `NFR-6.1` handoff bundle completeness | `S0`, `S3`, `S4`, `S5`, `S7`, `S8` | review/test/debug/fix/team all need durable handoff bundles |
| `NFR-6.5` control-state snapshot completeness on reroute fixtures | planner/control-session responsibility, not implementation slice | Phase 6 workflows still must expose enough metadata for control routing |
| `NFR-7.3` parallel payoff benchmark | `S6`, `S7`, `S8` | strongest measurement surface is team runtime plus parallel fix/review usage |
| `NFR-7.4` parallel reliability benchmark | `S6`, `S7`, `S8` | requires stable replacement, wake, and ownership semantics |

Phase 6-owned NFR closeout focus:
- workflow-level prompt/diagnostic parity: `NFR-3`
- durable terminal artifacts across new workflows: `NFR-5.2`
- fresh-session handoff quality across extended workflows: `NFR-6.1`
- measurable team/parallel payoff and reliability: `NFR-7.3`, `NFR-7.4`

## Downstream Routing Guidance

## Session A implement
- role/modal used: fullstack-developer / default implementation modal
- suggested model: `gpt-5.3-codex / high`
- fallback model: `gpt-5.2-codex / high`
- skills route: `none required`
- run mode: high-rigor, fresh branch/worktree from `cfdac9eecc918672082ab4d460b8236e2aea9566`
- first-wave scope:
  - implement `S0 + S1 + S2 + S3 + S4`
  - do not implement `S5`, `S6`, `S7`, `S8`
  - do not edit B0-owned verification files

## Session B0 spec-test-design
- role/modal used: spec-test-designer / default
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.4-mini / medium`
- skills route: `none required`
- run mode: high-rigor, fresh branch/worktree from the same pinned `BASE_SHA`
- first-wave scope:
  - design verification for `review`, `test`, `debug`, and CLI command-shape contracts only
  - reserve Wave 2 verification files for `fix` and `team`
  - do not inspect implementation output or production code

## Unresolved Questions

- none
