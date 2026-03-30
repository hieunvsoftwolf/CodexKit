# Phase 10 `P10-S4` Session C Review Report (S49)

**Date**: 2026-03-30
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S4` only
**Status**: completed
**Role/Modal Used**: code-reviewer / Default (prompt-contract fallback; host exposes no named reviewer role)
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## IMPORTANT

### Installed-artifact lanes do not execute the installed `cdx` bin directly

- The helper resolves an internal JS entrypoint and the installed-artifact probes execute `node <entrypoint>` instead of the installed `cdx` bin path.
- This violates the frozen `P10-S4` packaged-artifact execution rule, which requires resolving and executing the installed `cdx` executable itself and capturing that real installed-bin path in evidence.

### Frozen acceptance matrix remains incomplete

- `F1` fresh repo lane is missing the full installed-artifact `init` preview/apply plus `doctor` sequence.
- `F3` install-only lane omits the required `review` and `test` blocked probes.
- `F4` wrapped-runner lane proves only env override and does not prove the required config-file-selected variant or env-over-config precedence through the packaged artifact.

## MODERATE

### Smoke lanes prepend `cdx daemon start --once` before the frozen public path

- The git-backed, install-only, and wrapped-runner smoke lanes start with `cdx daemon start --once`.
- The accepted public quickstart path and frozen `P10-S4` B0 matrix omit that step, so this scaffolding weakens proof of the exact outside-user flow.

## Verification Notes

- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
  - result: pass (`4/4`)
- No smoke-lane fallback to repo-local `./cdx` was found.
- The issues are incomplete packaged-artifact proof, not checkout fallback.

## Blockers

- none listed separately by reviewer, but the `IMPORTANT` findings keep `P10-S4` from acceptance

## Handoff Notes

- Repair the helper first: resolve and execute the installed packaged-artifact `cdx` bin path directly, and surface that resolved path in assertions and evidence.
- Bring the smoke matrix back to the frozen B0 shape:
  - fresh/install-only `init` preview/apply plus `doctor`
  - install-only `review` and `test` probes
  - wrapped-runner config-file plus env-precedence variants
- Remove `cdx daemon start --once` from the acceptance path unless a separate contract artifact explicitly adds it.
