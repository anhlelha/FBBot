# PLAN: SaaS Chatbot Platform

> Chuyển đổi Hotel Chatbot đơn lẻ → nền tảng SaaS multi-tenant

## Feature List (Prioritized)

| Priority | Feature | Phase |
|----------|---------|-------|
| P0 | Database layer (SQLite) | MVP |
| P0 | Google OAuth authentication | MVP |
| P0 | Multi-tenant core (tenant isolation) | MVP |
| P0 | Per-tenant webhook routing | MVP |
| P0 | Landing page (signup/login) | MVP |
| P0 | Tenant dashboard (mockup-based UI) | MVP |
| P0 | Owner admin panel | MVP |
| P1 | Bookings management | Beta |
| P1 | Live Chat hand-off | Beta |
| P1 | Payments management | Beta |
| P2 | Stripe integration | Production |
| P2 | Custom domain per tenant | Production |

## Phase Breakdown

### Phase 1 — MVP (hiện tại)
- Database, Auth, Multi-tenant core
- Landing page, Tenant dashboard (4 pages), Owner panel
- Per-tenant webhook + FB integration

### Phase 2 — Beta
- Bookings, Live Chat, Payments pages
- Email notifications

### Phase 3 — Production
- Real payment (Stripe), Custom domains, Analytics

## Task Checklist — Phase 1 (MVP)

### Sprint 1: Foundation
- [ ] Install dependencies (`better-sqlite3`, `cookie-session`, `google-auth-library`)
- [ ] Create `src/database.js` — SQLite schema + CRUD
- [ ] Create `src/auth.js` — Google OAuth + session middleware
- [ ] Update `src/config.js` — new env vars
- [ ] Create `src/tenantManager.js` — tenant CRUD, AI/VS instance management

### Sprint 2: Core Refactoring
- [ ] Refactor `src/ai.js` — singleton → factory
- [ ] Refactor `src/knowledgeBase.js` — tenant-scoped
- [ ] Refactor `src/vectorStore.js` — export class
- [ ] Refactor `src/webhook.js` — single `/webhook`, route by `page_id`
- [ ] Refactor `src/messenger.js` — accept token param

### Sprint 3: Frontend
- [ ] Create landing page (`landing.html`, `landing.css`, `landing.js`)
- [ ] Rebuild tenant dashboard (`index.html`, `style.css`, `app.js`) — mockup design
- [ ] Create owner panel (`owner.html`, `owner.js`)

### Sprint 4: Integration & Server
- [ ] Refactor `server.js` — all new routes
- [ ] Update `.env.example`
- [ ] End-to-end testing

## Agent/Skill Assignments

| Task | Agent | Skills |
|------|-------|--------|
| Database design | backend-specialist | database-design |
| Auth implementation | backend-specialist | nodejs-best-practices |
| Frontend rebuild | frontend-specialist | frontend-design |
| API routes | backend-specialist | api-patterns |
| Testing | debugger | testing-patterns |
