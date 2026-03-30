# Phase 10 Wave 1 Session B Test Report

- Date: 2026-03-27
- Status: completed with blockers
- Session role: tester
- Modal: default
- Skills: none required
- Scope: verify `P10-S0` shared contract freeze only; no production edits
- Pinned BASE_SHA context: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Inputs Read

- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-wave-2-ready-after-s2-s3.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`

## Commands Run

1. `npm run build`
- result: pass

2. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-worker-isolation.integration.test.ts tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
- result: pass (`2` files, `8` tests)

3. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts --no-file-parallelism`
- result: pass (`1` file, `8` tests)

4. verification-only follow-up for Phase 9 baseline seams:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts --no-file-parallelism`
- result: pass (`2` files, `4` tests)

5. verification-only follow-up for runner-surface doc gaps:
- fixture probe for `init` + `doctor` JSON keys
- fixture probe for invalid `CODEXKIT_RUNNER` (`definitely-not-a-real-runner --version`) during `cdx doctor`
- result: reproduced missing runner surface + missing runner-availability diagnostics

## Contract Check Results (`P10-S0`)

1. Public npm artifact shape and `cdx` bin contract freeze in code/docs
- result: pass
- evidence:
  - package/bin constants and command-form contract: `packages/codexkit-daemon/src/workflows/packaging-contracts.ts:20-51`
  - workspace-level contract metadata: `package.json:12-18`
  - public package manifest name/bin: `packages/codexkit-cli/package.json:2-8`
  - docs freeze statements: `README.md:38-50`, `docs/system-architecture.md:59-71`, `docs/workflow-extended-and-release-spec.md:889-927`

2. Runner precedence frozen and code-backed exactly `env > config > default codex exec`
- result: pass
- evidence:
  - constants + order: `packages/codexkit-daemon/src/workflows/packaging-contracts.ts:22-33`
  - resolver behavior: `packages/codexkit-daemon/src/runtime-config.ts:101-139`
  - runtime test coverage: `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:47-86`

3. Worker default launch consumes frozen runner resolution from runtime config
- result: pass
- evidence:
  - worker launch uses `this.context.config.workerRunner.command`: `packages/codexkit-daemon/src/runner/worker-runtime.ts:79`
  - wrapper-arg append test: `tests/runtime/runtime-worker-isolation.integration.test.ts:120-136`

4. `cdx doctor` + `cdx init` shared contract surfaces frozen correctly for later lanes
- result: fail (blocker)
- expected freeze target:
  - runner source visibility, runner availability diagnostics, runner choice in init preview/apply, install-only gating explicit (`phase-10-wave-1-b0-spec-test-design.md:88-90`, `:157-207`)
- observed:
  - install-only gating: present and tested (`tests/runtime/runtime-workflow-phase8-cli.integration.test.ts:201-218`) -> pass
  - runner source visibility in doctor: missing
  - runner availability diagnostics in doctor: missing
  - runner choice surfaced in init preview/apply: missing
- code evidence:
  - doctor workflow has no runner-config resolution, no runner source/command reporting, and only checks bare `codex --version`: `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:142-151`; no runner fields in result/report surface `:23-33`, `:92-121`
  - init report surface omits any runner field: `packages/codexkit-daemon/src/workflows/init-workflow.ts:202-249`
- runtime evidence:
  - with invalid `CODEXKIT_RUNNER`, `cdx doctor --json` still returned `{"status":"healthy","findings":["DOCTOR_RESUMABLE_RUNS_PRESENT"]}` on a git-backed initialized fixture
  - `cdx init --json` and `cdx doctor --json` exposed no top-level runner source/command fields in probe fixtures

5. Exact public install and quickstart command forms frozen consistently across shared docs
- result: pass
- evidence:
  - exact forms align in `README.md:45-49`, `docs/system-architecture.md:62-66`, `docs/workflow-extended-and-release-spec.md:923-927`

6. Repo-local `./cdx` tests not misrepresented as packaged-artifact acceptance
- result: pass
- evidence:
  - control-state explicitly forbids counting repo-local `./cdx` alone as public-package acceptance: `control-state-phase-10-wave-2-ready-after-s2-s3.md:37`
  - B0 artifact freezes packaged-artifact acceptance as later `P10-S4` matrix and says repo-local `./cdx` is supporting only: `phase-10-wave-1-b0-spec-test-design.md:93`, `:273`, `:298-308`

7. Preserved baseline behavior for Phase 8/9 packaging semantics
- result: pass
- evidence:
  - Phase 8 CLI suite passed (`tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`)
  - Phase 9 contract + migration checklist suites passed (`tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`, `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`)

## Defects

1. `P10-S0` shared contract freeze incomplete for `doctor/init` runner surfaces
- severity: blocker for accepting `P10-S0` as fully frozen
- why:
  - B0 frozen contract requires runner source visibility + runner availability diagnostics in `cdx doctor`, and runner choice visibility in `cdx init` preview/apply (`phase-10-wave-1-b0-spec-test-design.md:88-90`, `:157-207`)
  - current candidate does not expose or verify those surfaces in code/runtime behavior

## Verdict For This Session

- `P10-S0` is **not yet acceptable as fully frozen** under the current shared contract definition.
- most contract anchors are present and tested, but runner-related `doctor/init` freeze points are missing in executable behavior and observable surfaces.

## Unresolved Questions

- none
