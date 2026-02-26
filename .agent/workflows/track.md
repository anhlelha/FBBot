---
description: Track task progress in a persistent file. Ensures a docs/TASK-TRACKER.md file is always maintained with task statuses and results.
---

# Task Tracking Workflow

## Purpose

Maintain a persistent `docs/TASK-TRACKER.md` file in the project root that tracks all implementation tasks, their statuses, results, and timestamps. This file MUST be viewable by the user at any time to understand the current state of work.

## Rules (MANDATORY)

1. **ALWAYS update `docs/TASK-TRACKER.md`** after completing, starting, or failing any task.
2. **Never skip** updating the tracker — even for small tasks.
3. **Include results** — test results, error messages, file paths created/modified.
4. **Timestamp every update** using local date format `YYYY-MM-DD HH:mm`.
5. **The file must be self-contained** — anyone reading it should understand the full picture without needing to ask.

## File Format

```markdown
# 📋 Task Tracker — [Project Name]

> Last updated: YYYY-MM-DD HH:mm

## Status Legend
- ✅ Done — Task completed successfully
- 🔄 In Progress — Currently being worked on
- ⏳ Pending — Not yet started
- ❌ Failed — Attempted but failed (see notes)
- ⏸️ Blocked — Waiting on external input

---

## [Phase/Sprint Name]

### ✅ Task Name
- **Status:** Done
- **Completed:** YYYY-MM-DD HH:mm
- **Files:** `path/to/file1.js`, `path/to/file2.js`
- **Result:** [Concise description of what was done and outcome]
- **Test:** [Test results if applicable, e.g. "12/12 tests passed"]

### 🔄 Task Name
- **Status:** In Progress
- **Started:** YYYY-MM-DD HH:mm
- **Notes:** [What's being done, any blockers]

### ⏳ Task Name
- **Status:** Pending
- **Depends on:** [Dependencies if any]
```

## When to Update

| Event | Action |
|-------|--------|
| Starting a new task | Add entry with 🔄 status |
| Completing a task | Update to ✅ with results |
| Task fails | Update to ❌ with error details |
| Running tests | Add test results (pass/fail count) |
| Creating/modifying files | List all files changed |
| User asks for status | Ensure file is up-to-date |
| Before ending a session | Final sync of all statuses |

## Integration with Other Workflows

- **/plan**: When creating a plan, also create the initial TASK-TRACKER.md with all planned tasks as ⏳
- **/test**: After running tests, update the relevant task with test results
- **/status**: Read from TASK-TRACKER.md to report progress
- **/deploy**: Update tracker with deployment status

## Example Entry

```markdown
### ✅ Database Layer (Sprint 1)
- **Status:** Done
- **Completed:** 2026-02-25 21:15
- **Files:** `src/database.js`
- **Result:** Created SQLite database with 5 tables (tenants, tenant_fb_config, tenant_settings, documents, whitelist_emails). Auto-seeds owner email into whitelist.
- **Test:** 33/33 unit tests passed (tests/database.test.js)
```
