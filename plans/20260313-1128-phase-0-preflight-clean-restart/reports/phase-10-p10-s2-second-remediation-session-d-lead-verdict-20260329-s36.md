# Phase 10 `P10-S2` Second-Remediation Session D Lead Verdict (S36)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` only
**Session**: D lead verdict rerun
**Status**: completed
**Role/Modal Used**: lead verdict / Default
**Model Used**: Codex / GPT-5

## Verdict

`P10-S2`: **pass**

Host caveat remains explicit:
- raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
- canonical scripted path remains green

The broad `npm run test:runtime` aggregate remains non-zero outside `P10-S2`, but that does not invalidate this verdict because the frozen `P10-S2` contract file is green and the current-slice CLI evidence is present.

## Source Of Truth Used

- current candidate repo tree
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/phase-10-public-cli-packaging-and-onboarding.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s2-second-remediation-verdict-ready-control-agent-20260329-191012.md`
- frozen `P10-S2` B0 contract:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-b0-spec-test-design.md`
- handoff context:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-second-remediation-session-a-implementation-summary-20260329-s33.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-second-remediation-session-b-tester-report-20260329-s34.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-second-remediation-session-c-review-report-20260329-s35.md`
- prior failed lead verdict for blocker provenance only:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-session-d-lead-verdict-20260328-s28.md`

## Current-Tree Reconciliation

`R1` is closed in the current candidate tree.
- `packages/codexkit-daemon/src/workflows/init-workflow.ts:118` now includes runner source, command, selection state, and invalid reason in the preview fingerprint.
- `packages/codexkit-daemon/src/workflows/init-workflow.ts:353` blocks `--apply` when the current preview fingerprint does not match prior preview state.
- `packages/codexkit-daemon/src/workflows/init-workflow.ts:425` persists preview state only for preview runs, so blocked apply attempts do not refresh approval state.

`R2` remains accepted and is still green in the current candidate tree.
- `packages/codexkit-daemon/src/runtime-config.ts:209` preserves explicit config runner selection.
- `packages/codexkit-daemon/src/runtime-config.ts:212` treats empty config runner command as invalid instead of absent fallback.

Regression coverage stays narrow and current-slice aligned.
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:341` covers real CLI `init` and `doctor` runner surfacing and typed blocking.
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:413` covers the required preview/apply continuation path for runner drift.

## Acceptance Mapping

### Phase-doc success criteria

1. `R1` preview/apply runner drift is blocked and covered by regression evidence
   - pass
   - current tree blocks drifted apply at `packages/codexkit-daemon/src/workflows/init-workflow.ts:353`
   - regression exists at `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:413`
   - tester `S34` direct CLI continuation path passed exactly as required
   - reviewer `S35` reported no findings and confirmed the bypass is closed

2. `R2` explicit empty config runner selection emits typed invalid-runner diagnostics instead of falling back to default
   - pass
   - current tree returns invalid config selection at `packages/codexkit-daemon/src/runtime-config.ts:212`
   - frozen contract test covers this path and passed in the current verification run
   - tester `S34` kept `R2` accepted and found no current-tree contradiction
   - reviewer `S35` confirmed `R2` remains accepted and unaffected

3. tester rerun passes the frozen `P10-S2` B0 contract for the current slice
   - pass
   - `S34` ran frozen B0 unchanged first
   - `S34` recorded the frozen contract file passing `7/7`
   - current rerun: `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism` passed `7/7`

4. reviewer rerun reports no remaining current-slice blockers
   - pass
   - `S35` reported no findings and no blockers

5. lead verdict can either pass `P10-S2` or reroute with a narrower exact blocker set
   - pass
   - exact prior blockers `R1` and `R2` are no longer present in the current candidate tree
   - no narrower blocker set remains inside `P10-S2`

### Frozen B0 contract points that matter for this verdict

- runner resolution order `env -> config -> default`: pass
- `cdx doctor` surfaces active runner source and effective runner command: pass
- `cdx doctor` blocks with typed diagnostics for invalid or unavailable selected runners: pass
- `cdx init` preview/apply surfaces active runner source and effective runner command: pass
- wrapped-runner command shapes remain accepted: pass
- `F7` preview/apply continuation integrity under runner drift: pass

## Real-Workflow CLI Evidence Check

Required real-workflow CLI evidence exists for this slice.

- runner-selection and typed-doctor/init behavior:
  - present in frozen contract coverage and current rerun
  - anchored by `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:341`
  - includes real `cdx init` and `cdx doctor` CLI execution paths

- init continuation behavior under runner drift:
  - present in tester `S34` direct CLI fixture evidence
  - present in frozen contract regression at `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:413`
  - current tree behavior matches the required sequence exactly:
    - preview under runner A
    - apply under runner B blocks
    - repeated apply under runner B still blocks
    - preview under runner B succeeds
    - apply under runner B succeeds

This is sufficient for `P10-S2`. No widening into packaged-artifact smoke, `P10-S3`, `P10-S4`, or release closure is needed for this verdict.

## Verification Used

1. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
   - result: pass (`7/7`)

## Final Decision

`P10-S2` passes on the current candidate tree.

The acceptance basis is:
- prior exact blockers `R1` and `R2` are closed
- frozen `P10-S2` contract evidence is green
- required real CLI evidence exists for runner-selection and `init`/`doctor` behavior
- reviewer rerun reports no remaining current-slice blockers

## Unresolved Questions

- none
