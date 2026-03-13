# ClaudeKit Source Wave 1 Review Checklist

Use this after automated validation passes. Reviewer should check every item manually.

## 1. Structure Integrity

- [ ] `graph-manifest.json` points to the correct JSONL and schema files
- [ ] `nodes.jsonl` has no duplicate ids
- [ ] `edges.jsonl` has no duplicate ids
- [ ] `evidence.jsonl` has no duplicate ids
- [ ] every node and edge references existing evidence
- [ ] every evidence subject points to an existing node or edge

## 2. Evidence Quality

- [ ] every evidence row has exact `sha256:<digest>` checksum
- [ ] every evidence row has real `lineStart` and `lineEnd`
- [ ] no placeholder checksum remains
- [ ] no `1-999` placeholder span remains
- [ ] source path exists and matches the intended claim
- [ ] evidence notes explain any inference or uncertainty

## 3. Scope Purity

- [ ] records capture ClaudeKit source meaning only
- [ ] no CodexKit runtime design leaked into graph facts
- [ ] no OpenCode implementation choice leaked into graph facts
- [ ] ids stay host-neutral
- [ ] `maps_to` style host projection is not introduced in Wave 1

## 4. Core Coverage

- [ ] all 9 core agents exist
- [ ] all 8 core workflows exist
- [ ] all 4 core rules exist
- [ ] runtime rewrite refs exist for `AskUserQuestion`, `Task*`, `Team*`, `SendMessage`, hook-injected context
- [ ] artifact contracts exist for decision, plan, phase, review, debug, docs impact, git handoff

## 5. Workflow Correctness

- [ ] brainstorm hands off to plan
- [ ] plan hands off to cook
- [ ] debug hands off to fix
- [ ] review hands off to fix
- [ ] finalize semantics lead to git handoff artifact
- [ ] plan produces both `plan.md` and `phase-*`
- [ ] debug and review produce their report artifacts

## 6. Rule And Tool Semantics

- [ ] workflow/rule/tool edges match ClaudeKit source wording
- [ ] `AskUserQuestion` usage is attached only where source supports it
- [ ] `Task*` usage is attached only where source supports it
- [ ] `Team*` usage is attached only where source supports it
- [ ] `SendMessage` usage is attached only where source supports it
- [ ] hook-injected context is linked from files that actually mention it

## 7. Ambiguity Audit

- [ ] any inferred artifact either has strong source support or is marked `manual-review`
- [ ] any vague handoff is backed by at least one strong source anchor
- [ ] weak or disputed meaning was deferred instead of guessed
- [ ] note wording distinguishes explicit fact vs inference

## 8. Future Update Readiness

- [ ] ids are stable enough to survive future ClaudeKit updates
- [ ] future source deltas can be added without renaming large parts of the graph
- [ ] update order remains `nodes -> evidence -> edges`
- [ ] graph remains suitable as source-of-truth input for future import/init into a real graph system

## Verdict

- [ ] PASS
- [ ] FAIL

## Review Notes

- Reviewer:
- Date:
- Batch:
- Blocking issues:
- Follow-up actions:
