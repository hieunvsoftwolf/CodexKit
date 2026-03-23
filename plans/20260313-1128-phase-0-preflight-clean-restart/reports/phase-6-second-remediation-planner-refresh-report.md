# Phase 6 Second-Remediation Planner Refresh Report

**Date**: 2026-03-23
**Phase**: Phase 6 Workflow Parity Extended
**Status**: completed
**Role/Modal Used**: planner / Default
**Model Used**: GPT-5 Codex / Codex CLI
**Pinned BASE_SHA**: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## Scope And Sources

Source of truth used:
- current candidate repo tree in `/Users/hieunv/Claude Agent/CodexKit`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-second-remediation-planner-refresh-needed-after-s10.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-d-verdict.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/project-roadmap.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`

## Narrowed Second-Remediation Slice

Only these blockers remain in scope:

1. `P6-S2` recent-change review misses untracked-only dirty repos and can publish false `no findings`
2. `P6-S3` `cdx test ui` can fall back to plain `npm test` while claiming UI verification
3. `P6-S3` `test-report.md` still publishes synthetic totals and synthetic coverage instead of runner-backed metrics or an explicit unavailable shape

Confirmed out of scope for this loop unless a direct blocker forces a tiny touch:
- `P6-S0`
- `P6-S1`
- `P6-S4`
- `P6-S5` `fix`
- `P6-S6` team runtime
- `P6-S7` `cdx team`
- `P6-S8` Phase 6 closeout evidence

## Exact File Ownership

Implementation-owned production files:
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
  - owner: second-remediation Session A
  - reason: untracked-only recent-scope bug is localized to repo-signal collection and scoped finding synthesis in this file
- `packages/codexkit-daemon/src/workflows/test-workflow.ts`
  - owner: second-remediation Session A
  - reason: UI command selection, degraded/blocked behavior, and report metric publication are localized here

Verification-owned files:
- frozen and unchanged first:
  - `tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase6-review.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase6-test.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- existing first-remediation verification may be rerun unchanged:
  - `tests/runtime/runtime-workflow-phase6-remediation.integration.test.ts`
- new verification additions should go in a new tester-owned file to avoid mutating frozen B0 files:
  - `tests/runtime/runtime-workflow-phase6-second-remediation.integration.test.ts`

Default ownership rule:
- Session A should avoid editing verification-owned files unless it needs small implementation-adjacent coverage for local confidence
- Session B owns the authoritative verification additions for the narrowed blocker set

## B0 Decision

Decision: keep the frozen Wave 1 B0 artifact; no new B0 session is required.

Why:
- the Phase 6 docs and Wave 1 acceptance contract did not change
- the remaining blockers are narrower instances of already-frozen Wave 1 `review` and `test` contracts
- `docs/verification-policy.md` allows Session B to add acceptance or integration tests for doc-derived gaps while still treating the B0 artifact as frozen expectation
- `control-state-phase-6-second-remediation-planner-refresh-needed-after-s10.md` already says to keep the existing B0 frozen unless the planner proves a new B0 is required; this planner refresh does not prove that

Operational consequence:
- Session B must rerun the four frozen B0 tests unchanged first
- Session B may then add one new verification-only file for the three narrowed blocker cases

## Exact Verification Additions Needed

Add one new tester-owned file:
- `tests/runtime/runtime-workflow-phase6-second-remediation.integration.test.ts`

It must cover exactly these three cases:

### 1. Recent-change review on untracked-only dirty repo

Fixture:
- git repo with an initial commit
- add one untracked non-runtime file such as `new-file.ts`
- do not stage or commit it

Command:
- `cdx review checkout --json`

Assertions:
- workflow result is `review`
- `review-report.md` is published
- report must not contain `- no findings`
- result `findings` must be non-empty or the report must contain an `IMPORTANT` untracked-files finding
- evidence must point to untracked file presence, not a generic clean-repo message

### 2. UI mode must not fall back to plain default test suite

Fixture:
- git repo with `package.json` containing only a generic `"test"` script
- no `test:ui`
- no `test:e2e`

Command:
- `cdx test ui http://127.0.0.1:4173 --json`

Assertions:
- workflow result is `test`
- execution status is explicit blocked/degraded, not synthetic pass
- diagnostics include a stable UI-script-missing code and next step
- `test-execution-output.md` must not record `npm test` as the executed UI command
- `test-report.md` must describe missing UI-specific support, not claim UI verification succeeded

### 3. Test report metrics must be runner-backed or explicitly unavailable

Fixture:
- reuse the UI-missing-script fixture above and add one coverage-mode fixture if needed

Commands:
- `cdx test ui http://127.0.0.1:4173 --json`
- optional second probe: `cdx test checkout --coverage --json` on a fixture whose runner output does not expose parseable coverage counts

