---
description: Create project plan using project-planner agent. No code writing - only plan file generation. Includes mandatory C4 Architecture Document and ADR analysis before proceeding.
---

# /plan - Project Planning Mode

$ARGUMENTS

---

## 🔴 CRITICAL RULES

1. **NO CODE WRITING** - This command creates planning documents only
2. **Use project-planner agent** - NOT Antigravity Agent's native Plan mode
3. **Socratic Gate FIRST** - Ask clarifying questions before ANY planning
4. **Architecture Document MANDATORY** - C4 + ADR must be created and approved before implementation
5. **Gate: No implementation without Architecture Approval**

---

## Execution Phases

### Phase 0 — Socratic Gate (MANDATORY FIRST)

Before any document is created:

1. Analyze the request domain(s): Frontend? Backend? Infra? LLM? Database?
2. Ask **minimum 3 strategic questions** to clarify:
   - **Deployment target** (local / cloud / mobile)
   - **Scale** (personal tool / team / public SaaS)
   - **Constraints** (existing tech stack, timeline, budget)
   - **Integration points** (external APIs, auth, existing systems)
3. **WAIT** for user answers before proceeding to Phase 1

---

### Phase 1 — Create Task Breakdown

After Socratic Gate is cleared:

- Create `docs/PLAN-{task-slug}.md` with:
  ```
  - Feature list (prioritized)
  - Phase breakdown (MVP → Beta → Production)
  - Task checklist per phase
  - Agent/skill assignments per task
  ```
- **Naming rules:**
  1. Extract 2-3 key words from request
  2. Lowercase, hyphen-separated, max 30 chars
  3. Example: `trading-analysis-app`

---

### Phase 2 — Architecture Document (MANDATORY)

> 🔴 **GATE: Implementation cannot start until this document is APPROVED by user.**

Create `docs/architecture.md` following the **C4 Model** (Simon Brown):

#### Level 1 — System Context
```
- WHO uses the system (Person elements)
- WHAT external systems does it interact with
- HOW they communicate (protocols, direction)
- Mermaid: C4Context diagram
- Table: explain each element
```

#### Level 2 — Container Diagram
```
- Major deployable units (Web App, API, Database, Background jobs)
- Technology for each container
- Communication between containers
- Mermaid: C4Container diagram
- Table: explain each container (tech, location, role)
```

#### Level 3 — Component Diagrams
```
- Internal components of each significant container
- One diagram per complex container (UI, API Server, etc.)
- Mermaid: C4Component diagram per container
```

#### Security Analysis
```
- Data flow diagram for sensitive data (credentials, tokens, PII)
- Risk table: Risk | Level | Mitigation
- Mermaid: flowchart showing what leaves the machine vs stays local
```

#### Roadmap (if applicable)
```
- MVP → Beta → Production phases
- What changes between phases (infra, capture method, auth, scale)
- Mermaid: flowchart LR showing phase transitions
```

#### Data Model
```
- Mermaid: erDiagram for all entities
- Field-level descriptions for non-obvious fields
```

#### Deployment View
```
- ASCII or Mermaid diagram of how processes run
- Port numbers, process relationships
```

#### ADR — Architecture Decision Records

For **every significant tech choice**, document an ADR:

```markdown
### ADR-XX: [Option A] vs [Option B] vs [Option C]

| Criteria | Option A ✅ | Option B | Option C |
|----------|:-----------:|:--------:|:--------:|
| [criterion] | ✅/❌/⚠️ | ... | ... |

**Why NOT [Option B]:** ...
**Why NOT [Option C]:** ...
**Decision:** ✅ [Option A] — [1-sentence rationale]
```

**Mandatory ADRs to cover (if applicable):**

| ADR | Topic |
|-----|-------|
| ADR-01 | Frontend framework (Next.js vs Vite vs Remix vs...) |
| ADR-02 | Database (SQLite vs PostgreSQL vs MongoDB vs...) |
| ADR-03 | Authentication strategy (if needed) |
| ADR-04 | State management (if frontend-heavy) |
| ADR-05 | Deployment target (Vercel vs VPS vs Fly.io vs local) |
| ADR-06 | Key library/tool choices specific to the project |

**Quadrant chart for key decisions:**
```mermaid
quadrantChart
    title [Decision Title] — Effort vs Fit
    ...
```

#### Tech Stack Summary Table

