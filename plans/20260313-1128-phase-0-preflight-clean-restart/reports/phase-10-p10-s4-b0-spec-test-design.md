# Phase 10 `P10-S4` Session B0 Spec-Test-Design

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Slice**: `P10-S4` Public-Beta Smoke Harness And Release Gate
**Session**: B0 spec-test-design
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default (prompt-contract fallback; host exposes no named role or modal)
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: `/Users/hieunv/Claude Agent/CodexKit` (branch `main`, current tree intentionally not used as source of truth beyond pinned-base context)
**Skill Route**: none required

## Scope Freeze

Freeze verification-owned acceptance for `P10-S4` only.

Frozen now:
- `P10-S4` owns packaged-artifact smoke verification and release-gate evidence collation only
- acceptance must execute the packaged artifact path directly
- repo-local `./cdx` execution is insufficient for `P10-S4` acceptance, even if earlier phase tests continue using it for their own scope
- frozen public contract carried from accepted `P10-S0` through `P10-S3`:
  - npm package: `@codexkit/cli`
  - public bin: `cdx`
  - runner precedence: `CODEXKIT_RUNNER` -> `.codexkit/config.toml` `[runner] command = "..."` -> default `codex exec`
  - `cdx init` preview/apply must surface runner source and effective runner command
  - `cdx doctor` must surface active runner source and effective runner command, and block with typed diagnostics for invalid/unavailable/incompatible selected runners
  - onboarding command path stays the accepted public sequence from `P10-S3`
- packaged-artifact smoke matrix must cover:
  - fresh repo install and doctor
  - git-backed repo install and quickstart workflow
  - install-only gating
  - wrapped-runner path
- this artifact freezes the acceptance and verification contract only
- this artifact does not make a public-beta release-readiness claim yet

Out of scope for this artifact:
- reopening accepted `P10-S0`, `P10-S1`, `P10-S2`, or `P10-S3`
- weakening packaged-artifact verification into repo-local checkout verification
- redesigning package identity, runner precedence, onboarding text, or doctor/init semantics
- inspecting or relying on any `P10-S4` candidate implementation summary
- inspecting or relying on any future `P10-S4` code changes
- issuing the final public-beta go/no-go verdict in this report

## Source Of Truth Used

Read first and used:
- `README.md`
- `docs/public-beta-quickstart.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/phase-10-public-cli-packaging-and-onboarding.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s3-passed-p10-s4-ready-control-agent-20260329-211822.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s3-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s3-remediation-session-d-lead-verdict-20260329-s45.md`

