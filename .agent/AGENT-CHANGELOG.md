# Agent Changelog

> Lịch sử thay đổi tất cả Skills, Workflows, và cấu hình Agent.
> **Cập nhật tự động** mỗi khi có thay đổi trong `.agent/skills/` hoặc `.agent/workflows/`.

---

## Format

```
### [YYYY-MM-DD] — [Loại thay đổi]
- **File:** `đường/dẫn/file`
- **Loại:** `CREATE` | `MODIFY` | `DELETE`
- **Mô tả:** Mô tả ngắn gọn thay đổi là gì và tại sao
```

---

## 2026

### [2026-03-10] — MODIFY Workflow: Improved /ship robustness

- **File:** `.agent/workflows/ship.md`
- **Loại:** `MODIFY`
- **Mô tả:** Cập nhật workflow /ship để gộp các lệnh Git thành block lệnh duy nhất có thể thực thi (turbo), tránh việc Agent bỏ sót bước push/commit cục bộ trước khi deploy. Thêm bước verify trạng thái sau khi deploy.

---

### [2026-03-10] — MODIFY Script: Enhanced deploy-vm.sh safety

- **File:** `scripts/deploy-vm.sh`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm `set -e` để dừng script ngay khi có lỗi. Chuyển từ `git pull` sang `git fetch && git reset --hard` trên VM để xử lý các xung đột file log (`DEBUG.LOG`) và đảm bảo môi trường production luôn khớp 100% với nhánh main.

---

### [2026-03-10] — CREATE Skill: ship-feature

- **File:** `.agent/skills/ship-feature/SKILL.md`
- **Loại:** `CREATE`
- **Mô tả:** Tự động hóa quy trình đẩy code lên Git và deploy lên GCP VM sau khi hoàn thành tính năng.

---

### [2026-03-10] — CREATE Workflow: /ship

- **File:** `.agent/workflows/ship.md`
- **Loại:** `CREATE`
- **Mô tả:** Pipeline cho lệnh /ship: Document → Push → Deploy.

---

### [2026-02-25] — MODIFY Config: Added Task Tracking Rule to GEMINI.md

- **File:** `.agent/rules/GEMINI.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm rule 📊 Task Tracking vào TIER 0 (Universal Rules): Bắt buộc duy trì file `docs/TASK-TRACKER.md` với trạng thái, kết quả, và timestamp cho mọi task implementation.

---

### [2026-02-25] — CREATE Workflow: /track

- **File:** `.agent/workflows/track.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo workflow `/track` để chuẩn hóa quy trình theo dõi task. Định nghĩa format file TASK-TRACKER.md, rules bắt buộc (timestamp, results, file paths), điều kiện update, và integration với các workflow khác (/plan, /test, /status, /deploy).

---

### [2026-02-24] — MODIFY Skills & Workflows: Mandatory Physical Design Docs

- **File:** `.agent/skills/app-builder/feature-building.md`, `.agent/workflows/plan.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thắt chặt quy trình FDI. Bắt buộc Agent phải tạo file tài liệu thiết kế vật lý tại `docs/features/` trước khi yêu cầu duyệt (Design Gate). Việc tóm tắt qua chat không còn được coi là hoàn thành bước Design.

---

### [2026-02-24] — MODIFY Workflow: Integrated FDI Loop & Test Split in `plan.md`

- **File:** `.agent/workflows/plan.md`
- **Loại:** `MODIFY`
- **Mô tả:** Cập nhật workflow chính để bắt buộc chu trình Feature-Driven Implementation và phân định rõ AI test Logic/API, User test UI.

---

### [2026-02-24] — CREATE Skill: Feature-Driven Implementation Protocol

- **File:** `.agent/skills/app-builder/feature-building.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo mới bộ quy tắc 5 bước [Design -> Spec Gate -> Code -> Test -> Handover Gate] để áp dụng đồng nhất cho mọi feature.

---

### [2026-02-24] — MODIFY Skill: Added FDI Principles to `plan-writing`

