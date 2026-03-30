# Phase 10 Remediation Session A Implementation Summary

- Date: 2026-03-27
- Status: completed
- Session role: fullstack-developer
- Modal: default
- Skills: none required
- Scope: `P10-S0` remediation only (runner surfaces, authoritative contract seam binding, quoted-command-safe runner parsing)

## Inputs Read

- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-remediation-reroute-after-s6.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-d-verdict.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`

## Implemented Remediation

### 1) `cdx doctor` runner-facing shared contract surfaces

Updated `packages/codexkit-daemon/src/workflows/doctor-workflow.ts` to:

- include top-level JSON/result fields:
  - `runnerSource`
  - `runnerCommand`
  - `runnerAvailable`
- render these same runner fields in `doctor-report.md`
- add selected-runner availability probing for the resolved runner command source
- fail blocked with typed diagnostics when selected runner is unavailable/incompatible:
  - `DOCTOR_SELECTED_RUNNER_UNAVAILABLE`
  - `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
  - `DOCTOR_SELECTED_RUNNER_INVALID`
- keep frozen precedence intact by consuming the already resolved runtime runner (`env > config > default`)

### 2) `cdx init` runner choice/source surfacing in preview/apply

Updated `packages/codexkit-daemon/src/workflows/init-workflow.ts` to:

- include top-level JSON/result fields:
  - `runnerSource`
  - `runnerCommand`
- include runner source/command in `init-report.md` preview/apply output
- keep existing install-only and preview/apply gating behavior unchanged

### 3) Public package + `cdx` bin contract authoritative seam + drift catching

Updated `packages/codexkit-daemon/src/workflows/packaging-contracts.ts` to keep one explicit package/bin seam object:

- `PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT`
- derived constants continue from this seam (`PHASE10_PUBLIC_NPM_PACKAGE_NAME`, `PHASE10_PUBLIC_CLI_BIN_NAME`)

Reduced duplicate manifest-side contract metadata:

- removed root workspace `bin` declaration from `package.json`
- removed redundant `codexkitPhase10Contract` metadata blocks from:
  - `package.json`
  - `packages/codexkit-cli/package.json`

Bound manifests + docs to the seam in tests:

- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` now asserts:
  - seam constants
  - CLI package `name` + `bin` map match seam
  - root manifest no longer carries duplicate contract metadata
  - required command forms exist in `README.md`, `docs/system-architecture.md`, `docs/workflow-extended-and-release-spec.md`

### 4) Quoted-command-safe runner override/config parsing

Updated `packages/codexkit-daemon/src/runtime-config.ts`:

- replaced whitespace split parsing with quoted-command-safe tokenization
- supports single quotes, double quotes, escaped characters, and spaced executable paths/args
- keeps precedence frozen (`env > config > default`)

Added/updated verification:

- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
  - validates quoted parsing for env/config runner commands
  - validates doctor/init runner surfaces and blocked unavailable-runner behavior
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - validates `init` and `doctor` expose runner fields
  - validates `doctor` blocks with `DOCTOR_SELECTED_RUNNER_UNAVAILABLE` for invalid selected runner

## Docs Updates

Updated frozen contract wording to match executable behavior:

- `README.md`
- `docs/system-architecture.md`
- `docs/workflow-extended-and-release-spec.md`

Added explicit statements for:

- `cdx doctor` runner source/command surfacing + blocked typed diagnostics when selected runner is unavailable
- `cdx init` preview/apply runner source/command surfacing

## Verification Executed

1. `npm run build`
- result: pass

2. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-worker-isolation.integration.test.ts --no-file-parallelism`
- result: pass
- summary: `3` files passed, `17` tests passed

## Scope Guardrail Check

- no widening into full `P10-S1` publishable artifact lane
- no widening into full `P10-S2` hardening lane beyond runner-surface/parsing blockers
- no widening into full `P10-S3` onboarding/docs lane beyond frozen contract wording alignment
- no `P10-S4` packaged-artifact harness implementation
- preserved frozen runner precedence and install-only gating behavior

## Unresolved Questions

- none
