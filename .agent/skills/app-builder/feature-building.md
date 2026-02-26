---
name: feature-building
description: Universal rules for building features in an existing application using Feature-Driven Implementation (FDI).
---

# Feature-Driven Implementation (FDI) Protocol

> 🔴 **MANDATORY:** Follow this cycle for EVERY new feature or complex component.

## The 5-Step Loop

### 1. Technical Design (Micro-ADR)
- **Analyze:** Define API contracts, Props, Data flow, and State management.
- **Plan:** List file changes and new dependencies.
- **Document:** **MANDATORY** - Create a design document file at `docs/features/f{xx}-{feature-name}.md`.
- **Rule:** NO CODE until the file is created AND the user clears the "Design Gate".

### 2. Design Gate (User Approval)
- Present the technical design clearly.
- Wait for explicit user approval (e.g., "Approved", "Go ahead").

### 3. Implement & Test
- **Code:** Build the feature as per the approved design.
- **Test (AI Responsibility):**
  - Unit tests for logic.
  - API validation.
  - Database integration tests.
- **Rule:** Apply `@[skills/tdd-workflow]` where possible.

### 4. Verification
- Run `python .agent/scripts/checklist.py .`
- Ensure all logic tests pass.

### 5. Handover Gate (User Acceptance)
- Present the completed feature.
- **User Responsibility:** Test UI/UX, Layout, and Design Aesthetics.
- **Rule:** Feature is NOT done until user accepts the E2E experience.

## Communication Template
"Tôi đã chuẩn bị thiết kế kỹ thuật cho [Feature Name].
- **Cấu trúc:** [Files/Folders]
- **API/Data:** [Description]
- **Kiểm thử:** AI sẽ test [Logic/API], Bạn sẽ test [UI].

Vui lòng Approve để tôi bắt đầu code."