- **File:** `.agent/skills/plan-writing/SKILL.md`
- **Loại:** `MODIFY`
- **Mô tả:** Bổ sung các nguyên tắc FEATURE-DRIVEN vào skill lập kế hoạch để đảm bảo Agent luôn chia nhỏ task và chờ duyệt thiết kế.

---

### [2026-02-24] — CREATE UI: High-fidelity Trading App Mockup

- **File:** `mockups/index.html`, `mockups/styles.css`
- **Loại:** `CREATE`
- **Mô tả:** Hoàn thành UI Mockup cho Trading Analysis App. Thiết kế theo phong cách "Dark Trading" chuyên nghiệp với accent xanh Teal. Hỗ trợ 4 màn hình: Workspace phân tích (multi-timeframe, provider selector), Dashboard thống kê, Lịch sử cuộc phân tích, và Cấu hình hệ thống (API keys, Playwright profiles).
- **Workflow:** Cập nhật `plan.md` bổ sung **UI Approval Gate** bắt buộc trước khi code logic.

---

### [2026-02-24] — MODIFY Config: Changelog Scope Protection

- **File:** `GEMINI.md` & `.agent/workflows/update-changelog.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thiết lập quy tắc "Project-Agnostic" nghiêm ngặt. Bổ sung bước "Path Validation" vào workflow và quy tắc loại trừ (SCOPE RULE) vào GEMINI.md. Changelog hiện chỉ track các thay đổi hệ thống Agent (.agent/**), không track output của dự án.

---

### [2026-02-24] — MODIFY Workflow: /plan

- **File:** `.agent/workflows/plan.md`
- **Loại:** `MODIFY`
- **Mô tả:** Bổ sung 4 phases rõ ràng vào workflow /plan: (0) Socratic Gate, (1) Task Breakdown, (2) **Architecture Document bắt buộc** (C4 + ADR + Security + Roadmap + Data Model + Tech Stack Summary), (3) Approval Gate — không được code khi chưa approved, (4) Implementation Plan. Thêm template ADR chi tiết, danh sách ADR bắt buộc, và format quadrant chart cho so sánh tech stack.

---

### [2026-02-24] — MODIFY Skill: frontend-design

- **File:** `.agent/skills/frontend-design/SKILL.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm `mockup-guide.md` vào bảng "Selective Reading Rule" với status 🔴 REQUIRED khi tạo mockup HTML. Thêm vào section Reference Files.

---

### [2026-02-24] — CREATE Skill file: mockup-guide.md

- **File:** `.agent/skills/frontend-design/mockup-guide.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo hướng dẫn tạo mockup HTML+CSS theo chuẩn dự án. Bao gồm: design tokens từ `ref/mockups/styles.css`, HTML skeleton với multi-page navigation, component patterns (sidebar, cards, stats, buttons, forms, tables), quy tắc SVG icon, CSS file structure, quality checklist, và anti-patterns.

---

### [2026-02-24] — CREATE Workflow: update-changelog

- **File:** `.agent/workflows/update-changelog.md`
- **Loại:** `CREATE`
- **Mô tả:** Tạo workflow `/log-change` để chuẩn hóa quy trình ghi changelog. Định nghĩa format entry, trigger conditions, và protocol tự động cập nhật.

---

### [2026-02-24] — CREATE File: AGENT-CHANGELOG.md

- **File:** `.agent/AGENT-CHANGELOG.md`
- **Loại:** `CREATE`
- **Mô tả:** Khởi tạo file changelog trung tâm để theo dõi mọi thay đổi liên quan đến skills, workflows, và cấu hình agent.

---

### [2026-02-24] — MODIFY GEMINI.md: Auto-changelog rule

- **File:** `GEMINI.md`
- **Loại:** `MODIFY`
- **Mô tả:** Thêm rule vào TIER 0 (Universal Rules): Bắt buộc tự động cập nhật `AGENT-CHANGELOG.md` mỗi khi có thay đổi trong `.agent/skills/` hoặc `.agent/workflows/` hoặc `GEMINI.md`.

---
