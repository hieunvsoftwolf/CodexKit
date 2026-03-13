# Phase 5-9 Guide

**Purpose**: Detailed prompts for workflow parity, finalize, packaging, and release-hardening phases

Control-agent note:
- when emitting any prompt from this file, add an explicit `Skills:` line
- if no curated skill is needed, emit `Skills: none required`
- also emit session card metadata: role expected, optional modal hint, suggested model, fallback model, run mode, depends on, and paste-back instructions
- for meaningful code phases, add a `spec-test-design` session in parallel with implementation after pinning a reproducible `BASE_SHA`
- if a downstream session still depends on a missing upstream artifact, mark it waiting and do not emit a runnable prompt block for it yet
- also tell the user which exact prompt block to paste into the fresh session
- also make the prompt end with the exact result template to paste back
- spec-test-design prompts must use phase docs + exit criteria + pinned `BASE_SHA` as the source of truth and must not inspect candidate implementation artifacts

## Phase 5: Workflow Parity Core

Recommended workers:
- `1` `planner`
- `1` `researcher`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`

Split suggestion:
- dev A: `cdx brainstorm` + `cdx plan`
- dev B: `cdx cook` + task hydration bootstrap

Lead prompt:

```text
Current phase: Phase 5 Workflow Parity Core.
Read first:
- docs/workflow-parity-core-spec.md
- docs/project-roadmap.md

Need parity for:
- cdx brainstorm
- cdx plan
- cdx cook through post-implementation gate

Use planner, researcher, 2 devs, spec-test-designer, tester, reviewer.
Respect checkpoint ids, artifacts, and approval gates exactly.
```

Researcher prompt:

```text
Research current ClaudeKit source behavior for brainstorm/plan/cook and summarize only the parts Phase 5 must preserve.
Output:
- workflow steps
- gates
- artifacts
- handoff semantics
No code changes.
```

Dev prompt A:

```text
Implement Phase 5 support for:
- cdx brainstorm
- cdx plan
- plan artifacts and hydration bootstrap

Requirements:
- valid plan.md frontmatter
- phase files
- checkpoint audit trail
- no code implementation inside brainstorm/plan
```

Dev prompt B:

```text
Implement Phase 5 support for:
- cdx cook mode detection
- research/planning reuse rules
- implementation orchestration through post-implementation gate
- task reuse before re-hydration

Do not claim later-phase finalize parity.
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 5 Workflow Parity Core.
Skills: none required.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/workflow-parity-core-spec.md
- Phase 5 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for brainstorm, plan, cook handoff, hydration authority, and gate semantics
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, expected artifacts, gate checks, and blockers
```

Tester prompt:

```text
Validate Phase 5:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- brainstorm writes durable decision report
- plan writes valid plan.md and phase files
- hydration does not duplicate live tasks
- cook interactive and auto modes obey gate semantics through post-implementation
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 5 changes.
Focus:
- checkpoint completeness
- artifact contracts
- handoff rules
- hydration authority order
- no false claims about later-phase parity
```

E2E prompt:

```text
Run Phase 5 end-to-end validation.
Need evidence for:
- brainstorm -> plan handoff
- plan -> cook handoff
- cook completes implementation stage with correct gates
- artifacts exist for each required checkpoint
```

## Phase 6: Workflow Parity Extended

Recommended workers:
- `1` `planner`
- `1` `debugger`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`

Split suggestion:
- dev A: `cdx review` + `cdx test`
- dev B: `cdx fix` + `cdx debug` + `cdx team`

Lead prompt:

```text
Current phase: Phase 6 Workflow Parity Extended.
Read first:
- docs/workflow-extended-and-release-spec.md

Need parity for:
- cdx review
- cdx test
- cdx fix
- cdx debug
- cdx team

Use planner, debugger, 2 devs, spec-test-designer, tester, reviewer.
Testing and review steps must remain delegated.
```

Debugger prompt:

```text
Act as debugger for Phase 6 design and implementation.
Focus:
- debug route semantics
- investigation task graph
- logs-ci/database/performance/frontend branch expectations
- fix route escalation

Output:
- implementation risk list
- verification cases spec-test-designer and tester must cover
```

Dev prompt A:

```text
Implement Phase 6 workflows:
- cdx review
- cdx test

Need:
- findings-first review output
- delegated QA report output
- retry-after-fix loops
- stable checkpoint ids and artifacts
```

Dev prompt B:

```text
Implement Phase 6 workflows:
- cdx fix
- cdx debug
- cdx team

Need:
- route locking
- root-cause-first debugging
- team bootstrap/monitor/shutdown
- no silent fallback to sequential mode for team
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 6 Workflow Parity Extended.
Skills: none required. Use $security-best-practices if verification design touches approvals, daemon state, or cross-worker trust boundaries.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/workflow-extended-and-release-spec.md
- Phase 6 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for review, test, fix, debug, and team flows
- define verification order for delegated loops and retry-after-fix behavior
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, expected artifacts, degraded-mode expectations, and blockers
```

Tester prompt:

```text
Validate Phase 6:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- review emits severity-ordered findings
- test produces structured QA report
- debug produces durable root-cause report
- fix enforces diagnose before patch
- team mode supports messaging, auto-claim, idle/wake, shutdown
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 6 changes.
Focus:
- delegated workflow integrity
- root cause before fix
- review findings-only discipline
- team runtime correctness
- verify evidence freshness before success claims
```

E2E prompt:

