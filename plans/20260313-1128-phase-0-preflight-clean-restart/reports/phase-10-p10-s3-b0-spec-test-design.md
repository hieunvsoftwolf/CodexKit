# Phase 10 `P10-S3` Session B0 Spec-Test-Design

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Slice**: `P10-S3` Onboarding UX, README, And Quickstart Path
**Session**: B0 spec-test-design
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default (prompt-contract fallback; host exposes no named role or modal)
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, working tree beyond pinned base)
**Skill Route**: none required

## Scope Freeze

Freeze verification-owned acceptance for `P10-S3` only.

Frozen now:
- public onboarding must stay inside the accepted `P10-S0` through `P10-S2` contract:
  - package: `@codexkit/cli`
  - bin: `cdx`
  - runner precedence: `CODEXKIT_RUNNER` -> `.codexkit/config.toml` `[runner] command = "..."` -> default `codex exec`
  - `cdx init` and `cdx doctor` must continue surfacing runner source plus effective runner command
- README and one dedicated quickstart doc must show one exact outside-user path:
  - `init`
  - `doctor`
  - `brainstorm`
  - `plan`
  - `cook`
- wrapped-runner guidance must match the accepted runner contract and must not invent a wizard, login flow, or alternate precedence
- public-facing next-step text emitted by `init` and `doctor` reports must align to the public onboarding path rather than repo-internal continuation habits
- the host caveat stays explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

Out of scope for this artifact:
- reopening accepted `P10-S0`, `P10-S1`, or `P10-S2`
- widening into `P10-S4` packaged-artifact smoke or release-gate work
- requiring raw `npx` package execution as the acceptance harness on this host
- changing runner-resolution behavior, worker launch behavior, or doctor/init semantics beyond public wording and report/help-text alignment
- evaluating any `P10-S3` candidate implementation summary or future `P10-S3` code deltas

## Source Of Truth Used

Read first and used:
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/phase-10-public-cli-packaging-and-onboarding.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s2-passed-p10-s3-ready-control-agent-20260329-191012.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/non-functional-requirements.md`
- `docs/workflow-extended-and-release-spec.md`

Accepted Phase 10 contract inputs used:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s0-passed-p10-s1-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-passed-p10-s2-ready-control-agent-20260328-191331.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-second-remediation-session-d-lead-verdict-20260329-s36.md`

Current repo-tree inspection used only to freeze present public/report/help-text seams:
- `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts`
- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/migration-assistant.ts`
- `packages/codexkit-daemon/src/workflows/repo-scan-engine.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

Not used:
- any `P10-S3` implementation summary
- any future `P10-S3` tester, reviewer, or verdict artifact
- any `P10-S4` candidate smoke-harness artifact

## Current Seam Observations To Preserve In Scope

Current frozen drift points that `P10-S3` is allowed to correct:
- root `README.md` currently freezes command forms but does not yet provide a public onboarding walkthrough beyond the shared-contract bullets
- managed README template still points only to `doctor`, first-commit gating, and `update`; it does not teach the accepted `brainstorm -> plan -> cook` path
- `init-report.md` next steps still say `Run cdx resume or cdx cook <absolute-plan-path> as needed.` for non-install-only repos
- `doctor-report.md` currently exposes findings and diagnostics but no explicit public onboarding next-step block
- migration-assistant recommendations still use `cdx resume` for first-run install-only and existing-codexkit sequences
- the current CLI help surface is mainly typed usage diagnostics and next-step strings, not a rich standalone help contract

These are `P10-S3` wording/alignment seams only. They must not trigger redesign of the accepted runner or package contract.

## Real Harness Decision

Primary Session B harness:
- mixed verification is required:
  - static doc/help-text assertions for README, quickstart doc, and CLI-facing text
  - real CLI execution for `init` and `doctor` to materialize durable reports on fixture repos
- use repo-local `./cdx ... --json` against temporary fixture repos for the real-workflow part
- validate emitted `init-report.md`, `doctor-report.md`, and migration-assistant report content after real command execution

Why this is the right harness now:
- `P10-S3` is a public wording and onboarding-contract slice, not a new runtime-behavior slice
- accepted `P10-S2` already proved the runner-selection behavior and real CLI `init`/`doctor` surfaces
- the new risk is contract drift between docs, report text, and CLI-facing next-step/help text
- packaged-artifact proof remains a later accepted lane and must stay in `P10-S4`

Host caveat carried forward explicitly:
- raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
- canonical scripted path remains green
- Session B must therefore verify `npx` onboarding in `P10-S3` as exact doc/help-text contract, not as raw package execution on this host