Assertions:
- `test-report.md` must not publish synthetic numeric totals derived only from command count or exit code
- if runner metrics are unavailable, report must use explicit unavailable shape rather than fake numbers
- coverage section must appear only with runner-backed metrics or explicit unavailable values

Preferred explicit unavailable shape:
- `Passed: unavailable`
- `Failed: unavailable`
- `Skipped: unavailable`
- `Line: unavailable`
- `Branch: unavailable`

Allowed alternative:
- another equally explicit unavailable string shape, but it must be stable inside the new verification file and must clearly distinguish unavailable from measured numeric values

## Remediation Boundaries

Do not expand this loop into:
- chooser work already accepted in `review` or `test`
- debug route/result work
- generic approval continuation
- `fix`
- team runtime
- `cdx team`
- Phase 6 closeout or NFR harness broadening

If a tiny shared helper touch becomes unavoidable, the implementer must justify it in Session A and keep the change subordinate to the two owned workflow files above.

## Downstream Prompts

### Session A Implement Prompt

Role: fullstack-developer / Default
Skills: none required
Suggested model: `gpt-5.3-codex / high`
Fallback model: `gpt-5.2-codex / high`

```text
Source of truth: current candidate repo tree, current Phase 6 docs, frozen Wave 1 B0 artifact, current remediation artifacts, this planner-refresh report, and the blocked remediation verdict. Prior chat history is not source of truth.

Read these first:
1. README.md
2. plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
3. plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-second-remediation-planner-refresh-needed-after-s10.md
4. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-second-remediation-planner-refresh-report.md
5. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md
6. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-a-implementation-summary.md
7. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-c-review-report.md
8. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-d-verdict.md
9. docs/workflow-extended-and-release-spec.md
10. docs/verification-policy.md
11. docs/non-functional-requirements.md
12. docs/project-roadmap.md
13. docs/project-overview-pdr.md
14. docs/system-architecture.md

Task:
- implement only the narrowed second-remediation slice
- keep scope out of P6-S0, P6-S1, P6-S4, fix, team runtime, cdx team, and Phase 6 closeout evidence unless a tiny helper touch is strictly required by the blocker set

Exact blocker set:
- P6-S2: recent-change review misses untracked-only dirty repos and can publish false `no findings`
- P6-S3: `cdx test ui` can fall back to plain `npm test` while claiming UI verification
- P6-S3: `test-report.md` still publishes synthetic totals and synthetic coverage instead of runner-backed metrics or an explicit unavailable shape

Exact production file ownership:
- packages/codexkit-daemon/src/workflows/review-workflow.ts
- packages/codexkit-daemon/src/workflows/test-workflow.ts

Required implementation outcomes:
1. Recent-change review must treat non-runtime untracked files as in-scope repo evidence for recent review, not only codebase review.
2. An untracked-only dirty repo must not publish false `no findings` for recent review.
3. `cdx test ui` must not execute plain `npm test` as a fallback when UI-specific scripts are missing.
4. When UI-specific scripts are missing, publish explicit blocked/degraded diagnostics naming the missing UI capability and next step.
5. `test-report.md` totals and coverage must be runner-backed when available.
6. If runner metrics are unavailable, publish an explicit unavailable shape rather than synthetic numeric totals or synthetic coverage.

Guardrails:
- keep the four frozen B0-owned tests unchanged
- do not weaken the Phase 6 docs
- do not expand into new workflow families
- do not claim Phase 6 passed

Verification:
- run typecheck
- run targeted runtime tests relevant to your changes
- you may add implementation-adjacent tests if needed, but do not edit the four frozen B0 files

Required output:
- implementation summary
- exact files changed
- tests run with results
- known risks
- handoff notes for tester and reviewer
```

### Tester Rerun Prompt

Role: tester / Default
Skills: none required
Suggested model: `gpt-5.3-codex / medium`
Fallback model: `gpt-5.2-codex / medium`

