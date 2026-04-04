# Phase 02 S10 Spec-Test Design Report

Date: 2026-04-05
Status: completed
Session: S10
Role/modal used: spec-test-designer / reasoning
Model used: Codex / GPT-5
Pinned BASE_SHA: `038f0800a9e0a57a38ea864e916c8775acff09a6`
Execution surface: root control surface only, baseline read only

## Scope Freeze

Phase 02 covers only fix/team deferred-contract alignment against the pinned baseline and current phase docs.

In scope:
- replace stale deferred-only expectations for `cdx fix` and `cdx team`
- freeze the runnable Phase 12.4 contract that current `main` already exposes
- define tester-owned commands, fixtures, outputs, and evidence for fix/team only

Out of scope:
- Phase 03 trace-source remapping and frozen-trace source changes
- archive confirmation work already closed in Phase 01
- unrelated `review`, `test`, `debug`, `cook`, `brainstorm`, `init`, `doctor`, `docs`, or `scout` behavior
- broad Phase 9 metric redesign outside the fix/team contract hunk

## Source-Of-Truth Inputs Read

- `README.md`
- `.claude/rules/development-rules.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-02-fix-team-runtime-contract-alignment.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-02-wave-1-ready-after-s8-20260405-000517.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-02-planner-decomposition-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/plan-contract.md`
- `docs/control-agent/control-agent-codexkit/skill-inventory.md`
- baseline tree at `038f0800a9e0a57a38ea864e916c8775acff09a6` for:
  - `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
  - `packages/codexkit-daemon/src/workflows/team-workflow.ts`
  - `tests/runtime/runtime-cli.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
  - `tests/runtime/helpers/cli-json.ts`

## Contract Anchor Decision

Phase 12.4 runnable workflow parity is the Phase 02 contract anchor.

Anchor proof from baseline:
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts:41`
  - `cdx fix intermittent test failure --quick --json` is runnable
  - bare `cdx fix --json` is also runnable through chooser + approval continuation
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts:75`
  - `cdx team review payment flow --json` is runnable and artifact-producing

Product seam proof from baseline:
- `packages/codexkit-cli/src/workflow-command-handler.ts:354`
  - `fix` routes to `controller.fix(...)`
- `packages/codexkit-cli/src/workflow-command-handler.ts:415`
  - `team` routes to `controller.team(...)`
- `packages/codexkit-daemon/src/runtime-controller.ts:164`
  - `fix(...)` runs `runFixWorkflow(...)`
- `packages/codexkit-daemon/src/runtime-controller.ts:171`
  - `team(...)` runs `runTeamWorkflow(...)`
- `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
  - explicit mode path is runnable
  - bare fix may either chooser-gate or auto-select
- `packages/codexkit-daemon/src/workflows/team-workflow.ts`
  - team is a real bootstrap -> monitor -> shutdown workflow

## Frozen Phase 02 Contract

### Fix

Phase 02 must assert:
- explicit runnable fix mode remains supported
- bare `fix` remains a runnable user entry, specifically via chooser + continuation
- successful fix returns stdout JSON, not deferred stderr JSON
- durable artifacts remain published for completed fix execution

Phase 02 should not freeze heuristic auto-select as a required gate.

Reason:
- `README.md` allows bare fix to prompt for mode selection and says autonomous is recommended/default
- `fix-workflow.ts` can auto-select for some short issues, but that path is heuristic-sensitive
- verification policy requires chooser entry plus continuation coverage when a chooser exists
- the Phase 12.4 anchor already proves chooser continuation directly and more deterministically than auto-select

Decision:
- required Phase 02 fix contract = explicit mode + bare chooser continuation
- optional/non-gating Phase 02 observation = auto-select path may still exist, but it is not a frozen assertion for this wave

### Team

Phase 02 must assert:
- `cdx team <template> <context> --json` succeeds on stdout
- the workflow is terminal, not deferred-only
- checkpointed output and durable artifacts exist
- shutdown completes to terminal deleted status, not incomplete shutdown

## Verification-Owned Files And Boundaries

Verification-owned for this wave:
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - entire file frozen as the baseline anchor
  - Session A should not edit it
- this report

Implementation-owned but Phase 02-scoped:
- `tests/runtime/runtime-cli.integration.test.ts`
  - only the Phase 6 fix/team block
- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
  - only the fix/team deferred-contract hunk and the directly coupled `NFR-5.2` wording

Conditionally editable by Session A only if a real runtime defect is proven:
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
- `packages/codexkit-daemon/src/workflows/team-workflow.ts`

Out of scope for Session A in Phase 02:
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
- Phase 03 trace-source sections in `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`

## Exact Commands, Fixtures, And Expected Outputs

All commands below should use the host-safe cache override already frozen in repo docs.

### Anchor Commands That Must Stay Green Unchanged

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx fix covers explicit entry plus chooser continuation and publishes durable artifacts'
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx team creates a runnable team workflow with checkpointed output and durable artifacts'
```

