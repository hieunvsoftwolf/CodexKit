# Prompt Cookbook

**Project**: CodexKit
**Last Updated**: 2026-03-12
**Purpose**: Copy-paste prompts for the 5 installed Codex skills used in CodexKit migration and delivery workflows

## 1. Quick Rules

- Name the skill explicitly in the prompt when you want deterministic behavior.
- State scope clearly: repo, package, path, subsystem, or PR number.
- State the output you want: report, checklist, plan, findings, or code changes.
- State constraints clearly: read-only, wait for approval, no code edits, or only official docs.
- For GitHub skills, authenticate first with `gh auth login`.
- For `openai-docs`, let Codex use the OpenAI docs MCP if available.

Prompt skeleton:

```text
Dùng skill <skill-name> để <goal>.
Scope: <repo/path/package/pr>.
Output: <artifact/result>.
Constraint: <rules>.
```

## 2. Skill Map

| Skill | Dùng khi nào | Agents nên dùng | Ghi chú |
|---|---|---|---|
| `openai-docs` | Xác minh capability thật của Codex, MCP, OpenAI APIs, model choice, host constraints | `researcher`, `planner`, `mcp-manager`, `docs-manager` | Chỉ nên tin docs chính thức OpenAI |
| `gh-fix-ci` | PR có check đỏ trên GitHub Actions, cần lấy logs và lập fix plan | `debugger`, `tester`, `fullstack-developer` | Chờ approval trước khi sửa |
| `gh-address-comments` | PR đã có review comments/threads cần xử lý có chọn lọc | `code-reviewer`, `fullstack-developer`, `git-manager` | Nên gom thread trước, sửa sau |
| `security-best-practices` | Review secure-by-default cho code TypeScript/Node/Go/Python hoặc chuẩn bị implement feature nhạy cảm | `fullstack-developer`, `code-reviewer`, `debugger`, `docs-manager` | Chỉ dùng khi trọng tâm là security |
| `security-threat-model` | Threat model cho toàn repo hay subsystem trước khi chốt kiến trúc/release | `planner`, `researcher`, `code-reviewer`, `docs-manager` | Tốt nhất dùng sớm cho daemon, worker, approvals, MCP |

## 3. Agent Routing

- `planner`: dùng `openai-docs`, `security-threat-model`
- `researcher`: dùng `openai-docs`, `security-threat-model`
- `fullstack-developer`: dùng `security-best-practices`, `gh-fix-ci`, `gh-address-comments`
- `debugger`: dùng `gh-fix-ci`, `security-best-practices`
- `tester`: dùng `gh-fix-ci`
- `code-reviewer`: dùng `gh-address-comments`, `security-best-practices`
- `docs-manager`: dùng `openai-docs`, `security-threat-model`
- `mcp-manager`: dùng `openai-docs`
- `git-manager`: chỉ vào sau cùng nếu cần commit/push sau khi review comments đã được xử lý

## 4. Prompt Cookbook

### 4.1 `openai-docs`

1. Kiểm tra capability thật của Codex cho migration

```text
Dùng skill openai-docs để tra docs chính thức mới nhất của Codex về skills, MCP, approvals, tool calling, và workspace/file ownership. Đối chiếu với thiết kế CodexKit trong docs của repo này.
Output:
1. những gì Codex hỗ trợ native
2. những gì CodexKit phải tự xây
3. mismatch/rủi ro migration
4. link docs chính thức cho từng kết luận
Constraint: chỉ dùng nguồn OpenAI.
```

2. Kiểm tra thiết kế `cdx init` / `cdx update` / `cdx doctor`

```text
Dùng skill openai-docs để nghiên cứu docs chính thức liên quan tới Codex skills, MCP server setup, config, và local workflow integration. Sau đó review thiết kế Phase 8 của CodexKit và chỉ ra:
- phần nào bám đúng host model của Codex
- phần nào đang giả định sai hoặc thiếu
- đề xuất chỉnh spec ngắn gọn, thực dụng
Output: review markdown ngắn có citations rõ.
```

3. Chọn model/API nếu CodexKit cần tích hợp OpenAI runtime

```text
Dùng skill openai-docs để tra docs chính thức về model selection và API surface phù hợp cho một CLI orchestration tool như CodexKit. Tôi cần:
- model/API nào hợp cho research, planning, code review, debugging
- tradeoff cost/latency/reasoning
- khuyến nghị tối thiểu cho V1
Constraint: chỉ trả lời từ docs OpenAI và dẫn link.
```

### 4.2 `security-threat-model`

4. Threat model toàn repo CodexKit

```text
Dùng skill security-threat-model để threat model toàn bộ repo CodexKit.
Focus:
- codexkit-daemon
- worker spawn/worktree isolation
- approvals
- mailbox/message bus
- importer
- MCP compatibility surface
- .codexkit state
Output: report markdown ngắn, grounded vào repo, nêu trust boundaries, assets, attacker goals, abuse paths, mitigations, và unresolved assumptions.
```

5. Threat model một subsystem

