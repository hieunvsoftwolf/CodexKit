# Phase 5 Remediation Session B Test Report

Date: 2026-03-22
Status: completed
Role/Modal Used: tester / Default
Model Used: GPT-5 / Codex
Pinned BASE_SHA: `df037409230223e7813a23358cc2da993cb6c67f`

## Scope And Source Of Truth

- current remediated candidate repo tree
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-remediation-wave-2-ready-after-sa.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md` (frozen expectation)
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-remediation-session-a-implementation-summary.md` (handoff context only)
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-d-verdict.md`
- `docs/workflow-parity-core-spec.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`

## B0-Defined Checks Executed First (Unchanged)

1. `git rev-parse HEAD`
- result: `df037409230223e7813a23358cc2da993cb6c67f`
- exit: `0`

2. `git merge-base --is-ancestor df037409230223e7813a23358cc2da993cb6c67f HEAD`
- result: pass
- exit: `0`

3. `npm run test:runtime`
- result: pass (`10` files, `58` tests)
- exit: `0`

4. `node ./cdx --help`
5. `node ./cdx brainstorm --help`
6. `node ./cdx plan --help`
7. `node ./cdx cook --help`
- result: all four failed unchanged with same error
- error: `SyntaxError: Unexpected identifier 'pipefail'`
- cause: `cdx` is a shell wrapper; `node ./cdx ...` is not executable form
- exit: `1` each

8. B0 baseline extra commands
- `git status --short` -> completed, dirty candidate tree visible
- `rg --files tests/runtime packages/codexkit-cli packages/codexkit-daemon packages/codexkit-core` -> completed

## Targeted Remediation Assertions (Direct)

### 1) Runnable generated cook handoffs

Command:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts tests/runtime/runtime-workflow-wave1.integration.test.ts --no-file-parallelism -t "generated fast and parallel cook handoff commands are runnable|cook bootstrap triggers hydration when reusable phase-task set is incomplete|brainstorm publishes required decision-report shape and explicit-only handoff metadata"`

Direct test evidence:
- `phase 1 CLI > generated fast and parallel cook handoff commands are runnable` -> pass
- file run summary: `2` files passed; `3` targeted tests passed

Verdict: pass. Generated handoff commands are runnable and do not fail with `COOK_PLAN_REQUIRED`.

### 2) Partial-reuse hydration recovery with child-task exclusion

Command:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts --no-file-parallelism -t "cook bootstrap triggers hydration when reusable phase-task set is incomplete"`

Direct test evidence:
- `phase 5 wave 1 workflow runtime > cook bootstrap triggers hydration when reusable phase-task set is incomplete` -> pass

Verdict: pass. Partial phase-task reuse triggers hydration recovery; child-task ids do not satisfy reuse completeness.

### 3) Brainstorm approval-gate durability and handoff-bundle completeness

Command:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts --no-file-parallelism --reporter=verbose -t "brainstorm publishes required decision-report shape and explicit-only handoff metadata"`

Direct test evidence:
- `phase 5 wave 1 workflow runtime > brainstorm publishes required decision-report shape and explicit-only handoff metadata` -> pass

Verdict: pass. Durable `brainstorm-handoff` approval record and downstream handoff bundle fields are asserted present.

## Deferred Scope Handling

Kept deferred unchanged:
- `P5-S4` (`cdx plan validate|red-team|archive` full behavior)
- final `P5-S6` cook through post-implementation parity close
- `P5-S7` workflow-level NFR evidence close

Observed behavior remains compatible with defer policy:
- deferred plan subcommands still return typed deferred diagnostics (`WF_PLAN_SUBCOMMAND_DEFERRED`) in runtime suite.

## Exit-Criteria Mapping (Remediation Blockers)

- `P5-S1` runnable `plan -> cook` handoff commands: pass (targeted assertion 1)
- `P5-S5` partial reuse + hydration fallback correctness: pass (targeted assertion 2)
- `P5-S2` brainstorm blocking approval durability + `NFR-6.1` handoff bundle completeness: pass (targeted assertion 3)

## Findings

1. Frozen B0 command matrix `node ./cdx ...` remains mechanically invalid for this repo wrapper shape; unchanged execution reproduced same failure.
2. This does not invalidate targeted remediation assertions, which passed via runtime tests and direct targeted invocations.

## Blockers

- none for requested remediation assertions rerun

## Unresolved Questions

- should future B0 command matrices switch help checks from `node ./cdx ...` to executable wrapper form `./cdx ...` to remove known command-shape noise?
