---
title: "Refactor Template"
template_id: "template.refactor"
task_match: "refactor,cleanup,restructure,reorganize,tech debt,technical debt,maintainability"
---

# Refactor Template

## Purpose
Use this when improving structure, readability, maintainability, or modularity without changing intended external behavior.

## Current State Analysis
- Identify hotspots: duplication, coupling, ambiguous ownership, or brittle flow
- Define preserved behavior contracts and compatibility constraints
- Describe measurable success signals (complexity, clarity, testability)

## Safety Checks
- Record the invariants that must remain unchanged through the refactor
- Define the narrow regression checks needed before broad verification

## Phase 1: Refactor Design
- [ ] Baseline current behavior and invariants [critical]
- [ ] Define incremental refactor steps with clear ownership
- [ ] Confirm compatibility and rollback expectations

## Phase 2: Refactor Implementation
- [ ] Apply structural changes while preserving behavior [critical]
- [ ] Remove duplication and simplify control flow
- [ ] Update adjacent internal interfaces only where necessary

## Phase 3: Validation and Stabilization
- [ ] Run compile/typecheck and focused regression verification
- [ ] Confirm parity against preserved behavior contracts
- [ ] Publish summary with residual risks and follow-up debt

## Backward-Compatibility Guardrails
- No intentional external contract change in this template lane
- If contract change is discovered, reclassify to feature lane

## Success Metrics
- Reduced complexity in changed scope
- No behavior regressions in covered workflows
- Clear ownership and easier future modification
