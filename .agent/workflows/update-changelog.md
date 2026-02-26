---
description: Log a change to AGENT-CHANGELOG.md. Use after modifying any skill, workflow, or agent config file.
---

# /log-change — Update Agent Changelog

> **Trigger:** Automatically runs after ANY modification to:
> - `.agent/skills/**`
> - `.agent/workflows/**`
> - `GEMINI.md`
> - `.agent/*.md` (agent config files)

---

## Automatic Trigger Protocol

This workflow runs **automatically** (no user prompt needed) whenever the agent:
1. Creates, modifies, or deletes a file in `.agent/skills/`
2. Creates, modifies, or deletes a file in `.agent/workflows/`
3. Modifies `GEMINI.md`
4. Modifies any root-level `.agent/*.md` config file

---

## Steps

1. Identify the type of change being made:
   - `CREATE` — new file or new section added
   - `MODIFY` — existing file edited
   - `DELETE` — file or section removed

2. Determine the changed file path (relative from project root).

3. **Path Validation (CRITICAL):** 
   - Check: Is the changed file inside `.agent/`?
   - If **YES** → Continue.
   - If **NO** (e.g., `docs/`, `src/`, `README.md`) → **STOP**. Do NOT log project-specific output.

4. Write a concise description answering:
   - **What** was changed (Skill logic, Workflow steps, System rule)?
   - **Why** was it changed (Generic improvement for future use)?

4. Append a new entry to `.agent/AGENT-CHANGELOG.md` using this exact format:

```markdown
### [YYYY-MM-DD] — [TYPE] [Category]: [short title]

- **File:** `relative/path/to/file`
- **Loại:** `CREATE` | `MODIFY` | `DELETE`
- **Mô tả:** [Vietnamese or English description matching the user's language]
```

   - Date: use current local date (`YYYY-MM-DD`)
   - Category: `Skill` | `Workflow` | `Config` | `GEMINI`
   - Insert **above** all previous entries in the `## [YEAR]` section (newest first)
   - If the year section doesn't exist, create it

5. If multiple files were changed in one user request, group them with a single date header if they are part of the same task, or write separate entries if they are distinct changes.

---

## Entry Examples

### New skill file created:
```markdown
### [2026-03-01] — CREATE Skill: api-patterns

- **File:** `.agent/skills/api-patterns/SKILL.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo skill hướng dẫn thiết kế API, bao gồm REST vs GraphQL vs tRPC, response format, versioning, và pagination patterns.
```

### Existing skill modified:
```markdown
### [2026-03-01] — MODIFY Skill: frontend-design

- **File:** `.agent/skills/frontend-design/SKILL.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm section về dark mode patterns. Cập nhật bảng Selective Reading Rule để phản ánh file mới.
```

### Workflow added:
```markdown
### [2026-03-01] — CREATE Workflow: /deploy

- **File:** `.agent/workflows/deploy.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo workflow deployment với pre-flight checks, rollback strategy, và verification steps.
```

### GEMINI.md updated:
```markdown
### [2026-03-01] — MODIFY Config: GEMINI.md

- **File:** `GEMINI.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm rule auto-changelog vào TIER 0. Cập nhật bảng Project Type Routing.
```

---

## Rules

- **Never skip** this workflow, even for "small" changes to skill files
- **Always use local date** from system time (not UTC)
- **Write in user's language** (Vietnamese if user writes in Vietnamese)
- The changelog is **append-only** — never delete existing entries
- Entries are **newest first** within each year section