```text
Source of truth: current candidate repo tree, current Phase 6 docs, frozen Wave 1 B0 artifact, current remediation artifacts, the blocked remediation verdict, and the second-remediation planner-refresh report. Prior chat history is not source of truth.

Read these first:
1. README.md
2. plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
3. plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-second-remediation-planner-refresh-needed-after-s10.md
4. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-second-remediation-planner-refresh-report.md
5. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md
6. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-a-implementation-summary.md
7. docs/workflow-extended-and-release-spec.md
8. docs/verification-policy.md
9. docs/non-functional-requirements.md

Verification policy:
- treat the frozen Wave 1 B0 artifact as frozen expectation
- run the four frozen B0 tests unchanged first
- after that, add only verification-owned coverage for the three narrowed blocker cases if the frozen B0 suite does not already prove them

Frozen B0 commands to run first unchanged:
1. npm test -- --run tests/runtime/runtime-workflow-phase6-cli.integration.test.ts
2. npm test -- --run tests/runtime/runtime-workflow-phase6-review.integration.test.ts
3. npm test -- --run tests/runtime/runtime-workflow-phase6-test.integration.test.ts
4. npm test -- --run tests/runtime/runtime-workflow-phase6-debug.integration.test.ts

Then:
- rerun tests/runtime/runtime-workflow-phase6-remediation.integration.test.ts unchanged
- add a new tester-owned file:
  tests/runtime/runtime-workflow-phase6-second-remediation.integration.test.ts

That new file must verify exactly:
1. `cdx review checkout` on an untracked-only dirty repo does not publish false `no findings`
2. `cdx test ui <url>` with only a generic `test` script does not fall back to plain `npm test`
3. `test-report.md` uses runner-backed metrics or an explicit unavailable shape, never synthetic totals/coverage

Guardrails:
- do not change production code
- do not rewrite the four frozen B0 files
- do not expand into fix, team runtime, cdx team, or Phase 6 closeout evidence
- if you need an unavailable report shape assertion, freeze the exact string shape you observe and explain why it satisfies the docs better than the prior synthetic shape

Required output:
- test report
- commands run
- whether the four frozen B0 tests passed unchanged
- verification additions made and why
- failures or remaining gaps
- explicit mapping to the three narrowed blockers
```

### Reviewer Rerun Prompt

Role: code-reviewer / Default
Skills: none required
Suggested model: `gpt-5.4 / high`
Fallback model: `gpt-5.2 / high`

```text
Source of truth: current candidate repo tree, current Phase 6 docs, frozen Wave 1 B0 artifact, current remediation artifacts, the blocked remediation verdict, and the second-remediation planner-refresh report. Prior chat history is not source of truth.

Read these first:
1. README.md
2. plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
3. plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-second-remediation-planner-refresh-needed-after-s10.md
4. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-second-remediation-planner-refresh-report.md
5. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md
6. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-a-implementation-summary.md
7. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-remediation-session-c-review-report.md
8. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-d-verdict.md
9. docs/workflow-extended-and-release-spec.md
10. docs/verification-policy.md
11. docs/non-functional-requirements.md

Review only the narrowed second-remediation slice:
- P6-S2 recent-change review on untracked-only dirty repos
- P6-S3 UI-mode fallback behavior
- P6-S3 durable test-report metric fidelity

Focus:
- bugs
- spec mismatches
- misleading success or degraded claims
- report fidelity gaps
- missing verification for the three narrowed blockers

Keep out of scope unless a direct regression is introduced:
- P6-S0
- P6-S1
- P6-S4
- fix
- team runtime
- cdx team
- Phase 6 closeout evidence

Required output format:
- findings first ordered by severity
- explicit `no findings` if clean
- file/line references
- brief summary after findings
- unresolved questions at end if any
```

### Lead Verdict Rerun Prompt

Role: lead verdict / Default
Skills: none required
Suggested model: `gpt-5.4 / medium`
Fallback model: `gpt-5.2 / medium`

```text
Source of truth: current candidate repo tree, current Phase 6 docs, frozen Wave 1 B0 artifact, the second-remediation planner-refresh report, the second-remediation implementation summary, the tester rerun report, and the reviewer rerun report. Prior chat history is not source of truth.

Read these first:
1. README.md
2. plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
3. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-second-remediation-planner-refresh-report.md
4. plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md
5. second-remediation Session A implementation summary
6. second-remediation Session B test report
7. second-remediation Session C review report
8. docs/workflow-extended-and-release-spec.md
9. docs/verification-policy.md
10. docs/non-functional-requirements.md
11. docs/project-roadmap.md

Decide only whether the narrowed second-remediation slice clears the three remaining Wave 1 blockers:
1. recent-change review false `no findings` on untracked-only dirty repo
2. `cdx test ui` fallback to plain `npm test`
3. synthetic totals / synthetic coverage in `test-report.md`

Do not fail or pass based on:
- deferred Wave 2 scope
- fix
- team runtime
- cdx team
- Phase 6 closeout evidence

Verdict method:
- weight current candidate tree first
- then current Phase 6 docs
- then tester and reviewer rerun artifacts
- treat the frozen B0 artifact as unchanged expectation, not optional guidance

Required output:
- verdict: pass or fail
- blockers if fail
- next action
- explicit statement on whether Wave 1 can now advance or remains blocked
```

## Ready-Now Routing

Ready now:
- second-remediation Session A implement

Waits on Session A:
- tester rerun
- reviewer rerun

Waits on tester + reviewer:
- lead verdict rerun

## Unresolved Questions

- none
