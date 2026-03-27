# Phase 9 Second-Remediation Session B Test Report

- Date: 2026-03-26
- Status: completed with findings
- Session role: tester
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Scope + Guardrails

- Used source of truth listed in prompt.
- Did not use reviewer rerun output or verdict rerun output as evidence inputs.
- Did not modify production code.
- Ran scoped Phase 9 suite first.
- Added only verification-only follow-up for a stable-harness gap.

## Commands Executed

1. Scoped required suite:

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism
```

Result:
- `Test Files: 1 failed | 4 passed (5)`
- `Tests: 1 failed | 5 passed (6)`
- failure: `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts` timed out at 5s in `publishes schema-valid phase9 evidence and rejects invalid host manifest shapes`

2. Verification-only follow-up for stable-harness risk:

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts --no-file-parallelism
```

Result:
- `Test Files: 1 passed (1)`
- `Tests: 2 passed (2)`
- runtime near threshold: file test duration `4947ms`, failing case `4651ms` (close to 5000ms timeout)

## Required Verification Outcomes

1. Candidate identity stable across golden, chaos, migration, and release synthesis: pass
- `.tmp/validation-golden-evidence.json`
- `.tmp/validation-chaos-evidence.json`
- `.tmp/validation-migration-evidence.json`
- `.tmp/phase-9-release-readiness-metrics.json`
- All carry same:
  - `baseSha`: `8a7195c2a98253dd1060f9680b422b75d139068d`
  - `candidateSha`: `8a7195c2a98253dd1060f9680b422b75d139068d-dirty-376515ac8aa87695`

2. Same-run evidence no longer rejected as foreign from `.tmp/**` drift: pass
- `release-readiness-report.md` suite summary:
  - `validation-golden: accepted`
  - `validation-chaos: accepted`
  - `validation-migration: accepted`
- no foreign-candidate rejection markers for those Phase 9 bundles.

3. Contract-grade executable proof exists for `NFR-3.6`, `NFR-6.3`, `NFR-7.4`: pass
- `NFR-3.6` durable artifact:
  - `.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-57254d32868e.md`
  - includes measured current operator-action count vs frozen reference.
- `NFR-6.3` durable artifact:
  - `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-e313a11acbf5.md`
  - includes inspected surfaces count and detected restatement events `0`.
- `NFR-7.4` durable artifact:
  - `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-673054707ab2.md`
  - includes sequential vs parallel elapsed/reliability with path divergence asserted true.

4. Every migration checklist row has at least one durable artifact ref: pass
- checklist:
  - `.tmp/migration-validation-checklist.md`
- each row evidence path points under:
  - `.tmp/phase9-durable-artifacts/validation-migration/`
- existence check over all rows: true.

5. `NFR-8.1` honest behavior (pass only with >=2 real versions, else blocked): pass
- output artifact:
  - `.tmp/phase9-host-matrix-smoke.json`
  - `status: blocked`
  - `discoveredVersionCount: 1`
  - note states fewer than two real Codex versions discovered.
- logic in test contract enforces:
  - blocked default unless `discoverCodexVersionCandidates().length >= 2`
  - then pass only if all discovered versions pass smoke.

6. Release-readiness preserves honest non-pass semantics: pass
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- keeps `Release Verdict: fail`
- keeps blocked/fail rows explicit (example: `NFR-8.1 blocked`, `NFR-8.4 fail`) and open blocker list.

## Findings

### F1 (IMPORTANT): Scoped Phase 9 suite is timing-fragile on contract test

Evidence:
- required scoped run failed due timeout in `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts` (5s limit)
- isolated rerun passed but near limit (`4651ms` case duration, `4947ms` file duration)

Impact:
- verification signal for Phase 9 is non-deterministic under current timeout budget.
- candidate acceptance on one-shot scoped execution remains unstable.

Classification:
- stable-harness gap (verification reliability), not production runtime behavior regression.

## Conclusion

- Must-verify contract points requested in this session validate as pass with current artifacts.
- One verification stability defect remains: timeout fragility in required scoped suite execution.

## Unresolved Questions

- none