```text
Dùng skill security-threat-model để threat model riêng phần <path>.
Scope: chỉ thư mục này và các entrypoint liên quan.
Output:
- assets
- entry points
- trust boundaries
- 5 threat đáng lo nhất
- mitigation cụ thể theo code path
Constraint: nếu thiếu context vận hành thì hỏi tối đa 3 câu trước khi chốt report.
```

### 4.3 `security-best-practices`

6. Security review cho daemon + DB

```text
Dùng skill security-best-practices review secure-by-default cho packages/codexkit-daemon và packages/codexkit-db.
Project: Node.js/TypeScript + SQLite.
Tập trung vào:
- input validation
- command execution safety
- path traversal / owned-path enforcement
- secrets handling
- SQLite migration safety
- error leakage
Output: report ưu tiên theo severity, có file/line references nếu có finding.
```

7. Security review cho CLI commands

```text
Dùng skill security-best-practices review phần CLI command surface của CodexKit.
Tìm các rủi ro như:
- unsafe defaults
- destructive operations không có approval
- config parsing lỗi
- shell injection
- path confusion
- privilege boundary mơ hồ
Constraint: chỉ nêu findings thực sự đáng sửa, không review lan man.
```

8. Secure-by-default trước khi implement feature mới

```text
Tôi sắp implement feature <feature>.
Dùng skill security-best-practices trước khi code để tạo secure-by-default checklist cho repo này.
Output:
- checklist cụ thể cho TypeScript/Node monorepo hiện tại
- package/file nào cần chú ý
- test/security checks cần có trước merge
```

### 4.4 `gh-fix-ci`

9. Điều tra CI đỏ trên PR hiện tại

```text
Dùng skill gh-fix-ci để kiểm tra PR hiện tại của branch này.
Việc cần làm:
- xác định failing GitHub Actions checks
- lấy log snippet lỗi quan trọng
- tóm tắt root cause khả dĩ
- đề xuất fix plan ngắn
Constraint: chờ tôi approve plan rồi mới sửa code.
```

10. Điều tra một PR cụ thể

```text
Dùng skill gh-fix-ci cho PR <pr-number>.
Output theo format:
- failing check
- workflow/run URL
- log snippet
- nguyên nhân gần nhất
- mức độ chắc chắn
- fix plan
Constraint: không sửa gì trước khi tôi duyệt.
```

### 4.5 `gh-address-comments`

11. Gom toàn bộ review comments để chọn thread

```text
Dùng skill gh-address-comments lấy tất cả review comments và review threads trên PR hiện tại.
Hãy:
- đánh số từng thread
- tóm tắt yêu cầu sửa
- chỉ ra file bị ảnh hưởng
- ước lượng độ lớn thay đổi
Sau đó dừng lại và hỏi tôi muốn xử lý những thread số nào.
```

12. Sửa các thread đã chọn

```text
Dùng skill gh-address-comments để xử lý các thread số <1,3,4> trên PR hiện tại.
Trước khi sửa, tóm tắt ngắn từng thay đổi sẽ làm.
Sau khi sửa xong:
- liệt kê file đã đổi
- nêu test/check đã chạy
- cho tôi draft reply ngắn cho từng thread
```

## 5. End-to-End Workflows

13. Một vòng migration an toàn cho subsystem

```text
Cho subsystem <path>, hãy làm theo thứ tự:
1. dùng openai-docs để kiểm tra assumption về Codex/OpenAI capability liên quan
2. dùng security-threat-model để lập threat model ngắn
3. dùng security-best-practices để tạo implementation checklist
Output cuối:
- migration risks
- security risks
- implementation checklist
- test/review gates nên có trước merge
```

14. Trước khi mở PR

```text
Review readiness cho <path> theo workflow CodexKit:
- dùng security-best-practices để tìm security issues lớn
- nếu có PR comments thì dùng gh-address-comments để gom thread
- nếu CI đang đỏ thì dùng gh-fix-ci để điều tra
Output: checklist merge-ready ngắn với blocker và non-blocker.
```

15. Sprint prompt cho một phase

```text
Tôi đang làm Phase <N> của CodexKit.
Hãy chọn đúng skill trong 5 skill đã cài để hỗ trợ phase này theo thứ tự hợp lý.
Mục tiêu là hoàn thành phase với ít assumption sai nhất.
Trước hết hãy nói:
- skill nào sẽ dùng
- vì sao
- output artifact nào sẽ tạo
Rồi mới bắt đầu.
```

## 6. Short Commands

- `Dùng skill openai-docs để verify assumption này với docs OpenAI: <assumption>`
- `Dùng skill security-threat-model cho <path> và viết report ngắn`
- `Dùng skill security-best-practices review <path> theo secure-by-default`
- `Dùng skill gh-fix-ci kiểm tra PR hiện tại và chờ approval`
- `Dùng skill gh-address-comments gom review threads trên PR hiện tại`

## 7. Notes

- Với task OpenAI/Codex có từ "latest", "current", "official", luôn ưu tiên `openai-docs`.
- Với daemon, runner, approvals, worktree isolation, importer, MCP, luôn cân nhắc `security-threat-model` trước khi code lớn.
- Với code review thường, không tự động dùng `security-best-practices` nếu user không muốn security-focused review.
- Với GitHub review loop, thứ tự thường là `gh-fix-ci` trước, `gh-address-comments` sau.
