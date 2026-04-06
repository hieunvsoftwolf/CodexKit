# Phase 04 Planner Decomposition Report

Date: 2026-04-05
Session: S22
Status: completed
Role/modal used: planner / reasoning
Model used: Codex / GPT-5
Pinned BASE_SHA: `308867621e6c3d77746302b08a624445f7b84213`
Phase: `Phase 04 full runtime suite closeout`

## Source-of-truth inputs read

- `README.md`
- `.claude/rules/development-rules.md`
- `package.json`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-04-full-runtime-suite-closeout.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-planner-ready-after-phase-03-closure-20260405-030423.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-01-landing-disposition-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-02-landing-disposition-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-03-landing-disposition-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-03-s20-lead-verdict.md`
- `docs/control-agent/control-agent-codexkit/verification-policy.md`
- `docs/control-agent/control-agent-codexkit/phase-guide.md`
- `docs/control-agent/control-agent-codexkit/plan-contract.md`
- `docs/control-agent/control-agent-codexkit/skill-inventory.md`
- supporting accepted phase artifacts used to freeze verification surfaces:
  - `reports/phase-01-s3-spec-test-design-report.md`
  - `reports/phase-01-s4r-test-report.md`
  - `reports/phase-01-s6-lead-verdict.md`
  - `reports/phase-02-planner-decomposition-report.md`
  - `reports/phase-02-s11r-test-report.md`
  - `reports/phase-02-s13-lead-verdict.md`
  - `reports/phase-03-planner-decomposition-report.md`
  - `reports/phase-03-s17-spec-test-design-report.md`
  - `reports/phase-03-s18r-test-report.md`

## Repo truth refreshed

- `HEAD` is `main` at pinned `BASE_SHA` `308867621e6c3d77746302b08a624445f7b84213`.
- Root control surface is not fully clean even though branch sync is correct:
  - modified `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
  - untracked `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-planner-ready-after-phase-03-closure-20260405-030423.md`
- Treat those root changes as handoff/control artifacts only. Do not use root `main` as the execution surface for closeout verification.
- Accepted Phase 01-03 landings are already on `main`. Phase 04 starts from verification of the landed baseline, not from an assumed new defect bundle.

## Planner decision

### Lane decision

Start Phase 04 with a verification-first lane on a fresh dedicated worktree.

Reason:
- Phase 01-03 accepted scope is already landed on `main`.
- No current artifact proves a new runtime defect on the landed `main` baseline after the final Phase 03 landing.
- The safest first move is to rerun the frozen closeout surface on a clean execution worktree with no code edits.
- Only if that clean rerun produces assertion-layer failure evidence that is not a known host caveat or stale harness/setup drift should Phase 04 convert into a new remediation bundle.

### Rigor decision

Use fast-lane verification-only closeout for the first wave.

Reason:
- This first wave changes no public contract and is intended only to prove the landed baseline.
- The acceptance surface and focused verification subsets are already frozen by accepted Phase 01-03 artifacts.
- A fresh spec-test-design artifact is not required for this verification-only closeout wave.

### Reviewer decision

If the first wave remains verification-only, reviewer scope should be report/diff-based only.

Reviewer checks should be limited to:
- confirm no code or fixture edits were introduced on the verification worktree
- confirm command order, execution surface, exit codes, and raw log paths are recorded correctly
- confirm any failure classification matches the rules in this report

## Execution worktree strategy

### Root-main discipline

- Root `main` remains control-only.
- Do not run the closeout wave on root `main`.
- Do not clean, reset, or reuse the dirty root checkout as the execution surface.

### Fresh worktree shape

Use one brand-new verification worktree from the pinned base.

Recommended branch and path:
- branch: `phase-04-closeout-s23v`
- worktree: `/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v`

Recommended creation sequence:

```bash
git fetch origin --prune
test "$(git rev-parse origin/main)" = "308867621e6c3d77746302b08a624445f7b84213"
git worktree add -b phase-04-closeout-s23v "/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v" 308867621e6c3d77746302b08a624445f7b84213
cd "/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v"
npm_config_cache="$PWD/.npm-cache" npm install --no-audit --no-fund
```