```text
Run Phase 6 end-to-end validation.
Need evidence for:
- standalone review/test/debug/fix flows
- team research/review/debug/cook template behavior
- retry loops and verification gates behave correctly
```

## Phase 7: Plan Sync, Docs, And Finalize

Recommended workers:
- `1` `planner`
- `1` `fullstack-developer`
- `1` `docs-manager`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`
- optional `1` `git-manager`

Lead prompt:

```text
Current phase: Phase 7 Plan Sync, Docs, and Finalize.
Need:
- full sync-back engine
- docs impact evaluator
- finalize flow with git handoff

Use planner, dev, docs-manager, spec-test-designer, tester, reviewer.
Add git-manager only if commit/push flow is explicitly part of the phase task.
```

Dev prompt:

```text
Implement Phase 7 finalize behavior.
Need:
- sync completed runtime tasks back into plan markdown
- plan status/progress reconciliation
- finalize hooks for docs and git handoff
- no blind overwrite of user-owned plan content
```

Docs-manager prompt:

```text
Implement or validate docs impact behavior for finalize flows.
Need:
- docs impact evaluation artifact
- sync with changed commands/workflows
- no fabricated code references
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 7 Plan Sync, Docs, and Finalize.
Skills: none required.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/workflow-extended-and-release-spec.md
- Phase 7 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for sync-back, docs impact, finalize hooks, and user-controlled git handoff
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, expected markdown changes, and blockers
```

Tester prompt:

```text
Validate Phase 7:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- completed tasks sync back correctly
- plan.md status updates correctly
- docs impact artifacts are emitted
- finalize flow generates git handoff prompts without auto-commit
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 7 changes.
Focus:
- sync-back safety
- markdown reconciliation correctness
- docs/update consistency
- finalize contract boundaries
```

E2E prompt:

```text
Run Phase 7 end-to-end validation.
Need evidence for:
- runtime task completion syncs into plan files
- docs impact evaluation produced
- finalize produces user-controlled git action prompt
```

## Phase 8: Packaging And Migration UX

Recommended workers:
- `1` `planner`
- `1` `researcher`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`
- optional `1` `docs-manager`

Split suggestion:
- dev A: `cdx init` + `cdx update`
- dev B: `cdx doctor` + `cdx resume` + migration assistant

Lead prompt:

```text
Current phase: Phase 8 Packaging and Migration UX.
Need:
- cdx init
- cdx doctor
- cdx resume
- cdx update
- migration assistant

Use planner, researcher, 2 devs, spec-test-designer, tester, reviewer.
Non-destructive behavior is mandatory.
```

Researcher prompt:

```text
Research migration edge cases for existing ClaudeKit-style repos.
Focus:
- install-safe behavior
- owned vs generated files
- dependency/tool detection
- resume/recovery expectations
Output only migration-risk notes.
```

Dev prompt A:

```text
Implement Phase 8 packaging flows for:
- cdx init
- cdx update

Need:
- detect repo type
- preview before apply when needed
- non-destructive writes
- generated .codexkit and .codex content placement
```

Dev prompt B:

```text
Implement Phase 8 packaging flows for:
- cdx doctor
- cdx resume
- migration assistant report

Need:
- dependency/state scan
- resume selection and recovery path
- migration readiness verdict
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 8 Packaging and Migration UX.
Skills: none required.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/workflow-extended-and-release-spec.md
- Phase 8 exit criteria
- docs/non-functional-requirements.md
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for init, doctor, resume, update, migration assistant, degraded modes, and non-destructive behavior
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, fixtures, expected diagnostics, and blockers
```

Tester prompt:

```text
Validate Phase 8:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- new repo install works
- existing ClaudeKit-style repo install is non-destructive
- doctor detects missing dependencies and invalid state
- resume recovers interrupted work safely
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 8 changes.
Focus:
- migration safety
- non-destructive defaults
- preview/apply split
- clear user-facing diagnostics
```

E2E prompt:

```text
Run Phase 8 end-to-end validation.
Need evidence for:
- fresh repo init
- existing repo migration install
- doctor output
- resume and update flows
- migration assistant report quality
```

## Phase 9: Hardening And Parity Validation

Recommended workers:
- `1` `planner`
- `1` `debugger`
- `1` `tester`
- `1` `code-reviewer`
- `1` `project-manager`

Lead prompt:

```text
Current phase: Phase 9 Hardening and Parity Validation.
Need:
- golden parity tests
- chaos tests
- migration validation checklist
- release readiness report

Use planner, debugger, tester, reviewer, project-manager.
No feature expansion unless a blocker requires it.
```

Debugger prompt:

```text
Design and validate failure scenarios for Phase 9:
- worker crash
- lease expiry
- resume after interruption
- reclaim behavior
- approval interruption

Output only failure-model and validation notes first.
```

Tester prompt:

```text
Validate Phase 9:
- golden parity tests for core workflows
- chaos tests for worker failure and reclaim
- migration validation checklist completion
- release readiness evidence bundle
```

Verify prompt:

```text
Review Phase 9 outputs.
Focus:
- no critical migration blockers remain
- parity claims backed by evidence
- test evidence is fresh
- release readiness report is honest about gaps
```

E2E prompt:

```text
Run final V1 end-to-end validation across milestone-critical workflows.
Need evidence for:
- plan and cook usable in migrated repo
- worker isolation stable
- approvals and messaging work
- delegated testing/review/docs/finalize work
- sync-back and resume across interruption
```
