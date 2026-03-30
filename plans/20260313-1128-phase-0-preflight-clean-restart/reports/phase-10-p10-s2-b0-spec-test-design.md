# Phase 10 `P10-S2` Session B0 Spec-Test-Design

**Date**: 2026-03-28
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Slice**: `P10-S2` Runner Resolution, Wrapper Support, And Doctor Hardening
**Session**: B0 spec-test-design
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default (prompt-contract fallback; host exposes no named role or modal)
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, working tree beyond pinned base)
**Skill Route**: `openai-docs` requested; no external OpenAI-doc lookup was needed because this slice is repo-local

## Scope Freeze

Freeze verification-owned acceptance for `P10-S2` only.

Frozen now:
- runner resolution order is exact and public:
  1. `CODEXKIT_RUNNER`
  2. `.codexkit/config.toml` with `[runner] command = "..."`
  3. default `codex exec`
- `cdx doctor` must surface active runner source plus effective runner command
- `cdx doctor` must block with typed diagnostics when the selected runner is missing, malformed, or incompatible
- `cdx init` preview and apply must surface active runner source plus effective runner command before mutation
- explicit wrapped-runner coverage is required for `codex-safe`-style command shapes with fixed args
- doctor first-run persistence behavior must be observed and classified in Session B, but not widened into a redesign

Out of scope for this artifact:
- reopening `P10-S1`
- widening into `P10-S3` README, quickstart, or broader onboarding copy
- widening into `P10-S4` packaged-artifact smoke harness or release gate
- public tarball or registry proof as the primary acceptance harness for this slice
- redesigning `cdx doctor` into an ephemeral or no-write mode during `P10-S2`

## Source Of Truth Used

Read first and used:
- `README.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/non-functional-requirements.md`
- `docs/verification-policy.md`
- `docs/workflow-extended-and-release-spec.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-d-verdict.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-passed-p10-s2-ready-control-agent-20260328-191331.md`

Current repo-tree inspection used to freeze real pre-`P10-S2` harness surfaces:
- `packages/codexkit-daemon/src/runtime-config.ts`
- `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- `packages/codexkit-daemon/src/workflows/doctor-workflow.ts`
- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- `tests/runtime/helpers/runtime-fixture.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

Handoff context only:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-c-review-report.md`

Not used:
- any `P10-S2` implementation summary
- any future `P10-S2` verdict or reviewer artifact
- `P10-S3` or `P10-S4` planning or implementation artifacts

## Real Harness Decision

Primary Session B harness:
- CLI execution is the default and required harness for this slice
- use repo-local `./cdx ... --json` against temporary fixture repos
- exercise the real `init` and `doctor` workflows, not helper functions only

Why this is the right harness now:
- this slice is about public workflow behavior and typed diagnostics
- `cdx init` and `cdx doctor` already expose stable JSON result fields and durable report files
- package-consumption smoke is a separate accepted follow-on lane and stays deferred to `P10-S4`

Allowed supplemental harness:
- one narrow runtime-level pre-spawn probe is allowed for `WF_SELECTED_RUNNER_INVALID` if Session A adds or preserves that guard
- this is supplemental only; it does not replace CLI acceptance

Host caveat carried forward explicitly:
- raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
- canonical scripted path remains green
- because `P10-S2` is not the packaged-artifact smoke lane, Session B must not fail this slice merely because raw package-consumption commands are hostile on this host

## Session B Fixture Matrix

If Session A adds a dedicated `P10-S2` verification file, Session B should run that unchanged first. Regardless, these fixture probes are the frozen acceptance contract.

### F1. Default Runner Fallback

Fixture:
- git-backed repo with initial commit
- no `CODEXKIT_RUNNER`
- no `[runner] command` in `.codexkit/config.toml`

Commands:
- `./cdx daemon start --once --json`
- `./cdx init --approve-protected --approve-managed-overwrite --json`
- `./cdx init --apply --approve-protected --approve-managed-overwrite --json`
- `./cdx doctor --json`

Expected outputs:
- init preview JSON:
  - `workflow === "init"`
  - `checkpointIds === ["package-scan", "package-preview"]`
  - `applyExecuted === false`
  - `runnerSource === "default"`
  - `runnerCommand === "codex exec"`
- init apply JSON:
  - `workflow === "init"`
  - `checkpointIds === ["package-scan", "package-preview", "package-apply"]`
  - `applyExecuted === true`
  - `runnerSource === "default"`
  - `runnerCommand === "codex exec"`
- doctor JSON:
  - `workflow === "doctor"`
  - `checkpointIds === ["doctor-scan"]`
  - `runnerSource === "default"`
  - `runnerCommand === "codex exec"`
  - no `DOCTOR_SELECTED_RUNNER_INVALID`
  - no `DOCTOR_SELECTED_RUNNER_UNAVAILABLE`
  - no `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
