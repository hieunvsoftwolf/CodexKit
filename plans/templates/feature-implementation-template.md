---
title: "Feature Implementation Template"
template_id: "template.feature_implementation"
task_match: "feature,implement,implementation,add,build,create,new capability,new workflow"
---

# Feature Implementation Template

## Purpose
Use this when the task introduces new user-facing behavior, operator workflow, or API/runtime capability.

## Context Links
- Active phase doc and acceptance criteria
- Current control-state report
- Existing contracts, fixtures, and runtime checkpoints

## Deliverable
- Describe the user-visible or operator-visible capability being added
- Record intended artifacts, handoff output, and acceptance evidence

## Phase 1: Discovery
- [ ] Collect baseline context for touched workflow(s) [critical]
- [ ] Confirm scope boundaries, constraints, and non-goals
- [ ] Define acceptance criteria and evidence shape

## Phase 2: Implementation
- [ ] Implement the feature changes in owned files [critical]
- [ ] Preserve backward-compatible behavior for unaffected flows
- [ ] Add or update implementation-adjacent coverage in owned scope
- [ ] Capture integration and risk notes for verification handoff

## Phase 3: Verification
- [ ] Run phase-local compile/typecheck/test commands
- [ ] Prepare implementation summary with changed files and commands
- [ ] List unresolved questions and follow-up lanes

## Testing Strategy
- Prefer narrow, deterministic verification first
- Escalate to broader runtime regression only when phase-local checks pass
- Record exact command + surface + result for each verification step

## Todo Checklist Notes
- Keep checklist items concrete and evidence-oriented
- Mark only completed items as checked
