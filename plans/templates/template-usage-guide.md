---
title: "Plan Template Usage Guide"
template_id: "template.template_usage_guide"
---

# Template Usage Guide

## Goal
Keep plan generation consistent by selecting the correct template for task intent, then preserve generic fallback behavior when no template match is clear.

## Template Selection Rules
- Select **Feature Implementation Template** when task intent is new capability delivery.
- Select **Bug Fix Template** when task intent is defect/regression correction.
- Select **Refactor Template** when task intent is maintainability/structure improvement without intended behavior change.
- Use generic plan bundle when task text does not clearly match a template lane.
- Template assets: `feature-implementation-template.md`, `bug-fix-template.md`, `refactor-template.md`

## Selection Signals
Use these signals as the default matcher set:

- Feature: `feature`, `implement`, `implementation`, `add`, `build`, `create`, `new capability`, `new workflow`
- Bug fix: `bug`, `fix`, `hotfix`, `regression`, `defect`, `incident`, `issue`, `error`, `failure`
- Refactor: `refactor`, `cleanup`, `restructure`, `reorganize`, `tech debt`, `technical debt`, `maintainability`

## Adaptation Rules
- Keep headings and filenames stable across template files and selection wiring.
- Keep checklist items concrete and verifiable.
- Do not silently widen scope into `README.md` or `docs/**` updates from template selection work.

## Context Compression
- Reference existing docs/phase specs instead of duplicating long context blocks.
- Keep plan artifacts concise and evidence-oriented.

## Maintenance Notes
- If template headings or signals change, update selection wiring in the same lane.
- Preserve current generic fallback behavior for non-template tasks.
