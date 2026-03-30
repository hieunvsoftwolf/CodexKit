# Phase 10 Remediation Session B Test Report

- Date: 2026-03-27
- Status: completed
- Session role: tester
- Modal: default
- Skills: none required
- Scope: verify remediated `P10-S0` contract slice only; no production edits
- Pinned BASE_SHA context: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Inputs Read

- `README.md`
- `package.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-remediation-wave-2-ready-after-s7.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-d-verdict.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`

## Commands Run

1. `npm run build`
- result: pass

2. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts tests/runtime/runtime-workflow-phase8-cli.integration.test.ts tests/runtime/runtime-worker-isolation.integration.test.ts --no-file-parallelism`
- result: pass (`3` files, `17` tests)

## Contract Check Results (`P10-S0` remediation scope)

1. `cdx doctor` now surfaces active runner source + active runner command + fail-fast selected-runner availability diagnostics
- result: pass
- evidence:
  - runtime coverage: `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` (`doctor and init surface runner source and command; doctor blocks unavailable selected runner`)
  - compatibility coverage retained: `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` (`doctor surfaces explicit host-capability blocks and stale or broken install findings`)

2. `cdx init` now surfaces active runner source + active runner command in preview/apply
- result: pass
- evidence:
  - runtime coverage: `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
  - compatibility coverage retained: `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` (`supports init, doctor, and update with preview-first and protected-path gating`)

3. public package and `cdx` bin contract bound to one authoritative seam with drift-catching verification
- result: pass
- evidence:
  - seam and drift assertions in `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
  - contract constants and command forms validated against manifests + docs in that suite

4. runner override/config parsing is quoted-command-safe for wrapped commands and executable paths with spaces
- result: pass
- evidence:
  - `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` (`resolves runner in order with quoted command-safe parsing`)

5. frozen runner precedence remains `env override` -> `.codexkit/config.toml` -> default `codex exec`
- result: pass
- evidence:
  - precedence assertions in `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

6. accepted Phase 8/9 packaging semantics and install-only gating remain intact
- result: pass for the narrowed Session A subset
- evidence:
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - `tests/runtime/runtime-worker-isolation.integration.test.ts`

## Verification-Only Follow-Up

- none added
- reason: after executing the required narrowed `P10-S0` subset unchanged, no stable-harness or doc-derived gap remained for this remediation slice

## Defects

- none found in the remediated `P10-S0` contract slice

## Session Conclusion

- narrowed `P10-S0` remediation scope passes on current candidate tree
- this report does not widen into `P10-S1` through `P10-S4`

## Unresolved Questions

- none
