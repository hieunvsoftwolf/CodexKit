# Phase 4 Wave 1 B0 Spec-Test-Design

**Date**: 2026-03-22
**Status**: completed
**Role/Modal Used**: spec-test-designer / Default role contract
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `734a3a6c5feb97619b50a90be7d0d06d0aebee24`

## Provenance

- source of truth used:
  - `README.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-4-wave-1-ready-after-freeze.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-4-base-freeze-report.md`
  - `docs/claudekit-importer-and-manifest-spec.md`
  - `docs/project-roadmap.md`
  - `docs/system-architecture.md`
  - `docs/project-overview-pdr.md`
  - `docs/non-functional-requirements.md`
  - `docs/verification-policy.md`
  - `docs/compatibility-matrix.md`
- pinned repo state inspected:
  - `git rev-parse HEAD` -> `734a3a6c5feb97619b50a90be7d0d06d0aebee24`
  - current tree inventory at that SHA:
    - agents: `15`
    - skills: `68`
    - rules: `5`
    - templates: `0`
    - archived command files: `19`
- excluded by design:
  - candidate implementation branches
  - implementation summaries
  - reviewer output
  - diffs or summaries from any candidate branch

## Summary

- froze Phase 4 Wave 1 acceptance around agents, skills, and rules only; template import remains deferred until a future re-freeze restores `plans/templates/`
- mapped expectations to Phase 4 acceptance criteria plus the Phase 4-owned preservation constraints for `NFR-1`, `NFR-4`, and `NFR-6`
- defined the tester command order, fixture set, and expected outputs for discovery, parse, rewrite, validate, emit, registry, and migration-safety behavior
- added no verification-owned tests because the pinned base has no importer production modules, no importer CLI surface, no importer-specific fixtures, and no stable test seam under `packages/` or `tests/`
- ran the current baseline harness on the pinned tree to capture the pre-Phase-4 floor:
  - `npm run test:unit` -> pass (`1` file, `4` tests)
  - `npm run test:integration` -> pass (`2` files, `6` tests)
  - `npm run test:runtime` -> pass (`9` files, `49` tests)

## Phase 4 Exit-Criteria Mapping

