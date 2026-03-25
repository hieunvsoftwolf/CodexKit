# Phase 8 Second Remediation Session B Test Report

**Date**: 2026-03-25
**Phase**: Phase 8 Packaging and Migration UX
**Status**: completed
**Role/Modal Used**: tester / default
**Model Used**: Codex / GPT-5
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Scope

Validate second-remediation candidate against frozen Phase 8 Session B0 contract, with required execution order preserved and no production-code edits.

## Source Of Truth Used

- current second-remediation candidate tree at `/Users/hieunv/Claude Agent/CodexKit`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-second-remediation-wave-2-ready-after-sa.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-second-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-session-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-remediation-session-d-verdict.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Not used:
- reviewer rerun output
- verdict rerun output

## Frozen B0 Sequence Execution

1. `npm run test:runtime -- tests/runtime/runtime-cli.integration.test.ts`
- exit: `1`
- observation: known broad-script rerun noise reproduced; script executed full `tests/runtime` tree instead of single file.
- unrelated failing files observed:
  - `tests/runtime/runtime-daemon.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts`
- Phase 8 file inside this run: `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` passed (`8/8`).

2. `npm run test:runtime -- tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- exit: `1`
- observation: known broad-script rerun noise reproduced again; script executed full `tests/runtime` tree.
- unrelated failing file observed:
  - `tests/runtime/runtime-daemon.integration.test.ts`
- Phase 8 file inside this run: `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` passed (`8/8`).

3. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
- exit: `0`
- result: targeted frozen-evaluation command passed.
- tests: `2` files passed, `18` tests passed.

## Direct Phase 8 Contract Evaluation

### Required second-remediation blockers

- resumed `plan` continuation emits explicit `cdx cook <absolute-plan-path>` from `cdx resume <run-id>`: **pass**
  - runtime evidence: `phase 8 CLI workflow contracts > resume returns explicit cook continuation after cdx plan` and `...resume emits explicit plan-path continuation command when re-entry is required` passed
  - code evidence: `packages/codexkit-daemon/src/workflows/plan-workflow.ts` now writes `activePlanPath` for current plan run; `packages/codexkit-daemon/src/workflows/resume-workflow.ts` prefers `state.activePlanPath` and emits `cdx cook ...`

- `cdx init` and `cdx update` apply authorization bound to previewed writable payload, not path metadata only: **pass**
  - runtime evidence: `phase 8 CLI workflow contracts > invalidates init and update preview tokens when previewed payload changes` passed
  - code evidence: fingerprint includes `payloadFingerprints` built from sorted `{ path, contentSha256 }` in `packages/codexkit-daemon/src/workflows/phase8-packaging-plan.ts`; used by both preview fingerprint builders in `init-workflow.ts` and `update-workflow.ts`

- content drift invalidates old preview token: **pass**
  - runtime evidence: same preview-token invalidation Phase 8 test passed
  - code evidence: apply requires exact fingerprint match; payload hash mismatch forces `INIT_APPLY_REQUIRES_PREVIEW` or `UPDATE_APPLY_REQUIRES_PREVIEW`

### Accepted remediation behavior remains intact

- install-only enforcement: **pass**
  - `phase 8 CLI workflow contracts > blocks worker-backed workflows on install-only repos until the first commit exists`

- doctor import-registry drift detection: **pass**
  - `phase 8 CLI workflow contracts > supports init, doctor, and update...` asserts `DOCTOR_IMPORT_REGISTRY_MISSING`
  - `phase 8 CLI workflow contracts > doctor surfaces explicit host-capability blocks...` asserts `DOCTOR_IMPORT_REGISTRY_PATH_DRIFT`

- reclaim-blocked actionable output: **pass**
  - `phase 8 CLI workflow contracts > resume surfaces one concrete next action when recovery is reclaim-blocked`

- protected-path approval gates: **pass**
  - `phase 8 CLI workflow contracts > supports init, doctor, and update...` asserts approval blocks for `AGENTS.md` and `.codex/config.toml`

- non-destructive defaults: **pass**
  - same test asserts custom `README.md` and unmanaged `notes.keep.txt` are preserved

- migration-assistant required sections: **pass**
  - same test asserts required report sections:
    - `Detected Source Kit Markers`
    - `Required Install Or Upgrade Actions`
    - `Risky Customizations Needing Manual Review`
    - `Recommended Next Command Sequence`

- blocked host-capability handling: **pass**
  - `phase 8 CLI workflow contracts > doctor surfaces explicit host-capability blocks...` asserts blocked status with `DOCTOR_CODEX_CLI_MISSING` severity `error`

## B0 Noise Classification

Broad-script rerun noise remains present for `npm run test:runtime -- <file>` invocations because command wiring still executes `vitest run tests/runtime ...` and pulls unrelated suites. This is recorded separately and did not block direct Phase 8 contract evaluation.

## Verification-Owned Follow-Up Added

- none
- rationale: frozen sequence was runnable; direct Phase 8 contract command passed; no doc-derived stable-harness gap remained that required new verification-owned test additions in this session

## Final Assessment

- Phase 8 second-remediation tester rerun scope requested in this session: **pass**
- frozen B0 sequence order preserved: **yes**
- required must-verify contract bullets: **all pass**

## Unresolved Questions

- none
