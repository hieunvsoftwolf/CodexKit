# Phase 12 Phase 5 Planner Decomposition Report

Date: 2026-04-04
Status: completed
Role/Modal Used: planner / reasoning

## 1. Current State Summary

- Repo is a mature plan-driven control repo with active plan, active phase doc, generated control docs, and latest durable control-state already in place.
- Active plan: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md`
- Active phase: `12.5`
- Active phase doc: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md`
- Latest durable state: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-planner-ready-after-phase-04-sync-20260404-180017.md`
- Pinned clean synced baseline for routing: `26129189981209dbd868a33d9342691bc6114738`
- Scope is narrow enough to route now, but too seam-coupled to hand to one unscoped coding lane blindly.
- Host verification caveat is already durable and must carry forward unchanged:
  - sandboxed `vitest` and broader runtime verification on this host can fail before assertion-layer evidence with Vite temp-file `EPERM` under `node_modules/.vite-temp`
  - if that happens again on the same surface, rerun the same command with elevated execution and record the caveat instead of blind same-surface sandbox retries

## 2. Detected Archetype + Confidence

- detected_archetype: `agent-platform`
- archetype_confidence: `0.97 (high)`
- rationale: repo centers on workflow orchestration, durable runs, approvals, checkpoints, worktrees, plan hydration, and multi-session control routing rather than a conventional app UI or backend API
- fallback_assumptions: none

## 3. Detected Mode + Why

- detected_mode: `post-control-refresh`
- why_this_mode: usable plan, usable control scaffolding, active phase doc, and current durable control-state all exist and agree that Phase 12.5 is planner-ready on a clean synced baseline; this is not pre-control bootstrap and does not yet require phase-rescue because scope, baseline, and host caveat are aligned
- recommended_next_skill: `control-agent`

## 4. Risk Map

- `critical` | `cook/review/test/finalize gate seam` | `cook` finalize readiness depends on review/test evidence shape, while represented gate ids require end-to-end closeout semantics instead of the current defer-before-finalize behavior | source: `cook-workflow.ts`, `review-workflow.ts`, `test-workflow.ts`, `finalize-workflow.ts`, phase doc acceptance
- `critical` | `shared runtime workflow evidence contract` | changing review/test/finalize artifact expectations in more than one coding lane will create collision and proof drift immediately | source: `cook-workflow.ts` `canFinalizeCookRun`, shared workflow files named in phase doc
- `important` | `debug verification evidence seam` | `debug` already publishes evidence artifacts, but Phase 12.5 requires represented verification-evidence completion, so the gap is contract depth, not just file presence | source: `debug-workflow.ts`, phase doc related graph ids
- `important` | `plan-files/template seam` | template assets do not exist yet and `createPlanBundle` is still fully hardcoded, so content creation and selection wiring must be separated cleanly | source: missing `plans/templates/**`, `plan-files.ts`, `plan-workflow.ts`
- `important` | `shared legacy runtime tests` | the three named runtime files are already cross-phase seams; using them as Session A's first edit surface would create avoidable collisions between gate and template work | source: phase doc related code files, existing runtime tests
- `moderate` | `docs drift risk` | `template-usage-guide.md` is in scope and user-facing; if selection semantics escape into `README.md` or `docs/**`, a docs-manager follow-up lane becomes mandatory rather than implicit | source: phase scope plus AGENTS instructions

## 5. Recommended Bundle Split

### Bundle A: Gate Closeout Foundation

- scope:
  - `workflow.cook`
  - `gate.review_approval`
  - `gate.test_pass_required`
  - `gate.finalize_required`
  - `gate.review_verification_evidence_required`
- dangerous seam: shared workflow evidence and finalize orchestration contract
- why the split lowers risk:
  - isolates the highest-collision runtime seam first
  - keeps all cook/review/test/finalize evidence-shape changes in one owner
  - prevents template work from reopening finalize semantics

Owned production files:

- `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
- `packages/codexkit-daemon/src/workflows/test-workflow.ts`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`

May touch only if required by compile or helper extraction:

- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`

Do not own:

- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `plans/templates/**`

### Bundle B: Debug Verification Evidence

- scope:
  - `gate.debug_verification_evidence_required`
- dangerous seam: debug evidence completion contract
- why the split lowers risk:
  - debug file is isolated from the cook/review/test/finalize shared gate seam
  - lets debug close independently without reopening cook finalize logic

Owned production files:

- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`

May touch only if required by compile or helper extraction:

- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`

Do not own:

- any cook/review/test/finalize files
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `plans/templates/**`

### Bundle C: Template Assets

- scope:
  - `template.feature_implementation`
  - `template.bug_fix`
  - `template.refactor`
  - `template.template_usage_guide`
- dangerous seam: public plan-template content contract
- why the split lowers risk:
  - creates the template source-of-truth before plan-selection wiring binds behavior to it
  - keeps user-facing markdown assets in one owner

Owned files:

- `plans/templates/feature-implementation-template.md`
- `plans/templates/bug-fix-template.md`
- `plans/templates/refactor-template.md`
- `plans/templates/template-usage-guide.md`

Do not own:

- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- runtime workflow files

### Bundle D: Template Selection Wiring

- scope:
  - bind plan creation to the new template assets without breaking current generic plan generation
- dangerous seam: plan generation and plan-bundle contract
- why the split lowers risk:
  - keeps logic changes separate from content-authoring changes
  - lets Bundle C settle the exact template filenames and headings first

Owned production files:

- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `packages/codexkit-daemon/src/workflows/plan-workflow.ts` only if selection input or handoff metadata must change

Do not own:

- workflow gate files
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`

## 6. Lane Assignment

- Bundle A -> `high-rigor`
  - public workflow contract, approval/gate behavior, finalize sequencing, and shared orchestration seam
- Bundle B -> `high-rigor`
  - public workflow contract and durable evidence/checkpoint semantics
- Bundle C -> `high-rigor`
  - user-facing template contract that will be consumed by plan generation and later workflow execution
- Bundle D -> `high-rigor`
  - plan generation contract and persistent plan artifact shape

No `fast` or `standard` bundle is justified in this phase.

## 7. Verification Matrix

### Bundle A

- primary harness:
  - new phase-local runtime integration test for gate closeout, not the shared legacy files as first ownership surface
- supporting harness or artifact:
  - broader regression on:
    - `tests/runtime/runtime-workflow-wave2.integration.test.ts`
    - `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- blocking gate:
  - `cook` must not claim Phase 12.5 closeout while review/test/finalize evidence is still missing
- preserved host caveat:
  - direct `vitest` with `TMPDIR=.tmp NODE_NO_WARNINGS=1`
  - if sandboxed EPERM occurs pre-assertion, rerun elevated and record the caveat

### Bundle B

- primary harness:
  - new phase-local runtime integration test for debug evidence completion
- supporting harness or artifact:
  - broader regression on `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- blocking gate:
  - debug must publish verification evidence sufficient to close represented gate semantics, not just a root-cause note
- preserved host caveat:
  - same `vitest` caveat as above

### Bundles C and D

- primary harness:
  - new phase-local runtime integration test for template asset presence and plan template selection behavior
- supporting harness or artifact:
  - generated plan bundle output inspection
  - broader runtime regression after phase-local tests pass
- blocking gate:
  - plan generation must use the new template assets without regressing current plan bundle persistence
- preserved host caveat:
  - same `vitest` caveat as above

## 8. Sequencing / Parallelism Notes

What must happen first:

1. Freeze verification ownership in B0 with new phase-local tests and exact commands.
2. Start Bundle A and Bundle B only after their file ownership is explicit.
3. Start Bundle D only after Bundle C establishes the template asset filenames and headings.

What can run in parallel safely:

- Bundle A and Bundle B can run in parallel.
- Bundle C can run in parallel with Bundle A and Bundle B.
- Session B0 can run in parallel with Bundle A, Bundle B, and Bundle C if B0 owns only new phase-local verification files and its report.

What must stay serialized:

- Bundle A and Bundle B must not share a coding owner because both may be tempted to touch shared workflow registration/contracts if not scoped tightly.
- Bundle C must finish before Bundle D because `plan-files.ts` should bind to real template assets, not speculative filenames/content.
- Shared regression execution stays serialized after code lanes land:
  - phase-local first-pass subset
  - then broader regressions on the three named legacy runtime suites
  - then `npm run build`
  - then `npm run typecheck`
  - then broader `npm run test:runtime` only after owned subsets are green or explicitly classified

## 9. Misclassification Risks

- likely archetype confusion:
  - repo also looks like a library/CLI workspace, but the dominant risk is orchestration and durable workflow semantics, so `agent-platform` remains correct
- likely mode confusion:
  - this phase is high-risk, but not yet `phase-rescue` because the current docs, latest control-state, and baseline SHA agree on the next action
- evidence that would change classification:
  - if the current phase doc, plan frontmatter, and durable control-state diverge during routing, or if two blind verification retries happen on the same EPERM surface again, reroute to `phase-rescue`

## 10. Apply-Vs-Dry-Run Note

- default skill posture is dry-run, but this session was explicitly asked to write the durable planner report
- acceptance criteria were not changed
- no code was implemented

would_change_paths:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md`

No `plan.md`, phase doc, or control-state update is required in this planner session unless a later control-agent session decides to persist new downstream routing state.

## 11. Recommended Next Skill

- recommended_next_skill: `control-agent`
- handoff_goal: route the minimum safe Phase 12.5 execution wave using the owned-lane split below and preserve the host EPERM caveat verbatim
- handoff_preconditions:
  - use pinned `BASE_SHA` `26129189981209dbd868a33d9342691bc6114738`
  - treat root `main` as control surface only
  - create fresh execution worktrees for each code-changing implement lane

## Shared Files, Shared Contracts, And Risky Seams

These make a single unscoped coding lane unsafe:

- `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
  - owns finalize trigger and current defer-before-finalize behavior
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
  - owns review evidence artifact and approval-scope behavior
- `packages/codexkit-daemon/src/workflows/test-workflow.ts`
  - owns test evidence artifact and pass/fail contract
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`
  - owns finalize checkpoint outputs and terminal report contract
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
  - owns debug evidence and conclusion chain; separate from cook gate seam but still a public workflow contract
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
  - owns generated plan bundle shape
- `packages/codexkit-daemon/src/workflows/plan-workflow.ts`
  - entrypoint to plan creation; may need selection metadata only if template choice becomes explicit in workflow inputs
- `plans/templates/*.md`
  - new user-facing assets that must exist before selection wiring binds behavior to them
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
  - current cook shared seam
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
  - current debug shared seam
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
  - current finalize shared seam

## Minimum Safe Wave Plan

### Wave 1 Parallel

- `S9A` implement lane A: Bundle A only
- `S9B` implement lane B: Bundle B only
- `S9C` implement lane C: Bundles C then D in the same session
- `S9D` spec-test-design: owns only new phase-local verification files and report

### Wave 2

- `S10` tester after `S9A`, `S9B`, `S9C`, and `S9D`
- `S11` reviewer after `S9A`, `S9B`, and `S9C`

### Wave 3

- `S12` lead verdict after `S10` and `S11`

Why this is minimum-safe:

- it keeps the gate workflow seam together
- it isolates debug from cook/finalize collisions
- it lets template content exist before selection wiring
- it still uses one tester, one reviewer, one verdict surface for phase-close proof

## Docs-Manager Lane Decision

- no separate docs-manager lane is required in the minimum safe wave if scoped work stays inside:
  - `plans/templates/feature-implementation-template.md`
  - `plans/templates/bug-fix-template.md`
  - `plans/templates/refactor-template.md`
  - `plans/templates/template-usage-guide.md`
- if any implement lane needs to update `README.md`, `docs/**`, control docs, or operator guidance outside those four template assets, add an explicit docs-manager lane after implementation and before verdict; do not fold that drift silently into coding sessions

## Verification-Owned Test Recommendation

Session B0 should avoid first ownership of the three legacy shared runtime files. Freeze new phase-local verification files instead:

- `tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts`

Broader regression after the phase-local subset passes:

- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `npm run test:runtime`

## Exact Handoff Prompts

### S9A Implement Prompt

```text
You are Session S9A, role `implement`, modal `coding`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-planner-ready-after-phase-04-sync-20260404-180017.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Pinned BASE_SHA: `26129189981209dbd868a33d9342691bc6114738`
Execution surface:
- root repo `/Users/hieunv/Claude Agent/CodexKit` is read-only control surface
- create a fresh dedicated execution worktree from BASE_SHA for this session

Phase scope for this session only:
- `workflow.cook`
- `gate.review_approval`
- `gate.test_pass_required`
- `gate.finalize_required`
- `gate.review_verification_evidence_required`

Own exactly these production files:
- packages/codexkit-daemon/src/workflows/cook-workflow.ts
- packages/codexkit-daemon/src/workflows/review-workflow.ts
- packages/codexkit-daemon/src/workflows/test-workflow.ts
- packages/codexkit-daemon/src/workflows/finalize-workflow.ts

May touch only if required by compile or helper extraction:
- packages/codexkit-daemon/src/workflows/contracts.ts
- packages/codexkit-daemon/src/runtime-controller.ts
- packages/codexkit-daemon/src/workflows/index.ts

Do not touch:
- packages/codexkit-daemon/src/workflows/debug-workflow.ts
- packages/codexkit-daemon/src/workflows/plan-files.ts
- plans/templates/**
- verification-owned files from S9D

Requirements:
- do not reopen Phase 12.4
- do not implement speculative refactors
- keep all cook/review/test/finalize evidence-shape changes in this lane only
- close represented gate semantics without claiming completion before required review/test/finalize evidence exists
- if a chooser, approval, or continuation path is touched, cover both entry and continuation in the same lane

Required local verification before paste-back:
- run the frozen S9D first-pass subset unchanged if it already exists
- otherwise run only narrow compile/smoke checks you need to reach a plausible candidate
- do not edit S9D-owned files

Host verification caveat to preserve:
- sandboxed vitest/runtime verification on this host can fail before assertion evidence with Vite temp-file EPERM under node_modules/.vite-temp
- if that happens on the same surface, rerun the same command elevated and record that caveat; do not blind-retry sandboxed

Deliverable:
- implementation summary report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S9A Result
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

### S9B Implement Prompt

```text
You are Session S9B, role `implement`, modal `coding`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-planner-ready-after-phase-04-sync-20260404-180017.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md

Pinned BASE_SHA: `26129189981209dbd868a33d9342691bc6114738`
Execution surface:
- root repo `/Users/hieunv/Claude Agent/CodexKit` is read-only control surface
- create a fresh dedicated execution worktree from BASE_SHA for this session

Phase scope for this session only:
- `gate.debug_verification_evidence_required`

Own exactly these production files:
- packages/codexkit-daemon/src/workflows/debug-workflow.ts

May touch only if required by compile or helper extraction:
- packages/codexkit-daemon/src/workflows/contracts.ts
- packages/codexkit-daemon/src/runtime-controller.ts
- packages/codexkit-daemon/src/workflows/index.ts

Do not touch:
- packages/codexkit-daemon/src/workflows/cook-workflow.ts
- packages/codexkit-daemon/src/workflows/review-workflow.ts
- packages/codexkit-daemon/src/workflows/test-workflow.ts
- packages/codexkit-daemon/src/workflows/finalize-workflow.ts
- packages/codexkit-daemon/src/workflows/plan-files.ts
- plans/templates/**
- verification-owned files from S9D

Requirements:
- deepen debug verification evidence only as far as Phase 12.5 requires
- preserve current branch classification behavior unless a directly required fix emerges
- do not broaden into generic debug workflow redesign

Required local verification before paste-back:
- run the frozen S9D debug subset unchanged if it already exists
- otherwise keep verification narrow and phase-local

Host verification caveat to preserve:
- sandboxed vitest/runtime verification on this host can fail before assertion evidence with Vite temp-file EPERM under node_modules/.vite-temp
- if that happens on the same surface, rerun the same command elevated and record that caveat; do not blind-retry sandboxed

Deliverable:
- implementation summary report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S9B Result
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

### S9C Implement Prompt

```text
You are Session S9C, role `implement`, modal `coding`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-planner-ready-after-phase-04-sync-20260404-180017.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md

Pinned BASE_SHA: `26129189981209dbd868a33d9342691bc6114738`
Execution surface:
- root repo `/Users/hieunv/Claude Agent/CodexKit` is read-only control surface
- create a fresh dedicated execution worktree from BASE_SHA for this session

Phase scope for this session only:
- `template.feature_implementation`
- `template.bug_fix`
- `template.refactor`
- `template.template_usage_guide`

Own exactly these files first:
- plans/templates/feature-implementation-template.md
- plans/templates/bug-fix-template.md
- plans/templates/refactor-template.md
- plans/templates/template-usage-guide.md

Then own selection wiring only after those assets exist:
- packages/codexkit-daemon/src/workflows/plan-files.ts

May touch only if required by compile or selection-input wiring:
- packages/codexkit-daemon/src/workflows/plan-workflow.ts

Do not touch:
- any cook/review/test/finalize/debug workflow files
- verification-owned files from S9D
- README.md
- docs/**

Requirements:
- keep template content and wiring in the same lane so filenames/headings do not drift
- do not silently expand into broader docs updates
- if you discover README/docs drift that must change, stop and report it as a docs-manager follow-up requirement instead of editing those files here
- preserve current generic plan-bundle behavior for non-template cases unless phase scope explicitly requires new selection defaults

Required local verification before paste-back:
- run the frozen S9D template subset unchanged if it already exists
- otherwise keep verification narrow and phase-local

Host verification caveat to preserve:
- sandboxed vitest/runtime verification on this host can fail before assertion evidence with Vite temp-file EPERM under node_modules/.vite-temp
- if that happens on the same surface, rerun the same command elevated and record that caveat; do not blind-retry sandboxed

Deliverable:
- implementation summary report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S9C Result
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

### S9D Spec-Test-Design Prompt

```text
You are Session S9D, role `spec-test-design`, modal `reasoning`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-05-planner-ready-after-phase-04-sync-20260404-180017.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Pinned BASE_SHA: `26129189981209dbd868a33d9342691bc6114738`

Own exactly these files:
- tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts
- tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts
- tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-spec-test-design-report.md

Do not touch:
- production files
- shared legacy runtime tests

Freeze acceptance for:
- cook/review/test/finalize gate closeout semantics
- debug verification evidence completion
- template asset presence plus template-selection behavior in plan generation

Required first-pass commands to design and publish:
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts`

Required broader regression commands to freeze for Session B:
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `npm run build`
- `npm run typecheck`
- `npm run test:runtime`

Host verification caveat to preserve verbatim:
- sandboxed vitest/runtime verification on this host can fail before assertion evidence with Vite temp-file EPERM under node_modules/.vite-temp
- if that happens on the same surface, rerun the same command elevated and record that caveat; do not blind-retry sandboxed

## Paste-Back Contract
When done, reply using exactly this template:

## S9D Result
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

### S10 Tester Prompt

```text
You are Session S10, role `tester`, modal `coding`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- frozen S9D report
- pasted-back S9A, S9B, and S9C implementation reports

Test against the accepted candidate execution surfaces from S9A, S9B, and S9C only.
Do not edit code unless the routed prompt is explicitly remediated later.

Run the frozen S9D commands unchanged first.
Then run the broader regression commands unchanged.

Evidence rules:
- record exact commands
- record execution surface
- record exit status
- cite raw report/log paths for each command
- preserve the host EPERM caveat verbatim if elevated rerun is required
- do not claim pass without artifact-level evidence

Classification rules:
- if the phase-local subset fails, mark Phase 12.5 blocked
- if the phase-local subset passes but broader regressions fail only on unrelated carry-forward surfaces, classify them explicitly as carry-forward and do not silently convert them into phase pass

Deliverable:
- test report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S10 Result
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

### S11 Reviewer Prompt

```text
You are Session S11, role `reviewer`, modal `reasoning`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- pasted-back S9A, S9B, and S9C implementation reports
- frozen S9D report

Review scope:
- findings first
- prioritize behavioral regressions, public workflow contract drift, unsafe seam coupling, missing tests, and docs-manager drift that escaped the allowed template asset scope

Required checks:
- gate lane did not reopen debug or plan-template seams
- debug lane did not reopen cook/review/test/finalize seams
- template lane did not silently modify README/docs/control docs
- template-selection wiring binds to real template assets, not speculative names
- chooser/approval/continuation paths remain end-to-end where touched

Deliverable:
- review report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S11 Result
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

### S12 Lead Verdict Prompt

```text
You are Session S12, role `lead verdict`, modal `reasoning`.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-05-phase-12-closeout-gates-and-template-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-05-planner-decomposition-report.md
- frozen S9D report
- S10 tester report with raw evidence refs
- S11 reviewer report
- S9A, S9B, and S9C implementation reports

Verdict rules:
- inspect tester evidence and raw references, not summaries only
- preserve the host EPERM caveat explicitly if accepted evidence depended on elevated rerun
- pass only if:
  - phase-local subsets for gate closeout, debug evidence, and template parity are green
  - reviewer has no unresolved blocker on the owned seams
  - broader regressions are either green or explicitly classified as carry-forward non-phase blockers with concrete evidence
- if merge/disposition is still pending, say so explicitly instead of calling the phase complete

Deliverable:
- lead verdict report under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/`

## Paste-Back Contract
When done, reply using exactly this template:

## S12 Result
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

## Unresolved Questions

- none