- durable reports:
  - `init-report.md` contains `- Runner source: default`
  - `init-report.md` contains `- Runner command: codex exec`
  - `doctor-report.md` contains `- Active runner source: default`
  - `doctor-report.md` contains `- Active runner command: codex exec`

### F2. Config-Selected Wrapped Runner

Fixture:
- git-backed repo with initial commit
- executable local wrapper script at `./bin/codex-safe`
- `.codexkit/config.toml` contains `[runner] command = "./bin/codex-safe exec --profile beta"`
- no `CODEXKIT_RUNNER`

Commands:
- `./cdx daemon start --once --json`
- `./cdx init --approve-protected --approve-managed-overwrite --json`
- `./cdx doctor --json`

Expected outputs:
- init preview JSON:
  - `runnerSource === "config-file"`
  - `runnerCommand === "./bin/codex-safe exec --profile beta"`
- doctor JSON:
  - `runnerSource === "config-file"`
  - `runnerCommand === "./bin/codex-safe exec --profile beta"`
  - `runnerAvailable === true`
  - `status !== "blocked"` for a selected-runner reason
  - no `DOCTOR_SELECTED_RUNNER_INVALID`
  - no `DOCTOR_SELECTED_RUNNER_UNAVAILABLE`
  - no `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
- both reports repeat the same selected source and command

### F3. Env Override Beats Config

Fixture:
- same wrapper style as `F2`
- `.codexkit/config.toml` contains a different runner command
- env override set to `CODEXKIT_RUNNER='./bin/codex-safe exec --profile "beta lane"'`

Commands:
- `./cdx daemon start --once --json`
- `CODEXKIT_RUNNER='./bin/codex-safe exec --profile "beta lane"' ./cdx init --approve-protected --approve-managed-overwrite --json`
- `CODEXKIT_RUNNER='./bin/codex-safe exec --profile "beta lane"' ./cdx doctor --json`

Expected outputs:
- init preview JSON:
  - `runnerSource === "env-override"`
  - `runnerCommand === "./bin/codex-safe exec --profile 'beta lane'"`
- doctor JSON:
  - `runnerSource === "env-override"`
  - `runnerCommand === "./bin/codex-safe exec --profile 'beta lane'"`
  - `runnerAvailable === true`
  - must not report `runnerSource === "config-file"`
- report files must preserve the env-selected command, not the config-file command

### F4. Selected Runner Unavailable

Fixture:
- git-backed repo with initial commit
- `CODEXKIT_RUNNER='definitely-not-a-real-runner --version'`

Commands:
- `./cdx daemon start --once --json`
- `CODEXKIT_RUNNER='definitely-not-a-real-runner --version' ./cdx doctor --json`

Expected outputs:
- `runnerSource === "env-override"`
- `runnerCommand === "definitely-not-a-real-runner --version"`
- `runnerAvailable === false`
- `status === "blocked"`
- findings contain `DOCTOR_SELECTED_RUNNER_UNAVAILABLE`
- `doctor-report.md` repeats the active runner source and active runner command

### F5. Selected Runner Malformed

Fixture:
- git-backed repo with initial commit
- `CODEXKIT_RUNNER='"/broken path exec'`

Commands:
- `./cdx daemon start --once --json`
- `CODEXKIT_RUNNER='"/broken path exec' ./cdx doctor --json`

Expected outputs:
- `runnerSource === "env-override"`
- `runnerCommand === "\"/broken path exec"`
- `runnerAvailable === false`
- `status === "blocked"`
- findings contain `DOCTOR_SELECTED_RUNNER_INVALID`
- no silent fallback to `runnerSource === "default"`
- no silent fallback to `runnerCommand === "codex exec"`

### F6. Selected Runner Incompatible

Fixture:
- git-backed repo with initial commit
- file exists at `./bin/codex-safe` but is not executable
- `CODEXKIT_RUNNER='./bin/codex-safe exec --profile beta'`

Commands:
- `./cdx daemon start --once --json`
- `CODEXKIT_RUNNER='./bin/codex-safe exec --profile beta' ./cdx doctor --json`

Expected outputs:
- `runnerSource === "env-override"`
- `runnerCommand === "./bin/codex-safe exec --profile beta"`
- `runnerAvailable === false`
- `status === "blocked"`
- findings contain `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
- cause text points at the blocking path or executable-compatibility failure

