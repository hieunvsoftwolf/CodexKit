# Phase 10 Remediation Session D Verdict

**Date**: 2026-03-27
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Session**: D lead verdict
**Status**: completed
**Role/Modal Used**: lead-verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, worktree beyond pinned base)
**Skill Route**: none required

## Decision

Fail the remediated `P10-S0` shared contract freeze candidate.

The narrowed remediation did close the package/bin seam issue and the tester rerun passed its reduced subset. That is not enough to accept `P10-S0`. Two runner-path contract blockers still stand in the current tree, both map directly to the frozen B0 acceptance, and both were reproducible from the current candidate.

## Weighting

1. frozen `P10-S0` contract sources
   - `README.md`
   - `docs/system-architecture.md`
   - `docs/workflow-extended-and-release-spec.md`
   - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md`
2. remediation Session A implementation summary
3. remediation Session B tester rerun report
4. remediation Session C reviewer rerun report
5. current-tree code inspection and targeted repros

Tester pass gets real weight, but only for the executed narrowed subset. It does not override a still-reproducible frozen-contract miss outside that subset.

## Verdict Basis

### 1. Malformed env/config runner values still silently downgrade to lower precedence or default

Verdict weight: hard blocker.

Why it blocks:
- B0 froze exact runner precedence and explicitly froze that no invalid override/config path may silently fall back to bare `codex exec`.
- Current code still converts parse failure into “source absent”.

Current-tree evidence:
- `packages/codexkit-daemon/src/runtime-config.ts:27` returns `null` for unmatched quotes or dangling escapes.
- `packages/codexkit-daemon/src/runtime-config.ts:153` treats that `null` as fallthrough and resolves the next source or default.

Direct repro on current candidate:
- `CODEXKIT_RUNNER='"/broken path exec' cdx doctor --json`
- observed result on current tree:
  - `runnerSource: "default"`
  - `runnerCommand: "codex exec"`
- expected by frozen contract:
  - preserve selected source as invalid and block with typed invalid-runner diagnostics

Why tester pass does not clear it:
- Session B validated valid quoted parsing and missing-runner handling.
- Session B did not pin this malformed-input path.
- A passing happy subset cannot accept a still-reproducible silent downgrade on a frozen contract.

### 2. `cdx doctor` still probes wrapper runners too narrowly

Verdict weight: hard blocker.

Why it blocks:
- B0 froze wrapper commands plus fixed args as supported contract.
- `cdx doctor` must verify the selected runner availability honestly, not reject valid command shapes because only the executable token supports no bare `--version`.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:102` extracts only `runner.command[0]`.
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts:113` probes `<runner-executable> --version`.
- That ignores the selected command shape the product actually promises to honor.

Direct repro on current candidate:
- wrapper script accepted `exec` and rejected bare `--version`
- `CODEXKIT_RUNNER='"<wrapper-path>" exec' cdx doctor --json`
- observed result on current tree:
  - `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
  - stderr carried `wrapper has no version mode`
- expected by frozen contract:
  - valid wrapper runner should not be falsely blocked just because the executable alone lacks standalone `--version`

Why tester pass does not clear it:
- Session B covered unavailable selected runner.
- Session B did not cover valid wrapper command without bare `--version`.
- Reviewer blocker stayed live and reproduced.

## What Holds

- The package/bin seam centralization concern from the first verdict is closed.
- `README.md`, `docs/system-architecture.md`, `docs/workflow-extended-and-release-spec.md`, `package.json`, `packages/codexkit-cli/package.json`, `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`, and `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` now align on the narrowed public package/bin contract.
- `cdx init` and `cdx doctor` runner-source / runner-command surfaces landed for the exercised paths.

That progress reduces scope. It does not change the `P10-S0` pass/fail answer while the remaining runner-path blockers persist.

## Minimum Next-Remediation Scope Only

Keep remediation strictly inside `P10-S0`.

1. Preserve invalid selected runner source as invalid instead of falling through.
   - malformed env override must block as env-selected invalid
   - malformed config runner must block as config-selected invalid when no higher-precedence env override exists
   - add freeze coverage for unmatched quotes and dangling escapes

2. Make `cdx doctor` validate the selected runner command shape without assuming bare `<executable> --version`.
   - accept valid wrapper commands with fixed args
   - keep typed unavailable/incompatible diagnostics
   - add freeze coverage for a wrapper runner that supports launch shape but no standalone `--version`

Do not widen into:
- `P10-S1` packaged artifact implementation
- `P10-S2` broader runner UX or config redesign
- `P10-S3` docs expansion beyond frozen contract wording
- `P10-S4` packaged-artifact smoke harness work

## Next Action

Route one more narrow remediation pass limited to the two runner-path blockers above, then rerun independent Session B tester and Session C reviewer verification before another verdict.

## Blockers

- malformed selected runner values still silently fall through to lower-precedence/default resolution instead of blocking with typed invalid-runner diagnostics
- `cdx doctor` still falsely blocks valid wrapper runner command shapes by probing only `<runner-executable> --version`

## Unresolved Questions

- none