Allowed supplemental harness:
- one narrow static assertion may inspect docs/spec constants or CLI usage strings directly
- this is supplemental only; it does not replace the real `./cdx init` and `./cdx doctor` fixture runs

## Frozen Acceptance Matrix

If Session A adds a dedicated `P10-S3` verification file, Session B should run that unchanged first. Regardless, these probes are the frozen `P10-S3` contract.

### F1. README `npx`-First Install Path

Targets:
- `README.md`

Required checks:
- README contains the exact command forms:
  - `npx @codexkit/cli init`
  - `npx @codexkit/cli doctor`
  - `npm install -g @codexkit/cli`
  - `cdx init`
  - `cdx doctor`
- README presents `npx` as the primary first-run path and global install as an alternative, not the other way around
- README includes prerequisites or environment framing sufficient for a first-time outside user:
  - Node
  - git
  - Codex CLI or selected runner availability via the accepted runner contract
- README keeps the raw-host caveat explicit:
  - raw `npx` may hit `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green
- README does not instruct users to patch product code or change runner precedence to use a wrapper

Failure examples:
- global install presented as the only or primary path
- `npx` command forms rewritten away from the accepted exact strings
- no `EPERM` caveat
- README implies CodexKit owns account login

### F2. Exact Public Quickstart Path

Targets:
- README quickstart section
- one dedicated quickstart doc under `docs/` that README links directly

Required checks:
- the dedicated quickstart doc shows one exact successful path with concrete commands, in order:
  1. install via `npx` or global install
  2. `cdx init` preview
  3. `cdx init --apply ...`
  4. create first commit if repo is install-only
  5. `cdx doctor`
  6. `cdx brainstorm <task>`
  7. `cdx plan <task>` or explicit brainstorm handoff to plan
  8. `cdx cook <absolute-plan-path>`
- the quickstart path must use public `cdx` shell syntax, not repo-local `./cdx`
- the `cook` step must use an absolute plan path
- the quickstart wording must stay legible to an outside user and must not assume repo-control-agent context, planner jargon, or continuation by `cdx resume`
- README must either contain the same exact path in condensed form or link directly to the dedicated quickstart doc as the canonical walkthrough

Failure examples:
- quickstart omits `doctor`
- quickstart jumps from `init` directly to `cook`
- quickstart substitutes `cdx resume` for the first normal continuation path
- quickstart relies on tribal knowledge instead of exact commands

### F3. Global Install Alternative

Targets:
- README
- dedicated quickstart doc

Required checks:
- global install is present exactly as `npm install -g @codexkit/cli`
- the follow-on commands after global install are the accepted public forms:
  - `cdx init`
  - `cdx doctor`
- global install is framed as a convenience alternative to the `npx` path, not a separate product lane
- docs do not widen into `npm pack`, tarball smoke, registry publish flow, or packaged-artifact troubleshooting

Failure examples:
- quickstart forks into a separate global-install-only onboarding flow
- docs treat global install as release-readiness proof

### F4. Wrapped-Runner Guidance Consistency

Targets:
- README or dedicated quickstart doc
- `.codexkit/config.toml` managed-template guidance if touched
- any onboarding snippet that explains wrappers

Required checks:
- wrapper guidance uses the accepted runner contract only:
  - temporary override via `CODEXKIT_RUNNER`
  - durable repo-local config via `.codexkit/config.toml` `[runner] command = "..."`
  - fallback default `codex exec`
- one concrete wrapper example is shown, using a `codex-safe`-style command with fixed args
- guidance stays consistent with accepted `P10-S2` report surfaces:
  - `cdx init` preview/apply surfaces runner source and command
  - `cdx doctor` surfaces active runner source and command and blocks with typed diagnostics if unavailable
- guidance states or clearly implies that CodexKit binds to the selected runner session and does not own login/account state
- docs do not introduce a runner setup wizard, account-binding step, or precedence that conflicts with accepted `P10-S2`

Failure examples:
- wrapper setup tells users to edit product code
- docs imply config beats env override
- docs imply CodexKit signs users into Codex

### F5. Public-Facing Init Report Next Steps

Targets:
- real emitted `init-report.md`
- any template or managed-content change that influences first-run onboarding text

Fixture:
- git-backed repo with initial commit
- one install-only repo without initial commit

Commands:
- `./cdx daemon start --once --json`
- preview: `./cdx init --approve-protected --approve-managed-overwrite --json`
- apply: `./cdx init --apply --approve-protected --approve-managed-overwrite --json`

Required checks for git-backed repo:
- report still contains accepted runner lines:
  - `- Runner source: ...`
  - `- Runner command: ...`
- `## Next Steps` must align to public onboarding:
  - includes `Run cdx doctor.`
  - does not recommend `cdx resume` as the first normal continuation path
  - points users toward `cdx brainstorm <task>`, `cdx plan <task>`, and `cdx cook <absolute-plan-path>` directly or via the dedicated quickstart doc

