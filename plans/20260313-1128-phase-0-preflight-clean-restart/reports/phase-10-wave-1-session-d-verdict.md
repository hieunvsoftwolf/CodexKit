# Phase 10 Wave 1 Session D Verdict

**Date**: 2026-03-27
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Session**: D lead verdict
**Status**: completed
**Role/Modal Used**: lead verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, worktree beyond pinned base)
**Skill Route**: none required

## Decision

Fail the current `P10-S0` shared contract freeze candidate.

This fail is forced by explicit frozen-contract misses, not by style preference. The tester blocker is a direct executable miss against required `cdx doctor` and `cdx init` runner-facing surfaces. One reviewer finding is also a hard blocker because the public package and `cdx` bin contract is still duplicated across multiple seams instead of frozen in one authoritative place. The remaining reviewer parsing issue is lower severity, but it still belongs in the minimum remediation set because `P10-S0` already froze wrapper commands plus fixed args as supported contract.

## Weighting Used

1. current candidate repo tree
2. frozen `P10-S0` contract sources:
   - `README.md`
   - `docs/system-architecture.md`
   - `docs/workflow-extended-and-release-spec.md`
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
3. Session B tester report
4. Session C reviewer report

No new Session D test run was needed. The blocking calls are already visible in the current tree and are matched by the frozen acceptance artifact.

## Evidence Considered

Reports:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-verdict-ready-after-s4-s5.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`

Current-tree seams inspected:
- `package.json`
- `packages/codexkit-cli/package.json`
- `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- `packages/codexkit-daemon/src/runtime-config.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

## Verdict Mapping By Contract Impact

### 1. Missing `doctor/init` runner-facing surfaces is a hard `P10-S0` blocker

Verdict weight: hard fail.

Why it blocks:
- B0 froze these as required shared-contract surfaces:
  - `cdx doctor` must surface active runner source and effective runner command
  - `cdx doctor` must fail early with typed diagnostics when the selected runner is unavailable
  - `cdx init` preview must surface runner choice before mutation
- current code does not implement those surfaces

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts` still reports only repo/tool/install findings and probes bare `codex --version`; the result/report shape has no runner fields
- `packages/codexkit-daemon/src/workflows/init-workflow.ts` report rendering includes repo class, planned writes, conflicts, diagnostics, and install-only state, but no runner choice or runner source

Frozen contract:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`: lines 88-90 and 157-207

Tester weight:
- highest
- this is reproduced executable behavior, not only a review inference
- it hits the shared contract directly and blocks accepting the freeze as complete

### 2. Public package and `cdx` bin contract is not frozen in one authoritative seam

Verdict weight: hard fail.

Why it blocks:
- B0 froze exactly one public npm artifact and that artifact owning the public `cdx` bin contract
- current candidate still spreads that contract across:
  - root `package.json`
  - `packages/codexkit-cli/package.json`
  - daemon-side `packaging-contracts.ts`
- current verification only pins daemon constants, so manifest drift can happen without a failing freeze test

Current-tree evidence:
- `package.json` still declares a root `cdx` bin and a `codexkitPhase10Contract` block
- `packages/codexkit-cli/package.json` declares a second `cdx` bin and a second Phase 10 contract block
- `packages/codexkit-daemon/src/workflows/packaging-contracts.ts` declares a third copy of the public package/bin/runner contract
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` asserts the daemon constants only

Frozen contract:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`: lines 78-80 and 101-120

Reviewer weight:
- equal hard-fail weight with the tester blocker
- the freeze is not durable if later packaging work can drift the public manifest seam without tripping the shared-contract tests

### 3. Runner command parsing is too weak for quoted args or paths with spaces

Verdict weight: moderate, fail-supporting, remediation-required now.

Why it matters:
- `P10-S0` already froze wrapper commands plus fixed args as supported contract
- current parsing does raw whitespace tokenization, so quoted args and executable paths containing spaces break before worker launch
- this is narrower than the two hard blockers above, but it still weakens the frozen runner contract and should be fixed in the same remediation pass rather than deferred

Current-tree evidence:
- `packages/codexkit-daemon/src/runtime-config.ts` parses env/config runner text with `split(/\\s+/)`
- resolved tokens flow directly into worker launch through `packages/codexkit-daemon/src/runner/worker-runtime.ts`

Frozen contract:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`: lines 86 and 137-140

Weighting note:
- not the primary fail trigger
- still in-scope minimum remediation because leaving it unfixed would freeze an unstable wrapped-runner contract

## Tester And Reviewer Weighting Summary

- Tester blocker: decisive hard blocker. It is runtime-visible, directly mapped to frozen acceptance text, and proves the candidate does not yet expose required runner surfaces.
- Reviewer authoritative-seam blocker: decisive hard blocker. It proves the public contract is not centralized or durably verified.
- Reviewer parsing issue: lower severity than the first two, but still contract-impacting and must be folded into the same `P10-S0` remediation.

## Minimum Remediation Scope Only

Keep remediation strictly inside `P10-S0`.

1. Finish the runner-facing shared surfaces in `cdx doctor` and `cdx init`.
   - `cdx doctor` must resolve the selected runner through the frozen precedence contract, surface runner source and effective command, and emit typed blocked diagnostics when the selected runner is unavailable or incompatible.
   - `cdx init` preview and apply report surfaces must show the runner choice/source alongside the existing install-only gate.

2. Centralize the public package and `cdx` bin contract in one authoritative seam.
   - Manifests and runtime/docs-facing constants must consume or be verified against one frozen source.
   - Shared-contract verification must fail if the public manifest/bin contract drifts from that seam.

3. Replace whitespace-split runner parsing with quoted-command-safe parsing for env/config runner values.
   - Support wrapper commands, fixed args, and executable paths with spaces.
   - Add verification for quoted args and spaced-path cases so this contract cannot regress silently.

Do not widen into:
- `P10-S1` publishable artifact implementation
- `P10-S2` broader runner UX beyond the frozen contract above
- `P10-S3` onboarding/doc expansion beyond already frozen command forms
- `P10-S4` packaged-artifact smoke harness work

## Next Action

Route one Phase 10 remediation session limited to the three items above, then rerun independent Session B tester and Session C reviewer work before another verdict.

## Blockers

- `cdx doctor` does not yet surface active runner source/command or fail early on selected-runner unavailability
- `cdx init` does not yet surface runner choice/source in the preview/apply report surface
- the public package and `cdx` bin contract is not frozen in one authoritative seam
- runner override/config parsing is not robust for quoted args or executable paths with spaces

## Unresolved Questions

- none
