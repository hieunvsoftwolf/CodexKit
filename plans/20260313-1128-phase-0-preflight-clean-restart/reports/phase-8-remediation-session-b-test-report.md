# Phase 8 Remediation Session B Test Report

**Date**: 2026-03-25  
**Status**: completed  
**Role/Modal Used**: tester / default  
**Model Used**: GPT-5 Codex / Codex CLI  
**Pinned BASE_SHA Context**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Scope And Inputs

- Used current remediated candidate tree in `/Users/hieunv/Claude Agent/CodexKit`
- Used frozen Phase 8 B0 artifact: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-session-b0-spec-test-design.md`
- Used remediation handoff docs and current control-state snapshot
- Did not use reviewer rerun output or verdict rerun output
- No production-code edits

## Frozen B0 Sequence (Run First)

1. `npm run test:runtime -- tests/runtime/runtime-cli.integration.test.ts`
2. `npm run test:runtime -- tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
3. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`

### Results

- Command 1: failed with known broad-script rerun noise
  - script reran full `tests/runtime` suite, not only requested file
  - failure remained in unrelated suite:
    - `tests/runtime/runtime-daemon.integration.test.ts:126`
    - expected `pending`, received `expired`
- Command 2: failed with same broad-script rerun noise and same unrelated daemon assertion
- Command 3: passed
  - latest rerun after verification follow-up: `2` files passed, `16` tests passed

## Verification-Owned Follow-Up Added (Doc-Derived Gaps)

Added only test-scope coverage in:

- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`

New/expanded checks:

- protected-path approval gates for root `AGENTS.md` and `.codex/config.toml`
- non-destructive behavior:
  - custom root `README.md` preserved through init/apply
  - unmanaged file preserved through update/apply
- migration assistant report required sections present
- install-only worker entrypoint blocking enforced for:
  - `cdx cook`
  - `cdx review`
  - `cdx test`
  - `cdx debug`
- doctor findings for broken/inconsistent install state:
  - `DOCTOR_IMPORT_REGISTRY_PATH_DRIFT`
  - `DOCTOR_IMPORT_REGISTRY_MISSING`
  - `DOCTOR_RELEASE_MANIFEST_MISSING`
  - `DOCTOR_DAEMON_LOCK_STALE`
- explicit blocked host-capability handling:
  - `DOCTOR_CODEX_CLI_MISSING` with `error` severity under PATH-filtered host-gap run
- resume explicit plan-path continuation command when semantic re-entry is needed

Follow-up execution:

- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts --no-file-parallelism`
  - passed: `1` file, `6` tests
- Re-ran B0 direct targeted command after follow-up:
  - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
  - passed: `2` files, `16` tests

## Must-Verify Mapping

- `cdx init`/`cdx update` preview-before-mutation handshake: pass
- install-only repos blocked at worker-backed entrypoints until first commit: pass
- `cdx doctor` import-registry drift or broken-install findings: pass
- `cdx resume` reclaim-blocked actionable output with one concrete next action: pass
- protected-path approval gates for root `AGENTS.md` and `.codex/**`: pass
- non-destructive preview/apply behavior: pass
- `migration-assistant-report.md` required sections: pass
- explicit blocked host-capability handling: pass
- stale-lock and broken-install detection: pass
- explicit plan-path continuation command when required: pass

## Files Changed In Session B

- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` (verification-only)
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-remediation-session-b-test-report.md`

## Unresolved Questions

- none