Rules:
- if `origin/main` no longer equals the pinned `BASE_SHA`, stop and report blocked before verification
- do not copy build output or temp state from root `main`
- build artifacts and `.tmp` state must be created inside the fresh verification worktree

## Frozen closeout command order

### Setup and preconditions

Run exactly in this order before focused verification:

```bash
npm_config_cache="$PWD/.npm-cache" npm install --no-audit --no-fund
npm_config_cache="$PWD/.npm-cache" npm run build
```

Rationale:
- accepted Phase 01 and Phase 02 tester waves both required local install plus build before focused Vitest execution
- Phase 04 risk notes explicitly say missing local build output must not be misclassified as product regression

### Focused Phase 01 verification

Run exactly in this order:

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts -t 'plan validate/red-team/archive subcommands require archive approval continuation before mutation and return deterministic outputs'
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts
```

Freeze note:
- preserve the Phase 01 targeted archive assertion instead of inventing a new whole-file Phase 01 gate
- full `runtime-cli.integration.test.ts` is verified later under Phase 02 and again under full-suite closeout

### Focused Phase 02 verification

Run exactly in this order:

```bash
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx fix covers explicit entry plus chooser continuation and publishes durable artifacts'
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx team creates a runnable team workflow with checkpointed output and durable artifacts'
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts -t 'supports phase 6 wave-1 review/test/debug commands and runs fix/team workflows with typed diagnostics'
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts
```

Freeze note:
- Phase 02 accepted evidence requires both anchor tests, the targeted Phase 6 block, and the full CLI file
- do not reintroduce the old Phase 02 manual follow-up unless the focused rerun fails and needs boundary classification

### Focused Phase 03 verification

Run exactly in this order:

```bash
git ls-files --stage tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json
git ls-files --stage plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json
rg -n "phase-9-frozen-claudekit-plan-cook-trace.json|tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json" tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts
npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts
```

Freeze note:
- if the literal-path `rg` exits `1`, do not fail the wave automatically
- apply the accepted Phase 03 bounded follow-up classification before escalating

### Final closeout verification

Run exactly in this order after focused Phase 01-03 verification completes:

```bash
npm_config_cache="$PWD/.npm-cache" npm run build
npm_config_cache="$PWD/.npm-cache" npm run typecheck
TMPDIR=.tmp npm run test:runtime
```

Reason for the second `build`:
- it keeps the Phase 04 acceptance sequence aligned with the explicit closeout surface after all focused checks
- it avoids ambiguity about whether later commands relied on earlier setup-only build output

## Failure classification rules

### Host caveat

Treat as host caveat only when the failure is one of these known classes and occurs before assertion-layer evidence:
- raw `npx` or npm-cache startup failure with `EPERM` tied to invalid `~/.npm` ownership
- Vite/Vitest temp-file startup `EPERM` on this host before tests load

Required handling:
- preserve `npm_config_cache="$PWD/.npm-cache"`
- preserve `TMPDIR=.tmp`
- record exact command, exit code, stderr/log path, and whether assertions were reached
- do not classify as product regression

### Stale harness or setup drift

Treat as stale harness/setup drift when the failure is caused by the verification surface rather than the landed runtime baseline, including:
- missing `node_modules` because install was skipped
- missing local build artifacts because the precondition build was skipped
- incorrect execution surface, such as running on dirty root `main` instead of the clean worktree
- Phase 03 literal-path grep false-negative when the focused suite passes and bounded follow-up proves canonical `path.join(...)` assembly with no historical live read

Required handling:
- rerun only after restoring the frozen setup and execution surface
- do not convert to remediation bundle on this evidence alone

### New runtime regression

Treat as new runtime regression only if all are true:
- verification ran on the fresh Phase 04 worktree from pinned `BASE_SHA`
- frozen setup steps completed successfully
- assertion-layer evidence was reached, or build/typecheck failed on the clean worktree after correct setup
- the failure is not covered by the host-caveat or stale-harness classifications above
- the failure contradicts the accepted Phase 01-03 contract on landed `main`

Examples that would qualify:
- a focused Phase 01 archive contract assertion fails after the archive anchor tests are green
- a focused Phase 02 runnable `fix/team` assertion fails on current `main`
- the Phase 03 focused suite reaches assertions and fails for a reason other than the accepted grep caveat
- `npm run build`, `npm run typecheck`, or `npm run test:runtime` fail on the clean worktree after successful install/setup

## Remediation conversion rule

Do not start a code-changing remediation bundle unless the clean verification-first wave proves a new runtime regression.

If conversion is required:
- stop the verification-only lane
- preserve the failed verification worktree and raw logs as evidence
- classify the failure by owned seam before routing any implementation
- route one new remediation planner/debugger wave scoped only to the proven failing seam
- do not reopen accepted Phase 01-03 scope beyond the contradicted seam

## Spec-test-design decision

No new Phase 04 spec-test-design artifact is required for the first wave.

Reason:
- command order and acceptance surface are already frozen by the phase doc plus accepted Phase 01-03 verification artifacts
- this wave is verification-only with no new public-contract design work
- if the wave converts into a new remediation bundle, reassess whether a fresh B0 artifact is needed for that new defect scope

## Downstream prompts for next runnable sessions only

### S23 Verification-Only Closeout Tester

```text
You are tester for CodexKit.
Skills: none required.
Session role expected: tester.
Source of truth: current landed `main` baseline at pinned `BASE_SHA`, accepted Phase 01-03 closure artifacts, and this Phase 04 planner report.

