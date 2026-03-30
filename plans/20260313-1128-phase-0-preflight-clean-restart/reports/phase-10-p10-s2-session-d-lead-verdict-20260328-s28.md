# Phase 10 `P10-S2` Session D Lead Verdict (S28)

**Date**: 2026-03-28
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` only
**Session**: D lead verdict
**Status**: blocked
**Role/Modal Used**: lead verdict / Default (host exposes no explicit modal selector)
**Model Used**: Codex / GPT-5

## Verdict

`P10-S2`: **fail**

Exact remediation blocker set, without widening scope:
- `R1` runner drift across `cdx init` preview -> apply
- `R2` empty config runner silently falling back to default

`R3` is **accepted follow-on**, not a separate current-slice blocker. Regression coverage for `R1` and `R2` should be added as part of fixing those blockers, but the frozen B0 artifact stays unchanged.

Host caveat remains explicit:
- raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
- canonical scripted path remains green

## Source Of Truth Used

- current repo tree
- latest durable control-state:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s2-verdict-ready-control-agent-20260328-194759.md`
- current phase docs:
  - `README.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
  - `docs/project-roadmap.md`
  - `docs/non-functional-requirements.md`
  - `docs/verification-policy.md`
  - `docs/workflow-extended-and-release-spec.md`
- handoff context:
  - Session A implementation summary
  - frozen B0 artifact
  - Session B tester report
  - Session C review report

## Current-Tree Reconciliation

### Tester Green Matrix vs Reviewer `R1`

Tester `F7` is green for the path actually exercised: preview and apply both surfaced the same env-selected runner and apply executed. I accept that evidence as accurate for that path.

Reviewer `R1` is still a current-slice blocker because the frozen B0 contract for `F7` is stronger than "preview and apply each print runner metadata." It also requires apply to remain bound to the reviewed preview. Current code does not bind preview approval to runner selection:
- fingerprint builder omits runner source and runner command: `packages/codexkit-daemon/src/workflows/init-workflow.ts:118`
- apply gate compares only that fingerprint: `packages/codexkit-daemon/src/workflows/init-workflow.ts:326`, `packages/codexkit-daemon/src/workflows/init-workflow.ts:339`

Direct current-tree repro under repo-local `.tmp` confirms the reviewer:
- preview under default runner returned `runnerSource=default`, `runnerCommand=codex exec`
- apply under `CODEXKIT_RUNNER="\"/bin/cat\" /dev/null"` returned `runnerSource=env-override`, `runnerCommand=/bin/cat /dev/null`, `applyExecuted=true`
- no `INIT_APPLY_REQUIRES_PREVIEW` block fired

Conclusion:
- tester pass is not wrong
- reviewer blocker is also correct
- contradiction resolves as incomplete test coverage within the exercised green matrix, not as a false reviewer finding

### Tester Green Matrix vs Reviewer `R2`

Tester `F1-F7` does not include the explicit-empty config case. The frozen B0 slice still requires exact runner precedence and typed blocking for malformed selected runners.

Current code treats an explicit empty config command as absent:
- config read returns `null` for empty string: `packages/codexkit-daemon/src/runtime-config.ts:141`
- resolution then falls through to default runner: `packages/codexkit-daemon/src/runtime-config.ts:204`

Direct current-tree repro under repo-local `.tmp` confirms the reviewer:
- `.codexkit/config.toml` with `[runner] command = ""`
- `cdx doctor --json` returned `runnerSource=default`, `runnerCommand=codex exec`
- no `DOCTOR_SELECTED_RUNNER_INVALID`

Conclusion:
- tester green matrix does not discharge this case
- reviewer `R2` is a current-slice blocker because the repo silently downgrades an explicit config selection into default behavior

## Frozen B0 Contract Mapping

### Passes still accepted

- `F1` default fallback: accepted from tester evidence
- `F2` config-selected wrapped runner: accepted from tester evidence
- `F3` env override beats config: accepted from tester evidence
- `F4` unavailable selected runner blocks with typed diagnostic: accepted from tester evidence
- `F5` malformed env-selected runner blocks with typed diagnostic: accepted from tester evidence
- `F6` incompatible selected runner blocks with typed diagnostic: accepted from tester evidence

### Fails that block verdict

- `F7` init preview/apply must surface runner before mutation and preserve preview-first behavior: **fail**
  - current tree allows mutation under a different runner than the reviewed preview because runner selection is omitted from the preview fingerprint
  - this is the `R1` blocker

### Shared B0 contract failures outside the enumerated tester matrix

- exact runner resolution order `env -> config -> default`: **fail on explicit empty config selection**
  - an explicitly present config runner command of `""` is treated as if no config selection exists
  - this violates the frozen precedence contract and the malformed-runner blocking contract
  - this is the `R2` blocker

## Blocker Classification

### `R1`

Classification: **blocker**

Why:
- breaks the frozen `F7` preview/apply contract
- weakens the preview-first integrity guarantee on a repo-mutating path
- current-tree direct repro confirms it

Required remediation:
- include runner source and effective runner command in the init preview fingerprint
- block apply when runner selection differs from the reviewed preview
- add a regression check for preview under one runner then apply under another runner

### `R2`

Classification: **blocker**

Why:
- breaks exact runner precedence for explicit config selection
- converts malformed config into silent default fallback
- contradicts the typed invalid-runner behavior required by the frozen `P10-S2` contract
- current-tree direct repro confirms it

Required remediation:
- preserve explicit empty config selection as invalid, not absent
- surface `DOCTOR_SELECTED_RUNNER_INVALID` for that case
- add a regression check for `[runner] command = ""`

### `R3`

Classification: **accepted follow-on**

Why:
- the missing automated coverage is real, and it explains why `R1` and `R2` escaped
- but the current verdict is already blocked by the underlying product defects, not by the existence of the coverage gap alone
- frozen B0 did not require full in-repo automation for every matrix cell as a separate pass gate

Constraint:
- do not widen the blocker set beyond `R1` and `R2`
- keep the frozen B0 artifact unchanged
- when remediation lands, add only the narrow regression coverage needed to pin the blocker fixes

## Final Decision

`P10-S2` does not pass.

The exact blocker set is:
1. `R1` preview/apply runner drift is not blocked
2. `R2` explicit empty config runner silently falls back to default

Next session target:
- `P10-S2` remediation only

Unresolved questions:
- none