Frozen fixtures and assertions:
- fix anchor fixture id: `codexkit-phase12-port-parity-fix-cli`
- team anchor fixture id: `codexkit-phase12-port-parity-team-cli`
- both start the daemon with `cdx daemon start --once --json`

Expected fix anchor outputs:
- explicit command: `cdx fix intermittent test failure --quick --json`
- result fields:
  - `workflow === "fix"`
  - non-empty unique `checkpointIds`
  - `run show <runId>` lists at least one absolute existing artifact path
- bare command: `cdx fix --json`
- result fields:
  - `workflow === "fix"`
  - `pendingApproval.checkpoint` is present
  - `pendingApproval.approvalId` is present
  - `pendingApproval.nextStep` contains `cdx approval respond`
  - `checkpointIds.length === 0`
- continuation command:
  - `cdx approval respond <approvalId> --response approve --text autonomous --json`
- continuation fields:
  - `continuation.workflow === "fix"`
  - `continuation.checkpointIds` non-empty
  - durable artifacts exist on the original chooser run id

Expected team anchor outputs:
- command: `cdx team review payment flow --json`
- result fields:
  - `workflow === "team"`
  - non-empty unique `checkpointIds`
  - `run show <runId>` lists at least one absolute existing artifact path

### Phase 02 Targeted Gates For Tester

Primary gate for the shared runtime CLI file:

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts -t 'supports phase 6 wave-1 review/test/debug commands and returns runnable fix/team outputs'
```

Expected fixture:
- `codexkit-runtime-cli-workflow-phase6-wave1`

Expected runtime-cli assertions after Phase 02 update:
- existing `review`, `test`, and `debug` assertions remain unchanged
- `fix` assertion switches from `runCliFailure(...)` to success JSON on stdout
- recommended fixed command:
  - `cdx fix intermittent test failure --quick --json`
- required fix fields:
  - `workflow === "fix"`
  - `mode === "quick"`
  - `route === "quick"`
  - `approvalPolicy === "human-in-the-loop"`
  - `checkpointIds === ["fix-mode", "fix-diagnose", "fix-route", "fix-implement", "fix-verify"]`
  - `completed === true`
  - `fixReportPath` exists
  - diagnostics include code `FIX_ROUTE_LOCKED`
- `team` assertion switches from `runCliFailure(...)` to success JSON on stdout
- recommended fixed command:
  - `cdx team review payment flow --json`
- required team fields:
  - `workflow === "team"`
  - `template === "review"`
  - `checkpointIds === ["team-bootstrap", "team-monitor", "team-shutdown"]`
  - `teamStatus === "deleted"`
  - `teamReportPath` exists
  - diagnostics include code `TEAM_WORKFLOW_COMPLETED`

Primary gate for the Phase 9 file:

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts
```

Expected fixture:
- the file owns one test only: `publishes validation-golden evidence with parity checks and explicit blockers`

Expected Phase 02-specific Phase 9 assertions after update:
- `fix` and `team` no longer use `runCliFailure(...)`
- recommended commands:
  - `cdx fix phase9 deferred behavior --quick --json`
  - `cdx team cook "phase9 deferred behavior" --json`
- required fix evidence:
  - `workflow === "fix"`
  - `completed === true`
  - `fixReportPath` exists
  - diagnostics include `FIX_ROUTE_LOCKED`
- required team evidence:
  - `workflow === "team"`
  - `teamStatus === "deleted"`
  - `teamReportPath` exists
  - diagnostics include `TEAM_WORKFLOW_COMPLETED`
- `NFR-5.2` must now hinge on:
  - finalize/docs/git durable reports still exist
  - runnable fix/team workflows produce durable artifacts