Accepted Phase 10 contract inputs used:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s0-passed-p10-s1-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-passed-p10-s2-ready-control-agent-20260328-191331.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s2-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s2-passed-p10-s3-ready-control-agent-20260329-191012.md`

Pinned `BASE_SHA` repo-context inspection used only to size narrow verification seams:
- `package.json`
- `packages/codexkit-cli/package.json`
- `tests/runtime/helpers/runtime-fixture.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts`

Not used:
- any `P10-S4` implementation summary
- any future `P10-S4` tester, reviewer, or verdict artifact
- any current-tree `P10-S4` code delta beyond pinned-base context

## Real Harness Decision

Primary Session B harness:
- packaged-artifact CLI execution is required
- the test wave must first produce a packed npm artifact for `@codexkit/cli`
- each acceptance fixture must install that packed artifact into an isolated temp location
- each workflow command under test must execute the installed `cdx` path from that isolated artifact install

Why this is the right harness now:
- the planner freeze for `P10-S4` is explicit that repo-local `./cdx` is not enough
- accepted `P10-S1` made the package publishable; `P10-S4` is the first slice that must prove the public artifact path itself
- accepted `P10-S2` and `P10-S3` already froze the runner and onboarding contracts that the artifact must preserve

Hard gate:
- the harness must fail if the executed CLI path resolves to the repo-root `./cdx`
- the harness must capture the real installed-bin path in evidence

Allowed supplemental harness:
- existing repo-local Phase 8/9 runtime suites may still run as regression context
- they are supplemental only and cannot satisfy `P10-S4` acceptance

## Packaged-Artifact Execution Rule

Session B must treat these steps as the minimum packaged-artifact path:

1. build or prepack the CLI artifact in the workspace
2. create a tarball or equivalent packed npm artifact for `@codexkit/cli`
3. install that artifact into an isolated temp prefix or temp project
4. resolve the installed `cdx` executable from that isolated install
5. run all `P10-S4` workflow probes through that resolved installed executable

Accepted execution shapes:
- local install into isolated temp project, then execute `<install-root>/node_modules/.bin/cdx`
- isolated global-style prefix install, then execute `<prefix>/bin/cdx`

Disallowed execution shapes:
- repo-root `./cdx`
- direct TypeScript-source execution from the checkout
- any harness that proves only `npm pack` success without running the installed bin

## Host `npx` EPERM Caveat Handling

Host constraint that remains explicit:
- raw `npx` without repo-local cache override can fail with `EPERM` on `~/.npm` ownership on this host
- canonical scripted package-install path remains green

Frozen policy for `P10-S4` on this host:
- do not require raw unqualified `npx @codexkit/cli ...` as the gating execution path
- do not downgrade acceptance to repo-local `./cdx` because raw `npx` is hostile on this host
- use a repo-local or fixture-local npm cache override for package build/install steps when needed
- keep the acceptance target on the packaged artifact by executing the installed `cdx` bin path from the packed artifact

Meaning:
- host-safe cache overrides are allowed for `npm pack`, `npm install`, or optional `npm exec` plumbing
- the command-under-test still must be the packaged artifact's `cdx`, not the checkout wrapper
- an optional informational `npx` probe may be added later, but it is not the acceptance gate for this host

## Frozen Acceptance Matrix

If Session A adds a dedicated `P10-S4` verification file, Session B should run that unchanged first. Regardless, these probes are the frozen `P10-S4` contract.

### F1. Fresh Repo Install And Doctor Through Installed Artifact

Fixture:
- isolated temp repo with `.git` initialized but no initial commit
- packed `@codexkit/cli` artifact installed into isolated temp location

Commands:
- packaged-artifact install
- `<installed-cdx> init --json`
- `<installed-cdx> init --apply --approve-protected --approve-managed-overwrite --json`
- `<installed-cdx> doctor --json`

Required checks:
- harness records tarball path, install root, and resolved `<installed-cdx>` path
- resolved executable path is not the repo-root `./cdx`
- `init` preview/apply surface accepted runner source and command fields
- apply succeeds and reports install state
- resulting repo is `installOnly === true`
- `doctor` completes through the installed artifact path and emits a durable `doctor-report.md`
- `doctor-report.md` repeats active runner source plus active runner command

Failure examples:
- harness shells out to `./cdx`
- artifact installs but the test never executes the installed `cdx`
- install-only repo is misclassified as ready for worker-backed workflows

### F2. Git-Backed Repo Install And Quickstart Workflow Through Installed Artifact

Fixture:
- isolated temp git-backed repo with initial commit
- packed `@codexkit/cli` artifact installed into isolated temp location
- stable fake runner or accepted local runner setup sufficient for smoke execution

Commands:
- packaged-artifact install
- `<installed-cdx> init --json`
- `<installed-cdx> init --apply --approve-protected --approve-managed-overwrite --json`
- `<installed-cdx> doctor --json`
- `<installed-cdx> brainstorm "<task>" --json`
- `<installed-cdx> plan "<task>" --json`
- `<installed-cdx> cook <absolute-plan-path> --json`

Required checks:
- all workflow invocations run through the same installed packaged-artifact bin
- `init` and `doctor` preserve accepted public onboarding contract from `P10-S3`
- `brainstorm`, `plan`, and `cook` execute as the minimum accepted quickstart path
- `cook` uses the absolute `plan.md` path produced by the run, not a repo-local shortcut
- durable workflow artifacts exist for the quickstart path
- no command in the quickstart lane falls back to repo-root `./cdx`

Failure examples:
- quickstart smoke uses repo-local helper commands not available to an outside user
- `cook` uses a relative or guessed plan path
- installed artifact passes init/doctor only but worker-backed quickstart commands fail due to packaging path drift

### F3. Install-Only Gating Through Installed Artifact

Fixture:
- same fresh repo shape as `F1`
- packaged artifact installed into isolated temp location

Commands:
- `<installed-cdx> init --json`
- `<installed-cdx> init --apply --approve-protected --approve-managed-overwrite --json`
- failure probes through installed artifact:
  - `<installed-cdx> cook`
  - `<installed-cdx> review`
  - `<installed-cdx> test`
  - one additional worker-backed workflow if needed

Required checks:
- install-only repo remains blocked after successful packaged-artifact install and apply
- blocked commands fail with typed install-only diagnostics, not generic shell failures
- acceptance proves the install-only gate survives the packaged artifact boundary

Failure examples:
- install-only gate passes in repo-local suites but not through installed artifact
- packaged artifact changes error typing or bypasses the first-commit gate

### F4. Wrapped-Runner Path Through Installed Artifact

Fixture:
- isolated temp git-backed repo with initial commit
- packaged artifact installed into isolated temp location
- local executable wrapper such as `./bin/codex-safe`
- one variant with config-file selection
- one variant with env override beating config

Commands:
- config-selected path:
  - `<installed-cdx> init --json`
  - `<installed-cdx> doctor --json`
- env-selected path:
  - `CODEXKIT_RUNNER='./bin/codex-safe exec --profile "beta lane"' <installed-cdx> init --json`
  - `CODEXKIT_RUNNER='./bin/codex-safe exec --profile "beta lane"' <installed-cdx> doctor --json`

Required checks:
- packaged-artifact execution preserves accepted runner precedence from `P10-S2`
- config-file selection reports `runnerSource === "config-file"` and the configured command
- env override reports `runnerSource === "env-override"` and beats config
- `doctor` remains healthy for available wrappers and keeps typed blocked diagnostics for broken selections if Session A includes that negative probe
- durable `init-report.md` and `doctor-report.md` repeat the selected source and command

Failure examples:
- packaged artifact hardcodes bare `codex` while repo-local tests pass
- env override no longer beats config when launched from installed bin
- wrapper-safe behavior exists only in docs, not in artifact execution

## Stable Verification-Owned Harness Additions

Keep harness additions narrow and reusable only for packaged-artifact proof.

Allowed additions:
- one new Phase 10 packaged-artifact integration suite under `tests/runtime/`
- one helper that packs the CLI artifact once and returns the tarball path
- one helper that installs the packed artifact into an isolated temp location with a fixture-local npm cache override
- one helper that resolves and executes the installed `cdx` bin, returning JSON plus the executed-bin path
- one helper for creating local wrapper shims such as `codex-safe`

Not approved by this contract:
- broad rewrites of existing Phase 8/9 runtime suites
- replacing repo-local runtime helpers wholesale
- adding a second packaging lane or non-npm distribution harness
- coupling the acceptance harness to real registry publication

## Evidence Expectations For Session B

Tester evidence should include:
- packed artifact path
- install root or prefix used for each fixture
- resolved installed `cdx` path used for each probe
- durable report paths produced by `init`, `doctor`, and quickstart workflows
- explicit note that repo-local `./cdx` was not used for acceptance
- explicit note when npm cache override was used to avoid host `~/.npm` `EPERM`

Session B pass condition:
- all frozen `F1` through `F4` checks pass through the packaged-artifact path

Session B fail condition:
- any required matrix lane passes only via repo-local checkout
- any required lane lacks proof of the installed-bin path
- packaged-artifact behavior contradicts accepted `P10-S0` through `P10-S3` contracts

## Blockers

- none

## Unresolved Questions

- none