| Exit criterion | Frozen verification target |
|---|---|
| all core roles import into valid role manifests | all `15` `.claude/agents/*.md` files import to `.codexkit/manifests/roles/*.role.json`; role ids, overrides, statuses, and raw body snapshots are preserved; `code-simplifier` is `deferred`; `mcp-manager` is `manual-review` |
| all core workflows in the override table import into valid workflow manifests | the `12` parity-critical skills map to the exact `cdx` commands and ids from the override table; remaining skill entrypoints import as `helper` or `reference` workflows with `command: null` |
| all 5 rule files import into policy manifests | exactly `5` `.claude/rules/*.md` files import to `.codexkit/manifests/policies/*.policy.json` with preserved markdown and extracted directives |
| archived commands are skipped and audited, not auto-promoted | all `19` files under `.claude/command-archive/**` are registry-audited as skipped legacy content; none win id resolution against active skills |
| settings/hooks/statusline content is skipped and audited, not misrepresented as executable manifests | `.claude/settings.json`, `.claude/hooks/**`, and `.claude/statusline.*` do not produce role/workflow/policy manifests; skip reasons appear in the registry or warnings |
| known Claude-native references are rewritten into compatibility primitives | manifests that contain `AskUserQuestion`, `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `Task(...)`, `TeamCreate`, `TeamDelete`, or `SendMessage` expose the mapped CodexKit compat names in normalized fields and retain original source text in `raw` |
| registry output is deterministic and complete | `.codexkit/manifests/import-registry.json` records source metadata, imported entries, skipped legacy and unsupported lists, conflicts, warnings, checksums, and stable summary counts for the frozen Wave 1 surface |

## NFR Mapping

| NFR | Phase 4 verification expectation |
|---|---|
| `NFR-1` Deterministic Continuity | rerunning the importer on the same frozen source tree and same override tables must yield byte-stable manifests and registry summary counts; no output may depend on transcript state or nondeterministic scan order |
| `NFR-4` Real-Repo Robustness and Migration Safety | importer stays non-destructive, writes only under `.codexkit/`, previews or diagnostics must make blocked writes explicit, unsupported source content must fail or degrade before partial final files remain |
| `NFR-6` Context Fidelity and Handoff Quality | imported manifests preserve both `raw` and `normalized` views, provenance, aliases, warnings, resource indexes, and compat rewrites so later workflow compilation does not require the source transcript or guesswork |

## Frozen Scope Boundaries

- import only:
  - `.claude/agents/*.md`
  - `.claude/skills/*/SKILL.md`
  - `.claude/rules/*.md`
- read-only provenance inputs:
  - `.claude/.ck.json`
  - `.claude/metadata.json`
- skip and audit:
  - `.claude/settings.json`
  - `.claude/hooks/**`
  - `.claude/statusline.*`
  - `.claude/output-styles/**`
  - `.claude/schemas/**`
  - `.claude/scripts/**` unless directly referenced as workflow resources
  - `.claude/command-archive/**`
- deferred:
  - `plans/templates/**` because the directory is absent in the frozen baseline

## Stable Baseline Commands

These commands are safe on the pinned base and provide the tester's pre-candidate baseline:

1. `git rev-parse HEAD`
2. `git status --short`
3. `find .claude/agents -maxdepth 1 -type f -name '*.md' | wc -l`
4. `find .claude/skills -type f -name 'SKILL.md' | wc -l`
5. `find .claude/rules -maxdepth 1 -type f -name '*.md' | wc -l`
6. `if [ -d plans/templates ]; then find plans/templates -type f | wc -l; else echo 0; fi`
7. `find .claude/command-archive -type f | wc -l`
8. `npm run test:unit`
9. `npm run test:integration`
10. `npm run test:runtime`

Expected baseline result:

- `HEAD` resolves to `734a3a6c5feb97619b50a90be7d0d06d0aebee24`
- baseline inventory is `15 / 68 / 5 / 0 / 19`
- no importer-specific tests exist yet at `BASE_SHA`
- existing unit, integration, and runtime suites pass unchanged

## Candidate Verification Command Plan

Run in this order once Session A produces a candidate tree:

1. repeat the baseline inventory commands to confirm the candidate still uses the frozen source surface
2. run the importer in preview or dry-run mode if the implementation exposes one
3. run the importer for real against the frozen workspace
4. inspect `.codexkit/manifests/roles/*.role.json`
5. inspect `.codexkit/manifests/workflows/*.workflow.json`
6. inspect `.codexkit/manifests/policies/*.policy.json`
7. inspect `.codexkit/manifests/import-registry.json`
8. rerun the importer without changing sources and compare outputs for byte stability
9. rerun the relevant automated test slice added by Session A
10. rerun `npm run test:unit`, `npm run test:integration`, and any importer-specific runtime or integration suite if Session A adds one

Expected candidate-level output:

- `.codexkit/manifests/roles/` contains `15` role manifests
- `.codexkit/manifests/workflows/` contains `68` workflow manifests
- `.codexkit/manifests/policies/` contains `5` policy manifests
- no template manifests exist in Wave 1
- registry summary reflects:
  - `roles: 15`
  - `policies: 5`
  - `legacySkipped: 19`
  - workflow totals that sum to `68`, with `12` core workflows from the override table and the remainder classified as helper or reference
- all final writes stay under `.codexkit/`
- `.claude/**` file content and tracked source checksums remain unchanged

## Fixture Plan

### F1. Frozen inventory fixture

Use the real repo tree at `BASE_SHA`.

Purpose:

- discovery counts
- path whitelisting
- template deferral
- command-archive skip accounting

Expect:

- importer discovers only active agents, skills, and rules as import candidates
- importer records `.claude/.ck.json` and `.claude/metadata.json` as provenance only
- importer does not create manifests for settings, hooks, statusline, output styles, schemas, or archived commands

### F2. Core role fixture

Use these real role sources:

- `.claude/agents/planner.md`
- `.claude/agents/researcher.md`
- `.claude/agents/fullstack-developer.md`
- `.claude/agents/code-reviewer.md`
- `.claude/agents/tester.md`
- `.claude/agents/code-simplifier.md`
- `.claude/agents/mcp-manager.md`

Purpose:

- frontmatter parse
- id and slug derivation
- default-access overrides
- status overrides
- compat tool-capability derivation

Expect:

- `planner` gets `defaultAccess: "plans-write"`
- `researcher` and `code-reviewer` import as read-only roles
- `fullstack-developer` and `tester` import as `owned-scope`
- `code-simplifier` imports with `status: "deferred"`
- `mcp-manager` imports with `status: "manual-review"`
- original tools and body text remain in `raw`
- normalized compat capabilities include `task.*`, `message.send`, and `worker.spawn` where source text/tool lists imply them

### F3. Core workflow override fixture

Use these real skills:

- `.claude/skills/brainstorm/SKILL.md`
- `.claude/skills/plan/SKILL.md`
- `.claude/skills/cook/SKILL.md`
- `.claude/skills/fix/SKILL.md`
- `.claude/skills/debug/SKILL.md`
- `.claude/skills/code-review/SKILL.md`
- `.claude/skills/test/SKILL.md`
- `.claude/skills/team/SKILL.md`
- `.claude/skills/docs/SKILL.md`
- `.claude/skills/journal/SKILL.md`
- `.claude/skills/preview/SKILL.md`
- `.claude/skills/scout/SKILL.md`

Purpose:

- parity-critical id override table
- `cdx` command mapping
- mode and subcommand extraction
- resource indexing

Expect:

- exactly these `12` skills become the `brainstorm`, `plan`, `cook`, `fix`, `debug`, `review`, `test`, `team`, `docs`, `journal`, `preview`, and `scout` workflows
- each gets the exact target `cdx` command from the spec
- source `ck:*` names stay in `aliases`
- workflow resources under `references/**`, `workflows/**`, or `scripts/**` are indexed, not blindly inlined

### F4. Helper and reference workflow fixture

Use representative helper skills:

- `.claude/skills/agent-browser/SKILL.md`
- `.claude/skills/research/SKILL.md`
- `.claude/skills/worktree/SKILL.md`
- `.claude/skills/document-skills/pdf/SKILL.md`

Purpose:

- non-core workflow classification
- helper/reference status handling
- companion-resource indexing

Expect:

- these import as workflow manifests with `command: null`
- workflow class is `helper` or `reference`, not `core`
- unresolved binary or large-asset dependencies do not corrupt the whole batch; the workflow downgrades to `manual-review` if required by the spec

### F5. Rewrite coverage fixture

Use real source files with host-specific tokens:

- `.claude/skills/brainstorm/SKILL.md` for `AskUserQuestion`
- `.claude/skills/cook/SKILL.md` and `.claude/skills/cook/references/workflow-steps.md` for `Task(...)`, `TaskCreate`, `TaskUpdate`, and `TaskList`
- `.claude/agents/planner.md` and `.claude/agents/project-manager.md` for `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskList`, and `SendMessage`
- `.claude/rules/team-coordination-rules.md` for `SendMessage` and task references

Purpose:

- Claude-native rewrite map
- raw-versus-normalized preservation
- warning behavior for unresolved tools

Expect:

- `AskUserQuestion` maps to `approval.request`
- `TaskCreate` maps to `task.create`
- `TaskList` maps to `task.list`
- `TaskGet` maps to `task.get`
- `TaskUpdate` maps to `task.update`
- `Task(...)` maps to `worker.spawn`
- `SendMessage` maps to `message.send`
- original Claude-native tokens remain visible in `raw`
- unresolved host tools are warned, not silently dropped

### F6. Policy import fixture

Use all `5` rule files under `.claude/rules/`.

Purpose:

- policy id derivation
- applicability mapping
- directive extraction

Expect:

- `development-rules` applies to `all`
- `primary-workflow` applies to implementation-oriented workflows
- `orchestration-protocol` applies to orchestrated flows
- `documentation-management` applies to docs-related flows
- `team-coordination-rules` applies only to team workflow and team-mode roles

### F7. Registry and safety fixture

Use the full repo tree plus `.claude/.ck.json` and `.claude/metadata.json`.

Purpose:

- import-registry completeness
- provenance checksums
- skipped-content audit
- deterministic rerun
- write-boundary safety

Expect:

- registry records source metadata, imported entries, skipped legacy items, skipped unsupported items, conflicts, warnings, and per-source checksums
- final output appears only under `.codexkit/manifests/`
- if validation fails for a core artifact, no partial final files remain in the target tree
- second run on unchanged sources is byte-identical

### F8. Negative fixture set

Create temporary verification-owned synthetic inputs only in the tester session if Session A provides a stable importer seam that accepts an alternate source root.

Purpose:

- malformed frontmatter quarantine
- duplicate-id conflict handling
- path-escape rejection
- partial-batch failure containment

Expect:

- malformed role or skill frontmatter quarantines the source and records a warning; importer does not guess
- duplicate core ids fail validation explicitly
- target path escapes are blocked before write
- failed batch leaves no partial final manifests in place

## Deterministic Output Expectations

- manifest directories and filenames are canonical:
  - `.codexkit/manifests/roles/{role-id}.role.json`
  - `.codexkit/manifests/workflows/{workflow-id}.workflow.json`
  - `.codexkit/manifests/policies/{policy-id}.policy.json`
- every manifest includes:
  - `schemaVersion`
  - `manifestType`
  - `id`
  - `slug`
  - `aliases`
  - `status`
  - `source`
  - `raw`
  - `normalized`
  - `resources`
  - `warnings`
- all output ordering must be stable across reruns:
  - directory enumeration
  - registry entry order
  - warning order
  - summary counts

## Source-Workspace Safety Expectations

- importer never edits, renames, or deletes `.claude/**`
- importer never writes outside `.codexkit/`
- importer never auto-creates template manifests in Wave 1
- existing manifests must not be overwritten silently; conflicts must be explicit
- archived commands must not win duplicate resolution over active skills

## Verification-Owned Test Decision

No verification-owned tests were added in this B0 session.

Reason:

- pinned `BASE_SHA` contains no importer production package, CLI command, parser, manifest validator, or emit path
- `tests/fixtures/README.md` still marks fixture space as reserved for future executable runtime fixtures
- existing `tests/unit`, `tests/integration`, and `tests/runtime` suites cover source-graph and runtime behavior only; none expose a stable importer harness seam
- adding tests now would require inventing pre-implementation module names, CLI flags, fixture contracts, or temp-root behavior, which would bias Session A instead of verifying it

Reserved verification scope once Session A exposes stable seams:

- `tests/integration/phase-4-importer-*.test.ts` for discovery, registry, and deterministic rerun cases
- `tests/unit/phase-4-manifest-normalization-*.test.ts` for canonicalization and rewrite mapping
- `tests/fixtures/phase-4-importer/` for synthetic malformed or duplicate-source fixtures

## Handoff Notes For Tester And Reviewer

- execute this frozen expectation set before reading any implementation rationale
- verify candidate identity still descends from `734a3a6c5feb97619b50a90be7d0d06d0aebee24`
- treat any attempt to import templates in Wave 1 as out of scope unless Phase 4 is formally re-frozen
- if Session A adds importer-specific automated tests, run them unchanged first; add only verification-owned tests for doc-derived gaps or harness gaps

## Unresolved Questions

- none