Always end with:
```
┌─────────────────┬─────────────────────────┐
│ Layer           │ Technology              │
├─────────────────┼─────────────────────────┤
│ Frontend        │ ...                     │
│ Backend         │ ...                     │
│ Database        │ ...                     │
│ ...             │ ...                     │
└─────────────────┴─────────────────────────┘
```

---

### Phase 3 — Request Architecture Approval

After creating `docs/architecture.md`:

```
Present to user:
"Tôi đã tạo tài liệu kiến trúc tại docs/architecture.md.
Vui lòng review và approve trước khi tôi bắt đầu implementation.

Các quyết định quan trọng cần review:
- [List top 3-5 key decisions from ADRs]
- [Any warnings or trade-offs]"
```

> 🔴 **HARD GATE 1:** Do NOT proceed until user explicitly approves architecture.

---

### Phase 3b — UI Mockup (MANDATORY & SEPARATE PAGES)

> 🔴 **RULE: ALWAYS create high-fidelity UI mockup BEFORE writing implementation code. ALWAYS split into separate .html files to simulate real routing/navigation experience.**

After architecture is approved, build the UI design system and pages in the `mockups/` directory:
- **Separate Files:** `index.html` (Analyze), `dashboard.html`, `history.html`, `settings.html`, v.v.
- **Consistent Layout:** Every page must include the same sidebar and header structure.
- **Real Navigation:** Sidebar links must use actual file paths (e.g., `<a href="dashboard.html">`).
- **Data Fidelity:** No "lorem ipsum". Use realistic trading data, charts, and AI analysis text.

**Present mockup to user:**
"Tôi đã hoàn thành bộ UI Mockup tại thư mục `mockups/`.
Vui lòng mở từng file để review trải nghiệm điều hướng và giao diện:
- `mockups/index.html` (Analyze)
- `mockups/dashboard.html`
- ...

Sau khi bạn approve bộ UI này, tôi mới được phép chuyển sang Phase 4 để chuẩn bị code."

> 🔴 **HARD GATE 2:** Do NOT write implementation code until user explicitly approves the UI mockup structure and design.

---

### Phase 4 — Implementation Plan (After UI Approval)

Only after architecture is approved:

- Create or update `implementation_plan.md` in brain artifacts
- Reference the approved architecture decisions
- Break down into sprint-sized tasks with dependencies

---

### Phase 5 — Feature-Driven Implementation Loop

> 🔴 **RULE: DO NOT write production code for a whole Phase at once. Split into granular Features.**
> 🔴 **RULE: Every Feature must follow the [DESIGN → DOC → CODE → TEST → APPROVE] cycle.**

For each Feature/Component:

1.  **Technical Design (Micro-ADR)**: 
    - Xác định API contracts, Props, State management.
    - **MANDATORY**: Tạo file thiết kế chi tiết tại `docs/features/f{xx}-{name}.md`.
    - Cập nhật vào `docs/architecture.md` (nếu có thay đổi cấu trúc thành phần).
2.  **User Gate (Design)**: Trình bày thiết kế kỹ thuật chi tiết cho Feature này. Chờ user "OK".
3.  **Implement & Test**:
    - Build Feature.
    - **AI Responsibility:** Viết Unit/Integration Tests cho Logic, API, Database, và Background jobs.
    - **User Responsibility:** Trực tiếp Test Giao diện (UI/UX), Layout và trải nghiệm người dùng cuối.
4.  **Verification**: Chạy `checklist.py` hoặc test runner để verify phần logic kỹ thuật.
5.  **User Gate (Ready)**: Trình bày Feature đã hoàn thành để user duyệt phần UI/UX.

---

## Expected Deliverables

| Deliverable | Location | When |
|-------------|----------|------|
| Task Breakdown | `docs/PLAN-{slug}.md` | Phase 1 |
| **Architecture Doc (C4 + ADR)** | `docs/architecture.md` | **Phase 2 — Required** |
| Implementation Plan | Brain artifact | Phase 4 (after approval) |

---

## After Full Planning

Tell user:
```
[OK] Planning complete:
- docs/PLAN-{slug}.md — Task breakdown
- docs/architecture.md — C4 Architecture + ADR

Khi bạn approve kiến trúc, run `/create` để bắt đầu implementation.
```

---

## Usage

```
/plan trading analysis app with TradingView + LLM
/plan e-commerce site with cart and payments
/plan SaaS dashboard with multi-tenant auth
```
