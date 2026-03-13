# OpenCode Port Reference From ClaudeKit Knowledge

**Purpose**: Document how a future OpenCode-focused project should reuse existing ClaudeKit source knowledge instead of rescanning the source tree from scratch  
**Status**: Reference only  
**Last Updated**: 2026-03-12

## 1) Positioning

This document is not part of the CodexKit execution plan.

Its purpose is to help a future OpenCode port project start from:

- captured ClaudeKit source knowledge
- existing `.opencode/` adapter material already present in this repo
- prior Codex-first scouting decisions about roles, workflows, artifacts, gates, and handoffs

## 2) Starting Inputs For The Future OpenCode Project

The future OpenCode project should start from:

- `knowledge/claudekit-source/*` when available
- `.claude/agents/*`
- `.claude/skills/*`
- `.claude/rules/*`
- `plans/templates/*`
- existing `.opencode/agents/*`
- existing `.opencode/skills/*`
- existing `.opencode/plugin/*`

The future project should treat `.opencode/` as an existing adapter baseline, not as the source of truth for ClaudeKit meaning.

## 3) Recommended Port Order

1. load ClaudeKit source knowledge
2. compare current `.opencode/` material against that source knowledge
3. classify gaps as:
- already mapped correctly
- mapped but drifted
- host-specific manual review
- not yet projected
4. generate or update OpenCode-native artifacts
5. validate the OpenCode command and skill experience end to end

## 4) What Should Be Reused From The ClaudeKit Knowledge Capture

At minimum, reuse:

- role definitions
- workflow intent
- artifact contracts
- gate semantics
- workflow handoff semantics
- host-specific runtime references that need replacement

This prevents the future OpenCode project from redoing basic source scouting.

## 5) What Must Still Be Decided In The OpenCode Project

Even with good source knowledge, the OpenCode project still needs its own decisions for:

- OpenCode-native agent layout
- OpenCode-native skill naming and discovery
- command surface and UX
- plugin and host configuration layout
- runtime semantics where OpenCode host behavior differs from ClaudeKit

These are implementation decisions for the OpenCode project, not for CodexKit.

## 6) Success Definition

This reference is useful only if a future OpenCode project can:

- start from captured ClaudeKit knowledge
- avoid a full raw-source rescout
- review only host-specific drift and remaining compatibility gaps

## Unresolved Questions

- Which exact OpenCode file layout will be canonical when the future port begins
- Whether current `.opencode/plugin/` layout should be normalized before or during that future project
- Which parts of current `.opencode/` content are generated, curated, or partially drifted
