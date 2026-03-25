# Phase 8 Remediation Session A Implementation Summary

## Status

- completed
- scope stayed inside Phase 8 remediation only

## Remediation Scope Coverage

- restored preview-before-mutation enforcement for `cdx init` and `cdx update`
  - apply now requires a matching preview snapshot from a prior invocation
  - added explicit blocked-action codes:
    - `INIT_APPLY_REQUIRES_PREVIEW`
    - `UPDATE_APPLY_REQUIRES_PREVIEW`
- enforced install-only blocking at worker-backed workflow entrypoints
  - blocked commands when install-state says install-only and first commit still missing:
    - `cdx cook`
    - `cdx review`
    - `cdx test`
    - `cdx debug`
  - typed error: `WF_INSTALL_ONLY_REPO_BLOCKED`
- extended `cdx doctor` import-registry drift detection
  - new explicit findings:
    - `DOCTOR_IMPORT_REGISTRY_POINTER_MISSING`
    - `DOCTOR_IMPORT_REGISTRY_PATH_DRIFT`
    - `DOCTOR_IMPORT_REGISTRY_MISSING`
    - `DOCTOR_IMPORT_REGISTRY_INVALID`
- hardened `cdx resume` reclaim-blocked recovery output
  - reclaim-blocked cases now emit:
    - diagnostics code `RESUME_RECLAIM_BLOCKED`
    - blocker summary in `resume-report.md`
    - one concrete next action command (`cdx daemon start --once && cdx resume '<run-id>'`)

## Files Updated

- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/workflows/update-workflow.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/resume-workflow.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`

## Verification

- `npm run typecheck` (pass)
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts tests/runtime/runtime-workflow-phase8-cli.integration.test.ts --no-file-parallelism`
  - `runtime-cli.integration` passed in run output
  - initial `runtime-workflow-phase8-cli.integration` run failed due test-order mismatch in new preview handshake, fixed in test sequence
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts --no-file-parallelism` (pass, 4/4)
- `npm run typecheck` rerun after final edits (pass)

## Notes

- protected-path gates for root `AGENTS.md` and `.codex/**` remain approval-gated
- stable Phase 8 artifact filenames remain unchanged:
  - `init-report.md`
  - `doctor-report.md`
  - `resume-report.md`
  - `update-report.md`
  - `migration-assistant-report.md`

## Unresolved Questions

- none
