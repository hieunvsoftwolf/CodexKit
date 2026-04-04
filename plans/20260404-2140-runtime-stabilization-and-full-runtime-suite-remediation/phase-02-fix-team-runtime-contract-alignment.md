# Phase 2: Fix And Team Runtime Contract Alignment

## Overview
Update the remaining tests that still assume `fix` and `team` are deferred workflows. Phase 12.4 already landed runnable `fix` and `team` workflow surfaces, so the baseline suite must stop asserting the old deferred-contract behavior.

## Requirements
- Treat Phase 12.4 runnable workflow parity as the current product contract
- Preserve typed diagnostics where they are still part of the current workflow surface
- If a real runtime defect appears during reruns, fix product behavior rather than weakening the contract to match stale tests

## Related Code Files
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
- `packages/codexkit-daemon/src/workflows/team-workflow.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`

## Implementation Steps
- Confirm the current runnable `fix` and `team` contract from the landed CLI and runtime code
- Update stale tests that still expect `WF_FIX_DEFERRED_WAVE2` or `WF_TEAM_DEFERRED_WAVE2`
- Isolate any actual runtime issue, such as fixture locking or CLI output shape drift, from plain contract drift
- Re-run focused `fix` and `team` contract tests before advancing

## Todo Checklist
- [ ] Reconcile `runtime-cli.integration.test.ts` with the current runnable `fix` and `team` workflow contract
- [ ] Reconcile `runtime-workflow-phase9-golden-parity.integration.test.ts` deferred-contract assertions with the current runnable contract
- [ ] Preserve any still-valid typed diagnostic expectations that remain part of the current workflow surface

## Acceptance Criteria
- No active runtime test still treats `fix` or `team` as deferred-only workflow surfaces when the landed runtime executes them directly
- Focused reruns prove the current CLI and runtime behavior for `fix` and `team`
- Any residual failure in this area is a real runtime bug, not a stale deferred expectation

## Verification Commands
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`

## Success Criteria
- The baseline runtime suite reflects the current runnable `fix` and `team` contract instead of the superseded deferred contract

## Risk Notes
- `team` exercises shared orchestration and database surfaces; treat any locking or empty-output symptom as a runtime defect until the test proves it is only a stale expectation
