# Bao Cao Technical Audit: ClaudeKit va kha nang dung truc tiep trong Codex

## Tom tat dieu hanh

ClaudeKit trong workspace nay khong phai mot "bo prompt" doc lap, ma la mot bo cau hinh runtime gan chat voi host runtime cua Claude Code, dong thoi co them adapter rieng cho OpenCode. Trong trang thai da cai o thu muc hien tai, quan sat duoc `.claude/` va `.opencode/`, nhung khong co `.codex/` hay bat ky Codex runtime adapter nao. Vi vay, blocker khong nam o thieu vai file cau hinh, ma nam o cho ClaudeKit dua vao cac co che host-specific ma Codex khong tieu thu truc tiep.

## Pham vi va phuong phap

- Audit ca ban source goc tai [`claudekit-engineer-main`](./claudekit-engineer-main/README.md) va ban da materialize o root workspace hien tai tai [`.claude/settings.json`](./.claude/settings.json).
- Uu tien bang chung theo thu tu: code/runtime artifact > generated artifact > docs.
- Khong sua source, khong port, khong prototype.

## Phan 1: Structure Overview

- Installed artifact o root hien tai gom `.claude/`, `.opencode/`, `AGENTS.md`, `CLAUDE.md`, `plans/templates`, `release-manifest.json`. Root hien tai khong co `README.md`, khong co `docs/`, khong co `.codex/`, khong co `.claude-plugin/`.
- Source goc co `.claude/`, `docs/`, `plans/`, `scripts/`, `package.json`, `portable-manifest.json`, va README huong dan setup Claude Code tai [`README.md`](./claudekit-engineer-main/README.md#quick-start).
- Runtime Claude nam trong [`.claude/settings.json`](./.claude/settings.json) va [`.claude/.ck.json`](./.claude/.ck.json).
- Content layer chinh nam trong [`.claude/agents/`](./.claude/agents/) va [`.claude/skills/`](./.claude/skills/README.md).
- Hook/runtime glue nam trong [`.claude/hooks/`](./.claude/hooks/) va [`.claude/hooks/lib/`](./.claude/hooks/lib/).
- Commands active da bi deprecate; code noi ro dieu nay trong [`scan_commands.py`](./claudekit-engineer-main/.claude/scripts/scan_commands.py) va catalog hien tai rong trong [`commands_data.yaml`](./claudekit-engineer-main/.claude/scripts/commands_data.yaml). Thu con lai chu yeu la archive.
- Khong tim thay `.claude-plugin/` active trong source hay artifact cai dat. Noi dung ve plugin marketplace chi la tai lieu tham chieu, vi du [`plugin-marketplace-overview.md`](./claudekit-engineer-main/.claude/skills/skill-creator/references/plugin-marketplace-overview.md).

## Phan 2: ClaudeKit la gi o muc kien truc

- ClaudeKit la mot host-runtime augmentation kit. No mo rong Claude Code bang hook, statusline, agents, skills, session state, task orchestration, team orchestration, va MCP/Gemini bridge.
- Skills/instructions content: markdown trong [`.claude/skills/`](./.claude/skills/README.md) va agents trong [`.claude/agents/`](./.claude/agents/planner.md).
- Plugin/runtime integration: voi Claude Code la [`.claude/settings.json`](./.claude/settings.json); voi OpenCode la `.opencode/plugin/*.ts`, vi du [`context-injector.ts`](./.opencode/plugin/context-injector.ts).
- Commands: hien tai khong con la runtime layer chinh; UX command da bi hut vao skills/help docs.
- Agents/subagents: frontmatter agent khai bao tools va memory truc tiep, vi du [`planner.md`](./.claude/agents/planner.md) va [`code-reviewer.md`](./.claude/agents/code-reviewer.md).
- Hooks: `SessionStart`, `SubagentStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse` duoc dang ky tai [`.claude/settings.json`](./.claude/settings.json).
- MCP/config/settings: config mau o [`.claude/.mcp.json.example`](./claudekit-engineer-main/.claude/.mcp.json.example), nhung skill MCP thuc te di qua Gemini CLI trong [`ck:use-mcp`](./claudekit-engineer-main/.claude/skills/use-mcp/SKILL.md) va [`GEMINI.md`](./claudekit-engineer-main/GEMINI.md).
- Init/install/bootstrap flow: source README noi dung `claudekit-cli` de `ck new` / `ck init` roi chay `claude` tai [`README.md`](./claudekit-engineer-main/README.md#quick-start). Ban cai thuc te trong workspace cho thay output cua buoc materialize chu khong chua source cua `claudekit-cli`.

## Phan 3: Installed Implementation quan sat duoc tai root workspace

- Ban da cai khong phai copy nguyen xi tu source template. So voi source goc, root artifact co sua [`.claude/settings.json`](./.claude/settings.json) de doi command path sang `"$CLAUDE_PROJECT_DIR"/.claude/...`.
- Root artifact them metadata cai dat vao [`.claude/.ck.json`](./.claude/.ck.json) duoi `kits.ClaudeKit Engineer.installedSettings`, liet ke cac hook commands da install.
- Root artifact co registry/checksum/version/install time cho tung file trong [`.claude/metadata.json`](./.claude/metadata.json), nghia la buoc cai dat co state tracking, khong chi copy file.
- Root artifact da generate san OpenCode adapter: [`.opencode/package.json`](./.opencode/package.json) va plugins nhu [`context-injector.ts`](./.opencode/plugin/context-injector.ts), [`privacy-block.ts`](./.opencode/plugin/privacy-block.ts) va [`scout-block.ts`](./.opencode/plugin/scout-block.ts).
- Installed layout nay khop manh voi release builder trong [`prepare-release-assets.cjs`](./claudekit-engineer-main/scripts/prepare-release-assets.cjs) va release manifest generator trong [`generate-release-manifest.cjs`](./claudekit-engineer-main/scripts/generate-release-manifest.cjs).
- Suy ra ky thuat: buoc cai dat da materialize mot release artifact gan voi output cua `prepare-release-assets`, sau do post-process mot so file Claude-specific nhu `settings.json` va `.ck.json`.

## Phan 4: Runtime Model trong moi truong goc

- Claude path: nguoi dung chay `claude`; Claude Code nap [`.claude/settings.json`](./.claude/settings.json); cac event goi hook scripts nhu [`session-init.cjs`](./.claude/hooks/session-init.cjs) va [`subagent-init.cjs`](./.claude/hooks/subagent-init.cjs).
- Cac hook nay khong chi chay shell. Chung doc payload JSON tu stdin, phu thuoc vao env va contract rieng cua Claude nhu `CLAUDE_ENV_FILE`, `session_id`, `agent_type`, `hookSpecificOutput.additionalContext`, va ghi `CLAUDE_CODE_TASK_LIST_ID` vao session env tai [`session-init.cjs`](./.claude/hooks/session-init.cjs).
- Agents va skills assume runtime co cac tool dac thu. Vi du [`planner.md`](./.claude/agents/planner.md) yeu cau `TaskCreate`, `TaskList`, `SendMessage`, `Task(Explore)`, `Task(researcher)`.
- Workflow loi cung assume Claude-native tools. [`ck:plan`](./.claude/skills/plan/SKILL.md) dung `AskUserQuestion`, `Skill(...)`, `TaskCreate`; [`ck:team`](./.claude/skills/team/SKILL.md) bat buoc `TeamCreate`, `Task`, `SendMessage`, `TeamDelete`; [`workflow-steps.md`](./.claude/skills/cook/references/workflow-steps.md) bat buoc `tester`, `code-reviewer`, `project-manager`, `git-manager` subagents.
- OpenCode path co adapter rieng. Source co generator [`generate-opencode.py`](./claudekit-engineer-main/scripts/generate-opencode.py) de convert agents/skills/scripts va generate plugins gia lap hook behavior.
- Khong co Codex path tuong duong. Trong source, thu duy nhat nhac Codex la [`portable-manifest.json`](./claudekit-engineer-main/portable-manifest.json), va no chi map `AGENTS.md` sang `.codex/agents/`.

## Phan 5: Findings quan trong nhat

### F1. ClaudeKit khong phai standalone CLI runtime

Source package khong co `bin`, con `main` tro toi `index.js` nhung file do khong ton tai trong source tai [`package.json`](./claudekit-engineer-main/package.json).

### F2. Hook contract phu thuoc chat vao Claude Code runtime

Bang chung chinh la [`.claude/settings.json`](./.claude/settings.json), [`session-init.cjs`](./.claude/hooks/session-init.cjs) va [`subagent-init.cjs`](./.claude/hooks/subagent-init.cjs).

### F3. Core workflows hard-code Claude-specific tools

Bang chung: [`planner.md`](./.claude/agents/planner.md), [`team/SKILL.md`](./.claude/skills/team/SKILL.md), [`plan/SKILL.md`](./.claude/skills/plan/SKILL.md), [`cook/workflow-steps.md`](./.claude/skills/cook/references/workflow-steps.md).

### F4. OpenCode can adapter rieng; Codex khong co adapter do

Bang chung: source generator [`generate-opencode.py`](./claudekit-engineer-main/scripts/generate-opencode.py) va installed plugins tai [`.opencode/plugin/context-injector.ts`](./.opencode/plugin/context-injector.ts).

### F5. Instruction content va runtime integration bi tron manh

`SKILL.md` khong chi chua huong dan nghiep vu ma con encode truc tiep host tool names, slash command semantics, session state scripts, approval flow, va team/task protocol.

### F6. MCP layer khong portable

Source noi cau hinh MCP o [`.mcp.json.example`](./claudekit-engineer-main/.claude/.mcp.json.example) nhung thuc thi lai duoc day qua Gemini CLI o [`ck:use-mcp`](./claudekit-engineer-main/.claude/skills/use-mcp/SKILL.md) va [`GEMINI.md`](./claudekit-engineer-main/GEMINI.md).

### F7. Docs va code co mau thuan

Docs van mo ta command parser/slash-command nhu active o [`system-architecture.md`](./claudekit-engineer-main/docs/system-architecture.md), nhung code da deprecate commands. Docs team cung noi co TaskCompleted/TeammateIdle integration o [`agent-teams-guide.md`](./claudekit-engineer-main/docs/agent-teams-guide.md), nhung current `settings.json` khong wire hai event do.

### F8. Installed artifact khong hoan toan self-consistent

[`AGENTS.md`](./AGENTS.md) va [`CLAUDE.md`](./CLAUDE.md) yeu cau doc `./README.md`, dong thoi gia dinh co `./docs`, nhung hai path do khong hien dien o root artifact hien tai.

## Phan 6: Root Cause Summary

- ClaudeKit khong dung truc tiep cho Codex vi thu duoc cai khong phai "content thuan", ma la mot runtime bundle gan voi co che host cua Claude Code.
- Codex khong doc [`.claude/settings.json`](./.claude/settings.json) nhu Claude Code, khong co hook events `SessionStart/SubagentStart/...`, khong co contract `hookSpecificOutput.additionalContext`, khong co `CLAUDE_ENV_FILE`, khong co Claude Tasks/Teams/SendMessage/AskUserQuestion theo dung semantics ma ClaudeKit dang assume.
- OpenCode cung khong dung truc tiep `.claude/*`; no can mot adapter/generator rieng. Viec source phai co [`generate-opencode.py`](./claudekit-engineer-main/scripts/generate-opencode.py) la bang chung thuc nghiem rang khac biet host runtime la khac biet lon, khong phai cosmetic.
- Voi Codex, source khong cung cap adapter tuong tu. [`portable-manifest.json`](./claudekit-engineer-main/portable-manifest.json) chi lo migration `AGENTS.md -> .codex/agents/`, khong cover hooks, skills runtime, statusline, tasks, teams, MCP bridge, hay session state.
- Ket luan coupling: `high` o runtime/orchestration, `medium-high` o workflows/skills, `low-medium` o docs/references va mot so pure-logic libs.

## Phan 7: Phan loai reusability so bo

- `Likely reusable content`: phan lon reference markdown trong `.claude/skills/*/references`, nhieu agent/skill instruction text, plan templates trong `plans/templates`, va mot so shared logic nhu [`privacy-checker.cjs`](./.claude/hooks/lib/privacy-checker.cjs).
- `Claude-specific runtime pieces`: [`.claude/settings.json`](./.claude/settings.json), cac hook wrappers trong [`.claude/hooks/`](./.claude/hooks/), statusline tai [`.claude/statusline.cjs`](./.claude/statusline.cjs), task/team orchestration, AskUserQuestion flow trong [`CLAUDE.md`](./CLAUDE.md), session-state scripts nhu [`set-active-plan.cjs`](./.claude/scripts/set-active-plan.cjs).
- `OpenCode-specific adapter pieces`: `.opencode/plugin/*`, `.opencode/package.json`, generated `AGENTS.md`.
- `Unknown / can kiem tra them`: source noi bo cua `claudekit-cli` khong co trong workspace hien tai, nen logic installer code-level chua duoc doc truc tiep. Tuy vay, installed output va release artifact da du de ket luan ve tinh khong tuong thich voi Codex.

## Ket luan cuoi cung

ClaudeKit hien co trong workspace nay la mot bo runtime integration cho Claude Code, co them adapter rieng cho OpenCode, nhung khong co lop runtime tuong ung cho Codex. Vi vay, no khong the "init" hay chay nguyen xi trong Codex khong phai vi thieu vai file map duong dan, ma vi thieu toan bo host execution model ma ClaudeKit dang phu thuoc.

## Unresolved Questions

- Chua doc source cua `claudekit-cli`, nen phan "installer internal code path" van la suy luan tu artifact cai dat va release scripts.
- Neu can buoc tiep theo, phan nen audit tiep khong phai template goc nua, ma la chinh global/source cua `claudekit-cli` de khop hoan toan giua "installer logic" va "installed artifact".
