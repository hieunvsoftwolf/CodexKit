# Phase 10 `P10-S4` Remediation Session C Review Report (S53)

**Date**: 2026-03-30
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S4` remediation only
**Status**: blocked
**Role/Modal Used**: code-reviewer / Default (prompt-contract fallback; host exposes no named reviewer role)
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## IMPORTANT

### `F4` still lacks durable `init-report.md` proof in the wrapped-runner lane

- The frozen contract requires durable `init-report.md` and `doctor-report.md` evidence for wrapped-runner selection.
- The wrapped-runner lane currently reads the doctor reports but does not assert `initReportPath` or `init-report` contents for either the config-file or env-override variants.

## MODERATE

### `F1` fresh-repo proof is still not fully asserted against the frozen checks

- The lane verifies `initPreview.runnerCommand`, but not `initApply.runnerCommand`.
- Its `doctor-report` check matches the `Active runner command:` label rather than the effective command value required by the frozen contract.

## Closed Findings

- Direct installed-bin execution is fixed.
- `F3` looks closed.
- Daemon-start scaffolding is removed from the acceptance path.
- No repo-local fallback was found in the `P10-S4` smoke helper or suite.

## Verification Notes

- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
  - result: pass (`4/4`) in `156.02s`

## Blockers

- `F4` still lacks durable `init-report.md` proof in the wrapped-runner lane
- `F1` still does not fully assert the effective runner command across fresh-repo apply/report checks

## Handoff Notes

- Add wrapped-runner assertions for `initReportPath` plus `init-report` contents in both config-file and env-override variants.
- Tighten the fresh-repo lane to assert `initApply.runnerCommand` and the actual command value in `doctor-report.md`, not just the header.
- Rerun the exact frozen smoke command after those assertion-only fixes.
