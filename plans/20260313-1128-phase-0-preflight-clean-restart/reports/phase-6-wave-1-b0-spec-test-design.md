# Phase 6 Wave 1 B0 Spec-Test Design

**Date**: 2026-03-23
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default
**Model Used**: GPT-5 Codex / Codex CLI
**Pinned BASE_SHA**: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## Scope And Guardrails

Source of truth used:
- repo state at `cfdac9eecc918672082ab4d460b8236e2aea9566`
- current Phase 6 docs, acceptance criteria, NFR contracts, and planner decomposition report

Read first and used:
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-wave-1-ready-after-planner.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-base-freeze-rerun-3-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-planner-decomposition-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/tdd-test-plan.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`

Explicit non-goals preserved:
- no production edits under `packages/**`
- no Wave 2 verification for `fix`, team runtime, `cdx team`, or phase-close evidence
- no edits to existing Phase 5 tests
- no inspection of candidate implementation artifacts or implementation summaries

## Verification-Owned Files Added

- `tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-review.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-test.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`

No fixture additions were required yet under `tests/fixtures/phase6/**`.

## Design Intent

Wave 1 B0 covers only the stable contracts already frozen in the docs:
- CLI command-shape acceptance for unambiguous `review`, `test`, and `debug` commands
- typed CLI rejection for unsupported shapes per `NFR-3.2` and `NFR-3.3`
- `cdx review` checkpoint and report publication contract
- `cdx test` preflight-first behavior plus explicit blocked/degraded behavior
- `cdx debug` route selection and report publication contract

The tests intentionally avoid:
- `fix` route semantics
- team runtime behavior
- Phase 6 closeout evidence harness
- implementation-specific internals below the public CLI and durable artifact surface

## Added Test Matrix

### `runtime-workflow-phase6-cli.integration.test.ts`

Covers:
- `cdx review codebase`
- `cdx review codebase parallel`
- `cdx test <context>`
- `cdx test ui <url>`
- `cdx test <context> --coverage`
- `cdx debug <issue>`
- typed rejection for unsupported shapes:
  - `cdx review codebase serial`
  - `cdx test ui --coverage`
  - `cdx debug`

Spec assertions:
- unambiguous commands must not fail with CLI usage prompts
- accepted commands must enter the owning workflow and record Phase 6 checkpoint ids
- unsupported shapes must fail with top-level `CLI_USAGE`
- blocking diagnostics must include typed `details.code`, `details.cause`, and `details.nextStep`

Primary contracts:
- `NFR-3.2`
- `NFR-3.3`
- Phase 6 Section 5.2
- Phase 6 Section 6.2
- Phase 6 Section 7 reserved out of scope
- Phase 6 Section 8 public debug surface

### `runtime-workflow-phase6-review.integration.test.ts`

Covers:
- `cdx review codebase` on a clean git fixture
- bare `cdx review` scope-selection prompt contract

Spec assertions:
- codebase review records `review-scout`, `review-analysis`, `review-publish`
- codebase review publishes a durable `review-report.md`
- clean repo review must explicitly say `no findings`
- report artifact must be traceable from `run show`
- bare `cdx review` must stop for explicit scope selection before review checkpoints start

Primary contracts:
- Phase 6 Section 5.2 through 5.5
- `NFR-5.2`
- `NFR-6.1` indirectly through durable artifact publication

### `runtime-workflow-phase6-test.integration.test.ts`

Covers:
- default `cdx test <context>` on a repo with no runnable test prerequisites
- `cdx test ui <url>` without browser-specific prerequisites

Spec assertions:
- both flows must execute preflight first
- blocked or degraded states must be explicit, not silent success
- `test-report.md` must still be durable and inspectable
- diagnostics must remain typed and include a recovery next step
- test reports must preserve `## Unresolved Questions`

Primary contracts:
- Phase 6 Section 6.3 through 6.6
- `NFR-3.3`
- `NFR-5.2`

### `runtime-workflow-phase6-debug.integration.test.ts`

Covers:
- `cdx debug database connection pool timeouts` route classification

Spec assertions:
- debug flow records the exact checkpoint chain:
  - `debug-precheck`
  - `debug-route`
  - `debug-hypotheses`
  - `debug-evidence`
  - `debug-conclusion`
- route classification must be `database`
- durable `debug-report.md` must be published
- report must include root-cause, evidence, and recommended next action content

Primary contracts:
- Phase 6 Section 8 debug outcome
- planner slice `P6-S4`
- `NFR-5.2`
- `NFR-6.1`

## Why These Tests Are The Right Wave 1 Cut

- they freeze the public command shapes before candidate implementation can bias acceptance
- they prove the new workflows publish durable artifacts instead of transient chat-only output
- they isolate Wave 1 to `P6-S1 + P6-S2 + P6-S3 + P6-S4` and avoid Wave 2 surface
- they give Session B concrete unchanged tests to run first, matching verification policy

## Planned Tester Execution

Session B should execute these unchanged first:

```bash
npm test -- --run tests/runtime/runtime-workflow-phase6-cli.integration.test.ts
npm test -- --run tests/runtime/runtime-workflow-phase6-review.integration.test.ts
npm test -- --run tests/runtime/runtime-workflow-phase6-test.integration.test.ts
npm test -- --run tests/runtime/runtime-workflow-phase6-debug.integration.test.ts
```

If the implementation lands partial support first, failures should be read as contract gaps, not grounds to weaken expectations.

## Mapping To Phase 6 Wave 1 Exit Targets

| Wave 1 target | Verification file(s) |
|---|---|
| CLI public surface for `review`, `test`, `debug` | `runtime-workflow-phase6-cli.integration.test.ts` |
| `cdx review` durable artifact and scope-selection behavior | `runtime-workflow-phase6-review.integration.test.ts` |
| `cdx test` preflight-first and explicit blocked/degraded behavior | `runtime-workflow-phase6-test.integration.test.ts` |
| `cdx debug` route classification and durable report | `runtime-workflow-phase6-debug.integration.test.ts` |

## Notes For Session B

- treat these files as frozen expectations unless Phase 6 docs change
- run them unchanged before adding any verification-only amendments
- if a failure comes from missing harness capability rather than product behavior, document that explicitly before adding helper coverage
- do not add `fix` or `team` coverage in this wave

## Verification Run Status

- tests authored: yes
- tests executed in this B0 session: no
- reason not executed: this session freezes expectations against `BASE_SHA` and must not inspect the candidate implementation branch; execution belongs to Session B after Session A lands

## Blockers

- none

## Unresolved Questions

- whether the eventual implementation will use explicit result fields `reviewReportPath`, `testReportPath`, `debugReportPath`, and `route` exactly as asserted here; if field names drift, Session B should treat that as a contract mismatch first, not auto-rewrite the tests