Read first:
- README.md
- .claude/rules/development-rules.md
- package.json
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-04-full-runtime-suite-closeout.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-planner-decomposition-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-planner-ready-after-phase-03-closure-20260405-030423.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-01-s3-spec-test-design-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-01-s4r-test-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-02-s11r-test-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-03-s17-spec-test-design-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-03-s18r-test-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Session id: S23
Phase: Phase 04 full runtime suite closeout
Pinned BASE_SHA: 308867621e6c3d77746302b08a624445f7b84213

Goal:
- prove whether the landed `main` baseline closes out cleanly on a fresh execution surface with no code edits
- run the frozen Phase 04 closeout command order exactly
- classify any failure only as host caveat, stale harness/setup drift, or new runtime regression using the planner report rules

Execution surface:
- root checkout is control-only and must not be used for execution
- create a fresh dedicated verification worktree from pinned `BASE_SHA`
- branch: `phase-04-closeout-s23v`
- worktree: `/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v`

Guardrails:
- do not implement code
- do not edit tests, fixtures, docs, or production files
- preserve repo-local npm cache override where relevant: `npm_config_cache="$PWD/.npm-cache"`
- preserve `TMPDIR=.tmp` for Vitest surfaces
- if `origin/main` does not match pinned `BASE_SHA`, stop and report blocked
- do not use root-local untracked artifacts as live inputs

Run exactly this worktree setup first:
- `git fetch origin --prune`
- `test "$(git rev-parse origin/main)" = "308867621e6c3d77746302b08a624445f7b84213"`
- `git worktree add -b phase-04-closeout-s23v "/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v" 308867621e6c3d77746302b08a624445f7b84213`
- `cd "/Users/hieunv/Claude Agent/CodexKit-p04-closeout-s23v"`

Then run exactly this command order:
1. `npm_config_cache="$PWD/.npm-cache" npm install --no-audit --no-fund`
2. `npm_config_cache="$PWD/.npm-cache" npm run build`
3. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
4. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
5. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts`
6. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts -t 'plan validate/red-team/archive subcommands require archive approval continuation before mutation and return deterministic outputs'`
7. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
8. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx fix covers explicit entry plus chooser continuation and publishes durable artifacts'`
9. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts -t 'real cdx team creates a runnable team workflow with checkpointed output and durable artifacts'`
10. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts -t 'supports phase 6 wave-1 review/test/debug commands and runs fix/team workflows with typed diagnostics'`
11. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts`
12. `git ls-files --stage tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
13. `git ls-files --stage plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json`
14. `rg -n "phase-9-frozen-claudekit-plan-cook-trace.json|tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json" tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
15. `npm_config_cache="$PWD/.npm-cache" TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
16. `npm_config_cache="$PWD/.npm-cache" npm run build`
17. `npm_config_cache="$PWD/.npm-cache" npm run typecheck`
18. `TMPDIR=.tmp npm run test:runtime`

