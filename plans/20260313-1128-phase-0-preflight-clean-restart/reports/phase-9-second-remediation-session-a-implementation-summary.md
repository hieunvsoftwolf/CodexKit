# Phase 9 Second-Remediation Session A Implementation Summary

- Date: 2026-03-26
- Status: completed
- Scope: Phase 9 validation + release evidence contracts only
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`

## Summary

- Stabilized one candidate identity across same-run Phase 9 bundles and release synthesis.
- Replaced invalid proofs with executable checks for `NFR-3.6`, `NFR-6.3`, `NFR-7.4`, `NFR-8.1`.
- Enforced durable migration checklist row evidence refs (no inline JSON, no ephemeral fixture refs in checklist rows).
- Preserved honest release fail/blocked behavior for still-unproven metrics.

## Implemented Changes

- `tests/runtime/helpers/phase9-evidence.ts`
  - candidate digest now excludes volatile generated artifacts under `.tmp/**`.
  - effect: golden, chaos, migration bundles and release synthesis now resolve one same candidate in one run.

- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
  - `NFR-3.6`: replaced hardcoded counts with measured plan->cook operator trace vs frozen reference trace shape.
  - `NFR-6.3`: replaced substring heuristic with restatement-event counting over structured cook diagnostics, approvals, and message surfaces from `run show`.

- `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts`
  - `NFR-7.4`: parallel benchmark path now actually diverges from sequential path (async batched completion vs serialized completion).
  - proof now requires path divergence plus <=10% failure/retry delta.

- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`
  - `NFR-8.1`: removed fake version shims; host matrix now discovers real Codex binaries/versions and runs smoke per discovered version.
  - if fewer than two real versions found, metric is `blocked` with explicit reason.
  - every checklist row now gets a dedicated durable row-evidence artifact; checklist evidence cells point to durable refs.

## Verification

- `npm run -s typecheck` -> pass
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism` -> pass
  - Test Files: `5 passed`
  - Tests: `6 passed`

## Evidence Highlights

- Same candidate identity across all same-run bundles and release synthesis:
  - `.tmp/validation-golden-evidence.json`
  - `.tmp/validation-chaos-evidence.json`
  - `.tmp/validation-migration-evidence.json`
  - `.tmp/phase-9-release-readiness-metrics.json`
- Repaired proof artifacts:
  - `NFR-3.6`: `.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-*.md`
  - `NFR-6.3`: `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-*.md`
  - `NFR-7.4`: `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-*.md`
  - `NFR-8.1`: `.tmp/phase9-durable-artifacts/validation-migration/host-matrix-smoke-*.json`
- Durable migration row evidence refs:
  - `.tmp/migration-validation-checklist.md` rows all reference `.tmp/phase9-durable-artifacts/validation-migration/migration-*-row-evidence-*.md`

## Current Metric State (Owned Set)

- `NFR-3.6`: pass
- `NFR-6.3`: pass
- `NFR-7.4`: pass
- `NFR-8.1`: blocked (fewer than two real Codex CLI versions discovered in this environment)

## Unresolved Questions

- none