Required checks for install-only repo:
- `## Next Steps` includes the first-commit gate before worker-backed workflows
- `## Next Steps` includes `Run cdx doctor.`
- report must not imply worker-backed workflows are ready before first commit exists

Failure examples:
- non-install-only init report still says `Run cdx resume or cdx cook <absolute-plan-path> as needed.`
- install-only init report skips the first-commit gate

### F6. Public-Facing Doctor Report And Migration Assistant Alignment

Targets:
- real emitted `doctor-report.md`
- real emitted migration-assistant report from `cdx doctor`
- CLI-facing next-step/help strings touched by onboarding copy

Fixture:
- healthy git-backed repo with initial commit after successful `init --apply`
- install-only repo without initial commit after successful `init --apply`

Commands:
- `./cdx daemon start --once --json`
- `./cdx doctor --json`

Required checks for healthy git-backed repo:
- `doctor-report.md` still contains accepted runner lines:
  - `- Active runner source: ...`
  - `- Active runner command: ...`
- report or linked next-step text must point the user into the public onboarding path:
  - `cdx brainstorm <task>`
  - `cdx plan <task>` or brainstorm handoff
  - `cdx cook <absolute-plan-path>`
- doctor output must not default to `cdx resume` for a normal first-run healthy repo with no resumable-run need

Required checks for install-only repo:
- doctor findings keep the accepted first-commit gate
- migration assistant and related next-step text sequence the user through:
  - create first commit
  - rerun `cdx doctor`
  - continue into the public quickstart path
- install-only guidance must not suggest `cdx resume` as the primary post-commit next step unless a real resumable run exists

Help-text consistency checks:
- invalid `cdx init` usage still resolves to canonical public syntax:
  - `Use cdx init [--apply] [--init-git] [--approve-git-init] [--approve-protected] [--approve-managed-overwrite].`
- invalid `cdx doctor` usage still resolves to canonical public syntax:
  - `Run cdx doctor.`
- no onboarding-facing usage text should require repo-local `./cdx`

Failure examples:
- doctor report remains public-command silent after a healthy first-run path
- migration assistant still ends first-run sequences with `cdx resume`
- usage/help strings drift away from public `cdx` forms

## Verification-Owned Test And Harness Delta

These follow-ons are narrow enough to define now without touching production code.

Preferred verification change:
- add one dedicated test file:
  - `tests/runtime/runtime-workflow-phase10-onboarding-contract.integration.test.ts`

Recommended coverage in that file:
- static doc contract:
  - README contains exact `npx`-first and global-install command forms
  - README links to one dedicated quickstart doc under `docs/`
  - quickstart doc contains the exact `init -> doctor -> brainstorm -> plan -> cook` public path
  - wrapper guidance includes one `codex-safe`-style example and preserves accepted runner precedence
  - raw `npx` `EPERM` caveat text is present
- real CLI report contract:
  - create git-backed fixture with initial commit
  - run `./cdx init --json`, `./cdx init --apply --json`, `./cdx doctor --json`
  - assert emitted `init-report.md` and `doctor-report.md` contain accepted runner lines and public next-step alignment
- install-only contract:
  - create fixture with git repo and no initial commit
  - run `./cdx init --apply --json` then `./cdx doctor --json`
  - assert first-commit gating remains explicit and `resume` is not the default public next step
- CLI usage/help contract:
  - assert invalid `cdx init` and `cdx doctor` usage still emit canonical public `cdx` syntax in next-step text

Harness notes:
- reuse existing runtime fixture helpers and report-reading patterns from `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts` and `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- do not require `npm pack`, registry access, or raw `npx` execution in this file
- keep this new file narrowly scoped to wording and report/help-text alignment; do not duplicate the accepted `P10-S2` runner-resolution matrix

## Session B Execution Rule

Session B should pass `P10-S3` only when all of the following are true:
- the frozen doc/help-text checks in `F1` through `F4` pass
- the real emitted report checks in `F5` and `F6` pass on fixture repos
- the raw `npx` `EPERM` host caveat remains explicit in the shipped onboarding contract
- no check widens into packaged-artifact smoke, tarball proof, registry publish, or `P10-S4` concerns
- no contradiction appears against accepted `P10-S0` through `P10-S2`

Session B should fail `P10-S3` if any of the following appear:
- onboarding docs omit or reorder the accepted quickstart path materially
- wrapped-runner guidance contradicts the accepted runner contract
- init/doctor public reports keep repo-internal continuation defaults for first-run outside users
- the host `EPERM` caveat is removed or hidden

## Unresolved Questions

- none
