# Phase 10 P10-S4 Second-Remediation Session C Review Report

**Date**: 2026-03-30
**Session**: `S57`
**Role**: code-reviewer
**Status**: blocked

## Findings

### IMPORTANT

- `F4` is not fully closed. The frozen `P10-S4` contract defines the config-selected wrapped-runner lane as `<installed-cdx> init --json` plus `doctor --json`, but the current suite proves durable `init-report.md` only from `configInitApply.initReportPath` after an extra `--apply` run and never asserts `configInitPreview.initReportPath` or preview report contents. That leaves a preview-only regression uncaught. Evidence:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-b0-spec-test-design.md:224`
  - `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:220`
  - `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:245`

## Additional Notes

- `F1` looks closed: the fresh-repo lane now asserts `initApply.runnerCommand` and checks `doctor-report.md` for the concrete active runner command value.
- Direct installed-bin execution and no-fallback proof are unchanged in the acceptance path.
- Daemon-start scaffolding remains absent from the reviewed acceptance path.
- Scope stayed assertion-only inside the reviewed second-remediation target file.
- Frozen smoke command still passes unchanged: `4/4` in `85.22s`.

## Blockers

- `F4` is still blocked until the config-file wrapped-runner lane asserts `configInitPreview.initReportPath` and the corresponding preview `init-report.md` contents, not only the apply report.

## Handoff Notes

- Keep the fix narrow in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`.
- Switch the config-file durable `init-report.md` proof from `configInitApply` to `configInitPreview`, or assert both.
- Rerun the unchanged gate command after that assertion-only edit:

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism
```

## Unresolved Questions

- none beyond the remaining `F4` preview-report assertion gap
