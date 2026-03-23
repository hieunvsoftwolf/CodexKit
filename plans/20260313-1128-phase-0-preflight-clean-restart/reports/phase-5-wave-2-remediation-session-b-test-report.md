# Phase 5 Wave 2 Remediation Session B Test Report

Date: 2026-03-23
Status: completed
Role/Modal Used: tester / default testing modal
Model Used: GPT-5 Codex
Pinned BASE_SHA: `df037409230223e7813a23358cc2da993cb6c67f`

## Scope And Source Of Truth

- current remediated Wave 2 candidate repo tree
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-wave-2-remediation-verification-ready-after-sa.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md` (frozen acceptance baseline)
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-wave-2-remediation-session-a-implementation-summary.md` (handoff context only)
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-wave-2-session-d-verdict.md`
- `docs/workflow-parity-core-spec.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`

## Frozen B0 Checks Executed First (Unchanged)

1. `git rev-parse HEAD`
- result: `df037409230223e7813a23358cc2da993cb6c67f`

2. `git merge-base --is-ancestor df037409230223e7813a23358cc2da993cb6c67f HEAD`
- result: pass (`exit:0`)

3. `git status --short`
- result: candidate tree contains the expected Wave 2 implementation/test deltas plus report artifacts

4. `rg --files tests/runtime packages/codexkit-cli packages/codexkit-daemon packages/codexkit-core`
- result: runtime/workflow implementation and test inventory present, including:
  - `tests/runtime/runtime-workflow-wave1.integration.test.ts`
  - `tests/runtime/runtime-workflow-wave2.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

5. `npm run test:runtime`
- result: pass (`12` files, `64` tests)

6. `node ./cdx --help`
7. `node ./cdx brainstorm --help`
8. `node ./cdx plan --help`
9. `node ./cdx cook --help`
- result: all four fail unchanged with `SyntaxError: Unexpected identifier 'pipefail'`
- cause: frozen B0 command shape invokes the Bash launcher through Node instead of executing the wrapper directly

## Direct Verification Of The Four Remediated Areas

### 1) Post-approval non-auto `cdx cook` continuation and checkpoint advancement

Executed:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave2.integration.test.ts --no-file-parallelism`

Observed:
- targeted test passes:
  - `non-auto cook approval responses resume workflow progression and checkpoint advancement`
- assertions exercised through `RuntimeController`:
  - initial non-auto cook run pauses at `post-research`
  - first approval response resumes same run and advances pending checkpoint to `post-plan`
  - second approval response resumes same run and advances pending checkpoint to `post-implementation`
  - final approval response completes through post-implementation
  - persisted run metadata checkpoint advances to `post-research` then `post-implementation`

Conclusion:
- remediation verified directly

### 2) Archived-plan immutability under blocked `validate` and `red-team`

Executed:
- same targeted Wave 2 suite above

Observed:
- targeted test passes:
  - `blocked validate/red-team keep archived plans immutable`
- assertions prove:
  - archive transitions `plan.md` to `status: "archived"`
  - blocked `validate` emits `PLAN_VALIDATE_BLOCKED_ARCHIVED`
  - blocked `red-team` emits `PLAN_RED_TEAM_BLOCKED_ARCHIVED`
  - `plan.md` content after blocked reruns is byte-identical to archived state
  - phase file content after blocked reruns is byte-identical to archived state

Conclusion:
- remediation verified directly

### 3) Repeated inline history accumulation for `validate` and `red-team`

Executed:
- same targeted Wave 2 suite above

Observed:
- targeted test passes:
  - `repeated validate/red-team runs append durable inline history`
- assertions prove repeated runs append instead of overwrite:
  - `## Validation Log` contains at least two `- Timestamp:` entries
  - `## Red Team Review` contains at least two `- Timestamp:` entries
  - phase `## Validation Notes` contains repeated durable entries
  - phase `## Red Team Notes` contains repeated durable entries

Conclusion:
- remediation verified directly

### 4) Truthful NFR evidence mapping for `NFR-1.3`, `NFR-3.2`, and `NFR-5.2`

Executed:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts --no-file-parallelism`
- inspected `.tmp/phase-5-wave2-nfr-evidence.json`

Observed:
- harness suite passes
- generated evidence artifact records the current commit SHA and host manifest
- `NFR-1.3` evidence now maps to two explicit `cdx cook <plan-path>` re-entry runs with no duplicate live-task hydration growth
- `NFR-3.2` evidence now maps to unambiguous `cdx plan --fast` and `cdx plan validate <plan-path>` command shapes executing without extra prompts or injected approvals
- `NFR-5.2` evidence now maps to:
  - durable success artifact: `implementation-summary.md`
  - typed blocked diagnostic on archived-plan validation

Conclusion:
- remediation verified directly

## Wave 1 Stability

Executed:
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts tests/runtime/runtime-workflow-wave2.integration.test.ts tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts --no-file-parallelism`
- `npm run test:runtime`

Observed:
- targeted regression bundle passes (`3` files, `12` tests)
- full runtime suite passes (`12` files, `64` tests)
- accepted Wave 1 behaviors remain green, including:
  - explicit-only approval inheritance
  - plan artifact generation and exact checkpoint ids
  - suggested-plan isolation
  - hydration dedupe/skip behavior
  - code-mode task reuse and fallback hydration behavior

Conclusion:
- no accepted Wave 1 regression observed

## Verification Notes And Gaps

1. The frozen B0 `node ./cdx ... --help` probes are mechanically invalid against the repo launcher and cannot be treated as product failures by themselves.
2. Executing the wrapper directly also does not expose a real `--help` surface on these workflow commands:
- `./cdx --help` returns `CLI_USAGE` `unsupported command: .`
- `./cdx brainstorm --help` and `./cdx plan --help` treat `--help` as missing required positional input
- `./cdx cook --help` starts an interactive cook path instead of showing help
3. This did not block the rerun because the required command-surface and workflow behavior were verified through the frozen runtime floor, the targeted workflow suites, and direct artifact assertions.

## Exit-Criteria Mapping

- frozen B0 checks unchanged first: satisfied
- post-approval non-auto `cdx cook` continuation and checkpoint advancement: pass
- archived-plan immutability under blocked `validate` and `red-team`: pass
- repeated inline history accumulation for `validate` and `red-team`: pass
- truthful NFR evidence mapping for `NFR-1.3`, `NFR-3.2`, and `NFR-5.2`: pass
- accepted Wave 1 behavior remains stable: pass

## Blockers

- none

## Unresolved Questions

- should future frozen B0 command lists switch help probes from `node ./cdx ...` to an executable wrapper or another stable CLI inspection method?
- should Phase 5 define explicit `--help` behavior for workflow commands, or is the current no-help command surface acceptable?
