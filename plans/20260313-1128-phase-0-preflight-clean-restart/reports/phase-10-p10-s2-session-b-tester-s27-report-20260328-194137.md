# Phase 10 `P10-S2` Session B Tester Report (S27)

**Date**: 2026-03-28  
**Phase**: Phase 10 Public CLI Packaging and Onboarding  
**Scope**: `P10-S2` only (runner resolution, wrapper support, doctor/init hardening)  
**Status**: completed  
**Role/Modal Used**: tester / Default (host has no explicit modal selector)  
**Model Used**: GPT-5 Codex / Codex CLI

## Scope Guard

- Stayed in `P10-S2`.
- Did not reopen `P10-S1`.
- Did not widen into `P10-S3`, `P10-S4`, or release-readiness closure.

## Harness And Execution Notes

- Ran frozen `P10-S2` B0 CLI contract first via `./cdx ... --json` shape (workspace `cdx` binary invoked against isolated fixture repos).
- Primary harness was CLI workflow execution, not packaged `npx` smoke.
- Frozen fixture execution artifacts are captured under:
  - `/Users/hieunv/Claude Agent/CodexKit/.tmp/p10-s2-s27-20260328-193357/results`
- Host caveat kept explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Frozen Fixture Matrix Results

### F1 default runner fallback

Result: **pass**

Evidence:
- `F1-init-preview.json`: `workflow=init`, `checkpointIds=["package-scan","package-preview"]`, `applyExecuted=false`, `runnerSource=default`, `runnerCommand=codex exec`
- `F1-init-apply.json`: `checkpointIds=["package-scan","package-preview","package-apply"]`, `applyExecuted=true`, `runnerSource=default`, `runnerCommand=codex exec`
- `F1-doctor.json`: `workflow=doctor`, `checkpointIds=["doctor-scan"]`, `runnerSource=default`, `runnerCommand=codex exec`, no selected-runner error codes
- durable reports include expected lines:
  - `init-report.md`: `Runner source: default`, `Runner command: codex exec`
  - `doctor-report.md`: `Active runner source: default`, `Active runner command: codex exec`

### F2 config-selected wrapped runner

Result: **pass**

Fixture used real executable wrapper `./bin/codex-safe` with fixed args (`exec /bin/cat /dev/null "$@"`).

Evidence:
- `F2-init-preview.json`: `runnerSource=config-file`, `runnerCommand=./bin/codex-safe exec --profile beta`
- `F2-doctor.json`: `runnerSource=config-file`, `runnerCommand=./bin/codex-safe exec --profile beta`, `runnerAvailable=true`
- no selected-runner failure codes (`INVALID`/`UNAVAILABLE`/`INCOMPATIBLE` absent)
- durable reports repeat selected source+command

Note:
- doctor status is `blocked` due repo/install-state diagnostics (`DOCTOR_INSTALL_STATE_MISSING`, `DOCTOR_RELEASE_MANIFEST_MISSING`, `DOCTOR_REPO_STATE_UNSUPPORTED`), not due selected-runner contract failure.

### F3 env override beats config

Result: **pass**

Evidence:
- `F3-init-preview.json`: `runnerSource=env-override`, `runnerCommand=./bin/codex-safe exec --profile 'beta lane'`
- `F3-doctor.json`: `runnerSource=env-override`, `runnerCommand=./bin/codex-safe exec --profile 'beta lane'`, `runnerAvailable=true`
- config command was different in `.codexkit/config.toml`; env override took precedence
- no selected-runner failure codes present
- durable reports preserve env-selected command, not config-selected command

Note:
- same non-selected-runner blocked repo/install-state findings as F2.

### F4 selected runner unavailable

Result: **pass**

Evidence:
- `F4-doctor.json`: `runnerSource=env-override`, `runnerCommand=definitely-not-a-real-runner --version`, `runnerAvailable=false`, `status=blocked`
- findings include `DOCTOR_SELECTED_RUNNER_UNAVAILABLE`
- `doctor-report.md` repeats active runner source+command and typed unavailable diagnostic

### F5 selected runner malformed

Result: **pass**

Evidence:
- `F5-doctor.json`: `runnerSource=env-override`, `runnerCommand="/broken path exec`, `runnerAvailable=false`, `status=blocked`
- findings include `DOCTOR_SELECTED_RUNNER_INVALID`
- no fallback to `runnerSource=default` or `runnerCommand=codex exec`
- `doctor-report.md` repeats active runner source+command and typed invalid diagnostic

### F6 selected runner incompatible

Result: **pass**

Evidence:
- fixture file `./bin/codex-safe` existed but non-executable (`chmod 644`)
- `F6-doctor.json`: `runnerSource=env-override`, `runnerCommand=./bin/codex-safe exec --profile beta`, `runnerAvailable=false`, `status=blocked`
- findings include `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
- cause points to executable compatibility failure with path and `EACCES`

### F7 init preview/apply must surface runner before mutation

Result: **pass**

Evidence:
- `F7-init-preview.json`: `runnerSource=env-override`, `runnerCommand=./bin/codex-safe exec --profile 'beta lane'`, `applyExecuted=false`
- `F7-init-apply.json`: `runnerSource=env-override`, `runnerCommand=./bin/codex-safe exec --profile 'beta lane'`, `applyExecuted=true`
- preview/apply both surface runner before mutation and preserve selected precedence path
- apply keeps checkpoint chain with preview then apply (`package-preview` then `package-apply`)

## Supplemental Invalid-Selection Guard (still applicable)

Result: **pass**

Probe output (`SUP-invalid-selection.json`):
- top-level `code=WORKFLOW_BLOCKED`
- `details.code=WF_SELECTED_RUNNER_INVALID`
- `details.source=env-override`
- `details.commandText="/broken path exec`
- `workerCount=0`, `claimCount=0`

## Doctor First-Run Persistence Observation

Observation fixture required by B0 was rerun in a truly external fresh non-git directory:
- `/Users/hieunv/.codex_profiles/acc_3/memories/p10-s2-s27-doctor-first-run`

Classification: **observed-persisting**

Observed after first-run `cdx doctor --json`:
- `.codexkit/state/runtime.sqlite` created: **yes**
- `doctor-report.md` created: **yes**
- `migration-assistant-report.md` created: **yes**

Assessment vs frozen contract:
- carry-forward observed behavior
- does not by itself fail `P10-S2` per frozen non-widening rule

## Contract Verdict For `P10-S2` B0 Matrix

- `F1` through `F7`: pass
- no silent fallback from env/config-selected runner to default in malformed/unavailable/incompatible cases
- selected-runner failure taxonomy is typed and correct (`INVALID`, `UNAVAILABLE`, `INCOMPATIBLE`)
- doctor/init both surface runner source + effective command
- wrapped-runner acceptance exercised with real executable `codex-safe`-style wrapper and fixed args
- supplemental invalid-selection pre-spawn guard remains active
- first-run doctor persistence classified as `observed-persisting`

Overall `P10-S2` tester result: **green for frozen B0 contract**.

## Unresolved Questions

- none