- `NFR-5.2` evidence text should be updated accordingly and stop mentioning deferred diagnostics

## Real-Workflow E2E Evidence Requirement

For Phase 02, real-workflow e2e evidence means real CLI execution against a fresh runtime fixture, not direct unit calls and not failure-parser-only evidence.

Fix evidence is sufficient only when it includes:
- `cdx daemon start --once --json`
- real `cdx fix ... --json` execution
- for bare fix coverage, a real `cdx approval respond ... --json` continuation
- stdout JSON payload captured by the test harness
- durable artifact proof from either:
  - `run show <runId>` artifact list with absolute existing paths, or
  - direct existing `fixReportPath`

Team evidence is sufficient only when it includes:
- `cdx daemon start --once --json`
- real `cdx team ... --json` execution
- stdout JSON payload captured by the test harness
- checkpoint evidence for bootstrap, monitor, and shutdown
- durable artifact proof from either:
  - `run show <runId>` artifact list with absolute existing paths, or
  - direct existing `teamReportPath`

Not sufficient:
- `runCliFailure(...)` parsing of stderr for `fix` or `team`
- success claims without artifact existence checks
- synthetic mocks of workflow result objects

## Runtime-CLI Rerun Decision

Targeted gate should supersede the whole-file `runtime-cli.integration.test.ts` rerun for Phase 02 first-pass verification.

Reason:
- only one test block in that file is Phase 02-owned
- whole-file reruns mix unrelated CLI surfaces into this wave
- the stale failure is localized to the Phase 6 shared fix/team block

Decision:
- frozen first gate for `runtime-cli.integration.test.ts` is the targeted `-t` command above
- whole-file rerun is acceptable only as secondary regression evidence after the targeted gate passes

For `runtime-workflow-phase9-golden-parity.integration.test.ts`:
- whole-file rerun remains acceptable because the file currently contains one test only
- but edits must stay inside the Phase 02-owned fix/team hunk and the directly coupled `NFR-5.2` wording

## Phase 02-Owned Vs Out-Of-Scope Hunks In Phase 9 File

Phase 02-owned hunk in `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`:
- `runCliFailure(...)` helper use for fix/team at lines `302-305`
- the directly coupled `nfr52` assignment at line `320`
- the `NFR-5.2` evidence wording at line `418`
- if needed, the local variable names immediately surrounding that hunk, but only to keep the file coherent

Out of scope in the same file:
- frozen trace source path and loader at lines `12-29`
- fresh-session restatement helpers and logic around lines `67-180`, `321-349`, and `431-438`
- comparative frozen-trace evidence for `NFR-3.6` around lines `260-284` and `394-405`
- any artifact source rewiring tied to `FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH`
- any broader Phase 9 metric reshaping outside `NFR-5.2`

## Runtime-Defect Boundary For Tester And Reviewer

Treat as stale expectations, not runtime defects:
- `WF_FIX_DEFERRED_WAVE2`
- `WF_TEAM_DEFERRED_WAVE2`
- `expected JSON payload but received empty output` from `tests/runtime/helpers/cli-json.ts` when it comes from `runCliFailure(...)` against a now-successful `fix` or `team` command

Treat as real runtime defects if reproduced after the stale assertions are removed:
- `fix` succeeds but omits JSON on stdout
- `fix` explicit `--quick` no longer reaches `fix-verify`
- `fix` chooser path no longer returns `pendingApproval` or no longer resumes through `approval respond`
- `team` no longer reaches `team-shutdown`
- `teamStatus` is not terminal deleted and emits `TEAM_SHUTDOWN_INCOMPLETE`
- expected report paths or durable artifact listings are missing

## Tester Routing Summary

Run in this order:
1. frozen Phase 12 fix anchor
2. frozen Phase 12 team anchor
3. targeted Phase 02 `runtime-cli.integration.test.ts` gate
4. Phase 02 `runtime-workflow-phase9-golden-parity.integration.test.ts` file gate
5. optional secondary whole-file `runtime-cli.integration.test.ts` regression rerun after targeted gate passes

Pass condition for Phase 02:
- frozen Phase 12 anchors remain green unchanged
- runtime-cli targeted gate proves runnable fix/team outputs instead of deferred stderr diagnostics
- Phase 9 gate proves `NFR-5.2` with runnable fix/team artifact evidence, without touching Phase 03 trace-source coverage

## Unresolved Questions

- none
