# Phase 10 Second Remediation Session D Verdict

**Date**: 2026-03-27
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Session**: D lead verdict
**Status**: completed
**Role/Modal Used**: lead-verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, worktree beyond pinned base)
**Skill Route**: none required

## Decision

Fail the second-remediation `P10-S0` candidate.

The tester rerun passed the narrowed second-remediation subset. That pass does not clear the remaining reviewer blocker because the current tree still allows an already-invalid selected runner state to flow into worker launch, where it degrades into an opaque process failure instead of a typed preflight runner diagnostic before spawn. `P10-S0` freezes runner resolution and runner diagnostics for the actual selected runner path, not only the `doctor` and `init` display surfaces.

## Weighting

1. frozen `P10-S0` contract sources
   - `README.md`
   - `docs/system-architecture.md`
   - `docs/workflow-extended-and-release-spec.md`
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
2. second-remediation Session A implementation summary
3. second-remediation Session B tester rerun report
4. second-remediation Session C reviewer rerun report
5. current-tree inspection of the cited runtime files

Tester pass gets full credit for the executed narrowed subset. It does not override a still-open important finding on the worker-backed runtime path inside the same frozen `P10-S0` slice.

## Verdict Basis

### 1. `doctor` and `init` runner-path fixes hold

What holds:
- package/bin seam alignment holds across package manifests, docs, and freeze coverage
- selected runner invalid state is preserved in `resolveWorkerRunnerConfig()`
- `cdx doctor` now blocks malformed selected runner text with `DOCTOR_SELECTED_RUNNER_INVALID`
- `cdx doctor` no longer depends on bare `<runner-executable> --version` for fixed-arg command shapes
- `cdx init` preview/apply surfaces the selected runner source and command honestly
- install-only gating and preserved Phase 8 CLI subset still hold in the tester rerun

Why this matters:
- it narrows the remaining gap to one runtime-consumption path, not a broad Phase 10 regression set

### 2. Worker launch still consumes invalid selected-runner state instead of blocking before spawn

Verdict weight: hard blocker.

Why it blocks:
- `P10-S0` freezes exact runner precedence and typed diagnostics for the chosen runner path
- an invalid selected runner must block cleanly before worker-backed execution, not degrade into a generic launch failure
- otherwise the system still violates the frozen no-silent-downgrade / honest-runner-diagnostic contract on the actual execution path

Current-tree evidence:
- [`runtime-config.ts`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/runtime-config.ts#L192) preserves malformed selected runner input as `selectionState: "invalid"` with `command: []`
- [`worker-runtime.ts`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/runner/worker-runtime.ts#L79) still builds the default worker command from `this.context.config.workerRunner.command`
- [`worker-runtime.ts`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/runner/worker-runtime.ts#L81) then spawns `command[0]!` without a typed runner preflight guard

Resulting behavior:
- invalid selected-runner state is no longer silently replaced by default
- but worker launch still consumes the empty command array and fails opaquely at execution time
- that means the second remediation fixed the display and doctor/init paths, not the worker-backed runtime path the frozen contract also covers

Why tester pass does not clear it:
- Session B validated the narrowed freeze subset it executed and that subset passed
- Session C identified a still-open important issue outside that narrowed execution subset but inside `P10-S0`
- verdict must weigh both; a frozen-contract blocker in the live worker path keeps the candidate failing

## Minimum Next-Remediation Scope Only

Keep remediation strictly inside `P10-S0`.

1. Block worker-backed launch before spawn when the selected runner state is already `invalid`.
   - reject the launch with a typed runner diagnostic
   - preserve the selected runner source and raw command text in the surfaced error
   - do not downgrade to default and do not attempt process spawn

2. Add freeze coverage for that worker-launch guard.
   - malformed env-selected runner must fail before spawn with a typed runner diagnostic
   - malformed config-selected runner must fail before spawn with the same typed behavior when no env override exists

Do not widen into:
- `P10-S1` packaged artifact implementation
- `P10-S2` broader runner UX or config redesign
- `P10-S3` docs expansion
- `P10-S4` packaged-artifact smoke harness work

## Next Action

Route one more narrow remediation pass limited to the worker-launch invalid-runner preflight gap above, then rerun independent Session B tester and Session C reviewer verification before another verdict.

## Blockers

- invalid selected-runner state still reaches worker launch and fails opaquely instead of blocking with a typed runner diagnostic before spawn

## Unresolved Questions

- none
