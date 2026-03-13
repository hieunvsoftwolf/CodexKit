# CodexKit Market Landscape

**Project**: CodexKit
**Last Updated**: 2026-03-11
**Purpose**: Determine whether a complete ClaudeKit-for-Codex product already exists

## Conclusion

No complete product was identified that provides ClaudeKit-grade workflow parity on Codex with:
- task graph and auto-claim
- event-driven worker wake/suspend
- team messaging and approvals
- worktree-isolated coding workers
- migration-ready reuse of ClaudeKit content

The current market offers partial solutions and building blocks, not a complete replacement.

## What Exists

### Official OpenAI Ecosystem

#### `openai/skills`

- Official skill catalog for Codex
- Strong for packaging and task-specific guidance
- Not a workflow orchestration runtime

#### Codex App and Codex Cloud

- Support multi-task execution and isolated environments
- Strong execution substrate
- Do not provide a drop-in ClaudeKit-style task/team/message runtime

#### Agents SDK

- Supports manager patterns, tools-as-agents, and handoffs
- Useful as infrastructure for orchestration
- Still requires a product-specific control plane for ClaudeKit parity

## Cross-Agent Skill and Plugin Ecosystem

### `n-skills`

- Marketplace for AI-agent skills across Claude Code, Codex, and others
- Good for discovery and distribution
- Not a complete runtime

### `openskills`

- Universal skills loader
- Useful for packaging and install workflows
- Not a team orchestration control plane

## Related Open Source Projects

### `Agor`

- Closest in spirit for worktrees, subsessions, and orchestration UX
- Useful reference for agent coordination patterns
- Not positioned as a ClaudeKit migration kit for Codex

### `agentapi`

- HTTP API layer for multiple coding agents including Codex
- Useful control-plane building block
- Not a full workflow parity product

### `coding-agent-template`

- Multi-agent coding platform with sandbox focus
- Helpful for runtime architecture ideas
- Not ClaudeKit-compatible out of the box

### `codex-subagents-mcp`

- Useful for subagent-style experimentation on Codex
- Too narrow to cover full ClaudeKit workflow parity

### `agentpipe`

- Shared-room multi-agent conversation orchestrator
- Useful reference for message routing
- Not a migration-grade coding workflow kit

### `OpenHands`

- Broad AI development platform
- Powerful, but larger and more general than the CodexKit target
- Does not solve ClaudeKit compatibility directly

### `MetaGPT`

- Broad software company simulation and multi-agent framework
- Good inspiration for role decomposition
- Too general and not Codex-focused for direct adoption

## Open Gap

The gap is not "multi-agent tooling exists." The gap is:

"A local Codex-first, terminal-first, migration-grade orchestration kit that preserves ClaudeKit workflow behavior and artifacts."

That gap still appears open.

## Build vs Adopt Assessment

### Full Adoption

Not recommended.

Reason:
- No identified product matches the target closely enough
- Existing tools would force workflow compromise or major re-modeling

### Partial Adoption

Recommended.

Adopt selectively:
- Codex runtime and MCP support
- optional Agents SDK patterns
- optional packaging ideas from skill ecosystems
- optional orchestration ideas from Agor and similar projects

### Build Decision

Recommended path:
- Build `CodexKit` as a dedicated product
- Reuse infrastructure patterns and packaging ideas
- Do not wait for a complete off-the-shelf replacement

## Signals from Codex Ecosystem

Current public signals suggest that native orchestration features close to the target are still emerging:
- Named multi-agent orchestration UX is still an active request
- Hierarchical delegation and per-agent tool controls are still active requests
- This suggests the target behavior is not yet a stable built-in feature set

## Strategic Positioning for CodexKit

CodexKit should position itself as:
- a ClaudeKit migration runtime
- a local-first orchestration kit
- a deterministic workflow engine for software delivery
- a compatibility layer over Codex, not a generic AI agent marketplace

## Unresolved Questions

- Whether to expose CodexKit as a standalone OSS product or keep it tightly tied to migration use cases first
- Whether to integrate with external marketplaces later or keep distribution self-contained in V1