### F7. Init Preview/Apply Must Surface Runner Before Mutation

Fixture:
- git-backed repo with initial commit
- use either `F2` or `F3`

Commands:
- preview: `./cdx init --approve-protected --approve-managed-overwrite --json`
- apply: `./cdx init --apply --approve-protected --approve-managed-overwrite --json`

Expected outputs:
- preview must surface runner source and effective runner command before mutation
- apply must surface the same runner source and effective runner command
- preview and apply runner values must match the selected precedence path
- apply still requires the matching preview fingerprint; `P10-S2` must not weaken preview-first behavior

## Supplemental Guard: Worker-Launch Invalid Selection

This is not the primary harness, but it is a useful hardening check if the current candidate still exposes it.

Allowed probe:
- malformed env-selected runner
- minimal worker-launch path that reaches pre-spawn validation

Expected output:
- top-level error code `WORKFLOW_BLOCKED`
- `details.code === "WF_SELECTED_RUNNER_INVALID"`
- `details.source === "env-override"` or `details.source === "config-file"` depending on fixture
- raw `details.commandText` preserved
- no worker record created
- no claim record created

This probe is supportive evidence for “no silent fallback” and must not replace the CLI checks above.

## Doctor First-Run Persistence Observation Rule

Accepted carry-forward concern from `P10-S1`:
- Session B must explicitly observe whether first-run `cdx doctor` in a fresh external directory persists `.codexkit` state and report artifacts
- Session B must classify the result as either:
  - `observed-persisting`
  - `observed-no-persist`

Required observation fixture:
- fresh external non-git directory with no prior `.codexkit`

Required command:
- `./cdx doctor --json`

Required report note:
- whether `.codexkit/state/runtime.sqlite` was created
- whether `doctor-report.md` and migration-assistant artifacts were created
- whether the behavior is merely observed carry-forward policy or a new regression against the frozen `P10-S2` contract

Explicit non-widening rule:
- do not fail `P10-S2` solely because doctor persists state on first run if the runner-resolution, init-surfacing, and typed-diagnostic contracts are otherwise satisfied
- do not silently widen Session B into an `--ephemeral` redesign request
- if the behavior changes from the accepted `P10-S1` observation, classify it and hand it forward; do not rewrite the slice boundary

## Frozen Now Vs Deferred

Frozen now in `P10-S2`:
- exact source names and order: `env-override`, `config-file`, `default`
- exact public selection surfaces: `CODEXKIT_RUNNER` and `.codexkit/config.toml` `[runner] command`
- `runnerSource`, `runnerCommand`, and `runnerAvailable` surfacing in CLI JSON and durable reports
- blocked doctor taxonomy for invalid, unavailable, and incompatible selected runners
- wrapped-runner positive coverage for a `codex-safe`-style command with fixed args
- no silent fallback from malformed or broken selected runner to bare `codex exec`
- observation and classification of first-run doctor persistence

Deferred to `P10-S3`:
- README and quickstart wording
- public docs examples for wrapper setup
- any user-facing product copy that explains doctor persistence policy

Deferred to `P10-S4`:
- tarball or registry-installed package smoke as the primary harness
- repo-external packaged-artifact proof for wrapper flows
- public-beta release gate over the full packaged smoke matrix

## Exit-Criteria Mapping

- `NFR-3.3`: typed blocking CLI diagnostics with cause and one concrete next step
- `NFR-4.3`: init preview/apply enumerates writes and shows the active runner before mutation
- `NFR-4.4`: unsupported selected-runner states fail blocked before misleading progress
- `NFR-8.3`: no silent downgrade or fallback from a requested runner to a narrower default path

## Session B Pass Rule

Session B should mark `P10-S2` green only if all of the following hold:
- every frozen fixture `F1` through `F7` passes
- wrapped-runner coverage uses a real executable `codex-safe`-style wrapper shape, not only `/bin/cat` or another accidental executable
- malformed, unavailable, and incompatible selected-runner cases all block with the correct typed diagnostic category
- init and doctor agree on the selected runner source and effective runner command for the same fixture
- first-run doctor persistence is explicitly observed and classified in the report

## Unresolved Questions

- none