Special rule for step 14:
- if the literal-path `rg` exits `1`, do not fail automatically
- perform bounded follow-up classification exactly as accepted in Phase 03:
  - inspect whether the active test assembles the canonical path via `path.join(...)`
  - confirm no historical live-read remains
  - if step 15 passes and those checks hold, classify step 14 as accepted grep brittleness, not regression

Write a durable report to:
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s23-closeout-test-report.md`

The report must include:
- exact execution surface
- exact commands run in order
- exit code/result for every command
- raw log path for every command
- explicit classification for every failure or caveat
- one of:
  - closeout green on landed `main`
  - blocked by host caveat
  - blocked by stale harness/setup drift
  - blocked by new runtime regression

## Paste-Back Contract
When done, reply using exactly this template:

## S23 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### S24 Verification-Only Reviewer

```text
You are code-reviewer for CodexKit.
Skills: none required.
Session role expected: reviewer.
Source of truth: landed `main`, the Phase 04 planner report, and the S23 verification-only artifact set.

Read first:
- README.md
- .claude/rules/development-rules.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-04-full-runtime-suite-closeout.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-planner-decomposition-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s23-closeout-test-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Session id: S24
Phase: Phase 04 full runtime suite closeout
Pinned BASE_SHA: 308867621e6c3d77746302b08a624445f7b84213

Need:
- review the S23 verification-only closeout evidence
- confirm the worktree stayed no-code-change
- confirm the report records exact command order, execution surface, exit codes, and raw evidence paths correctly
- confirm any failure classification follows the Phase 04 planner rules exactly

Scope:
- report/diff-based review only
- no implementation
- no new verification runs unless required to validate a claimed diff/no-diff state

Findings priority:
- CRITICAL
- IMPORTANT
- MODERATE
- or explicit no findings

Write a durable report to:
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s24-closeout-review-report.md`

## Paste-Back Contract
When done, reply using exactly this template:

## S24 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### S25 Lead Verdict

```text
You are lead verdict for CodexKit.
Skills: none required.
Session role expected: lead verdict.
Source of truth: landed `main`, the Phase 04 planner report, the S23 tester report with raw evidence, and the S24 review report.

Read first:
- README.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/phase-04-full-runtime-suite-closeout.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-planner-decomposition-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s23-closeout-test-report.md
- plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s24-closeout-review-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Session id: S25
Phase: Phase 04 full runtime suite closeout
Pinned BASE_SHA: 308867621e6c3d77746302b08a624445f7b84213

Need:
- decide whether Phase 04 closes out on landed `main`
- inspect the S23 raw evidence references directly before passing
- confirm whether any reported failure is host caveat, stale harness/setup drift, or new runtime regression
- if S23 proved a new runtime regression, do not route blind implementation; mark the wave blocked and identify the exact contradicted seam for the next planner/debugger route
- if S23 is green and S24 has no material findings, mark the plan ready for closeout reporting and control-state advancement

Write a durable report to:
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s25-lead-verdict.md`

## Paste-Back Contract
When done, reply using exactly this template:

## S25 Result
- status: completed | blocked
- role/modal used: ...
- model used: ... / ...

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

## Final planner outcome

- Phase 04 should not begin with implementation/debugger work.
- Phase 04 should begin with verification-only closeout on a fresh dedicated worktree.
- No new spec-test-design artifact is required for that first wave.
- Reviewer scope should stay report/diff-based only if the first wave remains verification-only.
- Preserve the repo-local npm cache override everywhere `npx` is involved.
- Keep root `main` control-only until the verification-first wave either proves closeout green or proves a new runtime regression that justifies a new remediation bundle.

## Unresolved questions

- none
