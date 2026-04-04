---
title: "Bug Fix Template"
template_id: "template.bug_fix"
task_match: "bug,fix,hotfix,regression,defect,incident,issue,error,failure"
---

# Bug Fix Template

## Purpose
Use this when the primary outcome is correcting incorrect behavior, regressions, runtime failures, or contract violations.

## Symptom And Scope
- Describe expected behavior vs actual behavior
- Record impact, severity, and affected surfaces
- Link issue evidence, logs, or failing tests

## Reproduction
- Capture the exact command, fixture, or operator flow that reproduces the bug
- Record the expected failing evidence before implementation changes

## Phase 1: Triage and Root Cause
- [ ] Reproduce symptom and capture failing evidence [critical]
- [ ] Isolate root cause and affected code path
- [ ] Define fix scope and regression boundaries

## Phase 2: Fix Implementation
- [ ] Implement minimal safe fix in owned files [critical]
- [ ] Add or update guard coverage for the root cause
- [ ] Verify no unintended side effects on adjacent flows

## Phase 3: Verification and Rollback Readiness
- [ ] Run targeted verification for reproduced symptom
- [ ] Record rollback or mitigation path if regression reappears
- [ ] Publish implementation summary with unresolved risks

## Verification Focus
- Prioritize reproduction test first, then phase-local regressions
- Keep evidence explicit: command, output status, and artifact paths

## Checklist Discipline
- Avoid broad refactors unless required to resolve root cause safely
- Separate confirmed fix work from speculative cleanup
