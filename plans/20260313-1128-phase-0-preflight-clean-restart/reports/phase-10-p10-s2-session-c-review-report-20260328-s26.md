# Phase 10 `P10-S2` Session C Review Report (S26)

**Date**: 2026-03-28
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Slice**: `P10-S2` runner resolution, wrapper support, and doctor/init hardening
**Session**: C reviewer
**Status**: completed
**Role/Modal Used**: code-reviewer / Default
**Model Used**: GPT-5 Codex / Codex CLI
**Skill Route**: `security-best-practices`, `security-threat-model`

## Executive Summary

`P10-S2` is not ready for verdict. I found two contract-breaking issues in the runner-selection path and one verification gap. The highest-risk path is local preview/apply trust: `cdx init` accepts an old preview after the active runner changes, so managed writes can execute under a different runner selection than the preview the operator reviewed.

## Scope And Host Caveat

- Stayed in `P10-S2` only.
- Did not reopen `P10-S1`.
- Did not widen into `P10-S3`, `P10-S4`, or release-readiness closure.
- Keep this host caveat explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Threat-Boundary Notes

- Primary trust boundary in this slice is local operator or repo-controlled runner selection (`CODEXKIT_RUNNER`, `.codexkit/config.toml`) crossing into repo-mutating `cdx init` and subprocess-selection logic.
- Security objective here is integrity and operator transparency, not internet-facing hardening.
- The main abuse path is local config or env drift causing a different effective runner or fallback path than the operator reviewed before mutation.

## IMPORTANT

### R1. `cdx init --apply` does not bind preview approval to the selected runner

- Evidence:
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts:118-159`
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts:326-345`
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts:349-365`
- `buildInitPreviewFingerprint()` omits both runner source and effective runner command. The later `INIT_APPLY_REQUIRES_PREVIEW` gate compares only that fingerprint.
- Local repro on a clean git fixture:
  - preview: `cdx init --approve-protected --approve-managed-overwrite --json`
    - observed `runnerSource: "default"`
    - observed `runnerCommand: "codex exec"`
  - apply: `CODEXKIT_RUNNER='"/bin/cat" /dev/null' cdx init --apply --approve-protected --approve-managed-overwrite --json`
    - observed `runnerSource: "env-override"`
    - observed `runnerCommand: "/bin/cat /dev/null"`
    - observed `applyExecuted: true`
- Impact:
  - breaks frozen `F7` preview/apply runner consistency
  - creates a local mutation surprise across the runner-config trust boundary
  - weakens the preview-first guarantee because the operator can review one runner and apply under another
- Recommended action:
  - include `runnerSource`, `runnerCommand`, and selected-runner validity state in the preview fingerprint
  - add a CLI test that preview under default then apply under env/config override blocks with `INIT_APPLY_REQUIRES_PREVIEW`

### R2. Empty `[runner] command = ""` silently falls back to default instead of blocking as malformed

- Evidence:
  - `packages/codexkit-daemon/src/runtime-config.ts:141-170`
  - `packages/codexkit-daemon/src/runtime-config.ts:204-229`
  - `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:158-196`
- `readRunnerCommandFromConfig()` returns `null` for an explicitly present empty command. That sends resolution into the default `codex exec` path instead of preserving config precedence and surfacing a typed invalid-runner diagnostic.
- Local repro on an installed fixture:
  - write `.codexkit/config.toml` with `[runner]` and `command = ""`
  - run `cdx doctor --json`
  - observed `runnerSource: "default"`
  - observed `runnerCommand: "codex exec"`
  - observed `status: "healthy"`
  - observed no `DOCTOR_SELECTED_RUNNER_INVALID`
- Impact:
  - violates the exact precedence contract by silently skipping an explicit config selection
  - violates the malformed-runner handling contract
  - hides operator misconfiguration behind a healthy-looking default
- Recommended action:
  - treat an explicitly present but empty config command as `selectionState: "invalid"`
  - add a doctor CLI fixture for empty-config runner and assert `DOCTOR_SELECTED_RUNNER_INVALID`

## MODERATE

### R3. Frozen `P10-S2` fixture coverage is incomplete for CLI acceptance

- Evidence:
  - `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:303-373`
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts:84-118`
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts:252-289`
- Current tests pin:
  - env-selected preview surfacing
  - env invalid doctor block
  - env wrapped-runner availability
  - runtime-level invalid-selection worker-launch guard
- Current tests do not pin the full frozen B0 matrix end-to-end:
  - `F2` config-selected wrapped runner via CLI init/doctor
  - `F3` env override beating an existing config-selected runner
  - `F6` incompatible selected runner on the CLI contract path
  - `F7` preview/apply runner binding across runner changes
  - supplemental invalid-selection guard on the public CLI path
- Impact:
  - the two defects above slipped through a green `P10-S2` suite because the suite is mostly env-path spot checks, not the full frozen fixture matrix
- Recommended action:
  - add explicit CLI fixtures for `F2`, `F3`, `F6`, and the runner-rebinding case in `F7`
  - keep the existing runtime guard test, but add one public-CLI assertion for invalid selection to match the frozen contract language

## Verification Notes

- Docs and artifacts read first as requested:
  - `README.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
  - `docs/project-roadmap.md`
  - `docs/non-functional-requirements.md`
  - `docs/verification-policy.md`
  - `docs/workflow-extended-and-release-spec.md`
  - latest `P10-S2` control-state, Session A summary, and B0 artifact
- Local review verification performed:
  - code inspection of runner resolution, init, doctor, runtime launch, and runtime tests
  - direct CLI repro for runner drift across init preview/apply
  - direct CLI repro for empty config runner silent fallback
- Additional command run:
  - `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- Result of that command:
  - the script expands to the whole runtime suite, not only the target file
  - unrelated existing failures appeared in `tests/runtime/runtime-daemon.integration.test.ts` and `tests/runtime/runtime-cli.integration.test.ts`
  - several failures are consistent with stderr JSON parsing being polluted by Node SQLite experimental warnings, which matches the known risk already noted by Session A
  - I did not treat those unrelated failures as `P10-S2` findings

## Unresolved Questions

- none
