# Architecture — SaaS Chatbot Platform

## Level 1 — System Context

```mermaid
C4Context
    title System Context — SaaS Chatbot Platform

    Person(owner, "Platform Owner", "Quản lý toàn bộ hệ thống SaaS")
    Person(tenant, "Tenant (Hotel Owner)", "Khách hàng sử dụng dịch vụ chatbot")
    Person(guest, "Hotel Guest", "Khách du lịch chat qua FB Messenger")

    System(platform, "Chatbot Platform", "Nền tảng SaaS multi-tenant AI chatbot")

    System_Ext(google, "Google OAuth", "Xác thực người dùng")
    System_Ext(gemini, "Google Gemini API", "LLM generation")
    System_Ext(vertexRag, "Vertex AI RAG Engine", "Managed corpus, chunking, embedding, vector search")
    System_Ext(fb, "Facebook Messenger", "Kênh chat với khách")

    Rel(owner, platform, "Quản lý tenants")
    Rel(tenant, platform, "Cấu hình chatbot, upload tài liệu")
    Rel(guest, fb, "Gửi tin nhắn")
    Rel(fb, platform, "Webhook events")
    Rel(platform, fb, "Send API responses")
    Rel(platform, google, "Verify OAuth tokens")
    Rel(platform, gemini, "Generate AI responses")
    Rel(platform, vertexRag, "Upload files, retrieve contexts")
```

| Element | Type | Description |
|---------|------|-------------|
| Platform Owner | Person | `anhle.lha@gmail.com` — quản lý tất cả tenants |
| Tenant | Person | Hotel owner đăng ký tài khoản, cấu hình chatbot riêng |
| Hotel Guest | Person | Người dùng cuối chat trên FB Messenger |
| Chatbot Platform | System | Node.js Express app, multi-tenant |
| Google OAuth | External | Xác thực đăng nhập bằng Gmail |
| Google Gemini | External | AI generation (LLM) |
| Vertex AI RAG Engine | External | Managed chunking, embedding, vector search |
| Facebook Messenger | External | Kênh liên lạc với khách |

## Level 2 — Container Diagram

```mermaid
C4Container
    title Container Diagram — Chatbot Platform

    Person(tenant, "Tenant")
    Person(owner, "Owner")
    Person(guest, "Guest")

    System_Boundary(platform, "Chatbot Platform") {
        Container(landing, "Landing Page", "HTML/CSS/JS", "Trang đăng ký/đăng nhập")
        Container(dashboard, "Tenant Dashboard", "HTML/CSS/JS", "Admin panel per tenant")
        Container(ownerUI, "Owner Panel", "HTML/CSS/JS", "Platform admin")
        Container(api, "Express API Server", "Node.js + Express", "REST API + Webhook handler")
        ContainerDb(db, "SQLite Database", "better-sqlite3", "Tenant data, configs, documents")
        Container(fs, "File Storage", "Local filesystem", "uploads/{tenantId}/")
    }

    System_Ext(google, "Google OAuth")
    System_Ext(gemini, "Gemini API")
    System_Ext(vertexRag, "Vertex AI RAG Engine")
    System_Ext(fb, "FB Messenger (Chat & Web Plugin)")

    Rel(tenant, landing, "Đăng ký/đăng nhập")
    Rel(tenant, dashboard, "Quản lý chatbot")
    Rel(owner, ownerUI, "Quản lý tenants")
    Rel(landing, api, "POST /api/auth/google")
    Rel(dashboard, api, "REST API calls")
    Rel(ownerUI, api, "REST API calls")
    Rel(api, db, "Read/Write")
    Rel(api, fs, "Read/Write files (backup)")
    Rel(api, google, "Verify tokens")
    Rel(api, gemini, "AI generation")
    Rel(api, vertexRag, "Upload files, retrieve contexts")
    Rel(fb, api, "Webhook POST")
    Rel(api, fb, "Send API")
    Rel(guest, fb, "Chat qua App hoặc Web Plugin")
```

| Container | Technology | Role |
|-----------|-----------|------|
| Landing Page | Static HTML/CSS/JS | Giới thiệu sản phẩm, Google Sign-In |
| Tenant Dashboard | Static HTML/CSS/JS | 4 pages: Dashboard, Knowledge, Agent, Settings |
| Owner Panel | Static HTML/CSS/JS | Quản lý danh sách tenants |
| Express API | Node.js 18+ | REST API, webhook handler, auth, business logic |
| SQLite DB | better-sqlite3 | Persistent storage cho tenants, configs, documents |
| File Storage | Local disk | `uploads/{tenantId}/` — uploaded documents |

## Level 3 — Component Diagram (API Server)

```mermaid
C4Component
    title Component Diagram — Express API Server

    Container_Boundary(api, "Express API Server") {
        Component(auth, "Auth Module", "auth.js", "Google OAuth verify + session middleware")
        Component(tenantMgr, "Tenant Manager", "tenantManager.js", "CRUD tenants, manage AI instances")
        Component(aiFactory, "AI Factory", "ai.js", "Gemini LLM generation")
        Component(kb, "Knowledge Base", "knowledgeBase.js", "Tenant-scoped document management")
        Component(vertexRag, "Vertex RAG Client", "vertexRag.js", "GCP Vertex AI RAG Engine wrapper")
        Component(webhook, "Webhook Handler", "webhook.js", "Single /webhook endpoint, routes by page_id")
        Component(messenger, "Messenger Client", "messenger.js", "FB Send API with tenant token")
        Component(guardrails, "Guardrails Engine", "guardrails.js", "Enforce Hard/Soft rules before AI gen")
        Component(database, "Database", "database.js", "SQLite schema + queries")
        Component(config, "Config", "config.js", "Environment variables + GCP config")
    }

    Rel(auth, database, "Lookup/create tenant")
    Rel(tenantMgr, database, "CRUD operations")
    Rel(tenantMgr, aiFactory, "Create AI instances")
    Rel(tenantMgr, vertexRag, "Retrieve contexts per corpus")
    Rel(kb, vertexRag, "Upload/delete files to RAG corpus")
    Rel(kb, database, "Store rag_file_name")
    Rel(webhook, tenantMgr, "Lookup tenant")
    Rel(webhook, messenger, "Send replies")
    Rel(webhook, guardrails, "Validate input/output")
    Rel(guardrails, aiFactory, "Generate responses")
```

> **Chi tiết thiết kế:** Mời xem tài liệu chi tiết cách hoạt động của Knowledge Base, RAG, Webhook Routing, và giới hạn Tenant tại [Component Design](./component-design.md).

## Facebook Integration Architecture

### Model: Single App, Multiple Pages

```mermaid
flowchart LR
    subgraph "Platform Owner"
        APP["1 Facebook App\ntrên Meta Developer"]
    end

    subgraph "Tenant A"
        PA[FB Page A]
    end

    subgraph "Tenant B"
        PB[FB Page B]
    end

    PA -->|Subscribe| APP
    PB -->|Subscribe| APP
    APP -->|All events| WH["/webhook"]
    WH -->|page_id=PA| AI_A[AI Instance A]
    WH -->|page_id=PB| AI_B[AI Instance B]
    WH -->|page_id=Platform| AI_PLAT[AI Solution Bot (Web Chat)]
```

### Webhook Routing Logic

1. FB gửi POST `/webhook` với `entry[].id` = `page_id`
2. Server query: `SELECT tenant_id FROM tenant_fb_config WHERE page_id = ?`
3. Load tenant AI instance + knowledge base
4. Generate response, send via tenant's `page_access_token`

### KH Setup Guide (hiển thị trong Dashboard Settings)

| Bước | Hành động |
|------|----------|
| 1 | Truy cập [Meta for Developers](https://developers.facebook.com) |
| 2 | Vào App (do Owner mời) -> Messenger Settings -> chọn FB Page -> Subscribe |
| 3 | Copy Page Access Token từ trang đó |
| 4 | Paste vào dashboard Settings |
| 5 | Hệ thống tự detect `page_id` qua `GET /me?access_token=TOKEN` |
| 6 | Done - Webhook tự động hoạt động |

> Webhook URL được Owner cấu hình 1 lần trên FB App. Tất cả Pages subscribe cùng App sẽ gửi events về cùng URL.

### Cách lấy Page Access Token

**MVP (Phase 1):** KH tự lấy token từ Graph API Explorer
1. Vào https://developers.facebook.com/tools/explorer/
2. Chọn App -> chọn Page -> quyền `pages_messaging`
3. Generate Access Token -> paste vào dashboard

**Production (Phase 2):** Facebook Login for Business
1. Dashboard có nút "Connect Facebook Page"
2. OAuth flow -> KH chọn Page -> cấp quyền -> hệ thống tự nhận token

### Auto-detect Page ID

Khi KH paste token, server gọi:
```
GET https://graph.facebook.com/v21.0/me?access_token=TOKEN
-> { "id": "PAGE_ID", "name": "Hotel Name" }
```
Tự lưu `page_id` + `page_name` vào `tenant_fb_config`.

## Security Analysis

```mermaid
flowchart LR
    subgraph "Stays on Server"
        DB[(SQLite DB)]
        FILES[Upload Files]
        SESSION[Session Cookies]
        ENV[.env secrets]
    end

    subgraph "Leaves Server"
        GOOGLE[Google OAuth Token → Google API]
        GEMINI[User message → Gemini API]
        FB[Reply → FB Send API]
    end

    style DB fill:#2d5016
    style FILES fill:#2d5016
    style SESSION fill:#2d5016
    style ENV fill:#2d5016
    style GOOGLE fill:#5a3000
    style GEMINI fill:#5a3000
    style FB fill:#5a3000
```

| Risk | Level | Mitigation |
|------|-------|-----------|
| FB Page Token leak | High | Stored encrypted in DB, never sent to frontend |
| Tenant data isolation | High | All queries filtered by `tenant_id`, file paths namespaced |
| Session hijack | Medium | Signed cookies, httpOnly, secure in production |
| Gemini API key exposure | Medium | Single platform key in `.env`, not per-tenant |
| File upload malware | Low | File type whitelist, size limit 10MB |

## Data Model

```mermaid
erDiagram
    TENANTS {
        string id PK "uuid"
        string email UK "Google email"
        string name "Display name"
        string plan "trial|basic|pro|whitelist"
        string status "active|suspended"
        int token_limit "Max tokens per month"
        int tokens_used "Current usage"
        string corpus_name "Vertex AI RAG Corpus resource name"
        datetime created_at
    }

    TENANT_FB_CONFIG {
        string tenant_id FK
        string page_access_token "Encrypted"
        string verify_token
        string app_secret "Encrypted"
        string page_id
    }

    TENANT_SETTINGS {
        string tenant_id FK
        string system_prompt
        string ai_model "gemini-2.5-flash"
        string bot_name "Bot display name"
        text tools_config "JSON array"
        text guardrails "JSON (Soft guardrails)"
    }

    DOCUMENTS {
        string id PK
        string tenant_id FK
        string filename
        string path "uploads/{tenantId}/{file}"
        int size
        string type ".pdf|.txt|.md|.csv"
        int chunks_count
        string rag_file_name "Vertex AI RAG File resource name"
        datetime created_at
    }

    WHITELIST_EMAILS {
        string id PK
        string email UK "Gmail address"
        string added_by "owner email"
        datetime created_at
    }

    TENANTS ||--o| TENANT_FB_CONFIG : has
    TENANTS ||--o| TENANT_SETTINGS : has
    TENANTS ||--o{ DOCUMENTS : owns
```

> **Whitelist logic:** Khi user đăng nhập, nếu email nằm trong `whitelist_emails` → auto-set plan = `whitelist` (unlimited tokens, no payment).

## Deployment View

```
┌──────────────────────────────────────────────────────┐
│  GCP VM / Local Machine                               │
│                                                       │
│  ┌──────────────┐    ┌──────────────────────┐        │
│  │ node server.js│    │  PM2 / nodemon       │        │
│  │  Port: 3000   │◄───│  Process Manager     │        │
│  └──────┬───────┘    └──────────────────────┘        │
│         │                                             │
│  ┌──────┴───────┐    ┌──────────────────────┐        │
│  │ data/app.db  │    │ uploads/{tenantId}/   │        │
│  │ (SQLite)     │    │ (local backup)        │        │
│  └──────────────┘    └──────────────────────┘        │
│         │                                             │
│  ┌──────┴──────────────────────────────┐             │
│  │ vertex_rag/gcp-key.json             │             │
│  │ (Service Account credentials)       │             │
│  └─────────────────────────────────────┘             │
└──────────────────────────────────────────────────────┘
         │
         ▼ External APIs (GCP + Meta)
┌────────┴──────────────────────────────────────┐
│ Google OAuth │ Gemini API │ Vertex AI RAG │ FB │
│              │            │ Engine        │    │
└───────────────────────────────────────────────┘
```

### Infrastructure Details

| Item | Value |
|---|---|
| **Cloud Provider** | Google Cloud Platform (GCP) |
| **VM Instance IP** | `34.9.136.241` |
| **SSH User** | `anhlh48` |
| **Project Directory** | `~/fbbot` |
| **Service Account Key** | `~/fbbot/vertex_rag/ai4all-rag-engine-cbf3d4caee11.json` |
| **Process Manager** | PM2 (`hotel-chatbot-fb`) |
| **Web Server** | Nginx (Reverse Proxy to 3000) |
| **Database** | SQLite (`~/fbbot/data/app.db`) |

> [!TIP]
> Use `./scripts/deploy-vm.sh` to quickly update the server from the latest GitHub code.

## ADR — Architecture Decision Records

### ADR-01: Database — SQLite vs PostgreSQL vs MongoDB

| Criteria | SQLite ✅ | PostgreSQL | MongoDB |
|----------|:---------:|:----------:|:-------:|
| Zero setup | ✅ | ❌ | ❌ |
| Single binary | ✅ | ❌ | ❌ |
| Suitable for MVP scale | ✅ | ✅ | ✅ |
| Relational queries | ✅ | ✅ | ⚠️ |
| Production scalability | ⚠️ | ✅ | ✅ |

**Why NOT PostgreSQL:** Requires separate server/service, overkill for MVP with <100 tenants.
**Why NOT MongoDB:** Schema-less adds complexity for structured tenant data.
**Decision:** ✅ SQLite — Zero config, single file, perfect for MVP. Migrate to PostgreSQL when scaling.

---

### ADR-02: Authentication — Google OAuth vs Email/Password vs Magic Link

| Criteria | Google OAuth ✅ | Email/Password | Magic Link |
|----------|:--------------:|:--------------:|:----------:|
| No password management | ✅ | ❌ | ✅ |
| User trust level | ✅ | ⚠️ | ✅ |
| Implementation complexity | ⚠️ | ❌ | ⚠️ |
| User explicitly requested | ✅ | ❌ | ❌ |

**Why NOT Email/Password:** User explicitly said "sử dụng gmail". Password storage adds security burden.
**Why NOT Magic Link:** Needs email service (SMTP), more infrastructure.
**Decision:** ✅ Google OAuth — Per user request, no password storage needed.

---

### ADR-03: Session Management — cookie-session vs express-session vs JWT

| Criteria | cookie-session ✅ | express-session | JWT |
|----------|:----------------:|:---------------:|:---:|
| No server-side store | ✅ | ❌ | ✅ |
| Simple implementation | ✅ | ⚠️ | ⚠️ |
| Works with SQLite | ✅ | ⚠️ | ✅ |
| Logout support | ✅ | ✅ | ❌ |

**Why NOT express-session:** Needs session store (Redis/DB), adds complexity.
**Why NOT JWT:** No easy invalidation/logout, token size grows.
**Decision:** ✅ cookie-session — Signed cookies, stateless, simple.

---

### ADR-04: Frontend — Static HTML vs React/Vite vs Next.js

| Criteria | Static HTML ✅ | Vite + React | Next.js |
|----------|:-------------:|:------------:|:-------:|
| Zero build step | ✅ | ❌ | ❌ |
| Matches existing codebase | ✅ | ❌ | ❌ |
| Mockup already in HTML | ✅ | ❌ | ❌ |
| Fast iteration | ✅ | ⚠️ | ⚠️ |

**Why NOT Vite/React:** Existing app is static HTML, mockup is static HTML. Adding build step is unnecessary overhead.
**Why NOT Next.js:** Server-side rendering not needed. Pure overhead for admin dashboard.
**Decision:** ✅ Static HTML/CSS/JS — Consistent with existing code and mockup.

---

### ADR-05: Multi-tenancy — Schema per tenant vs Row-level isolation vs Separate DBs

| Criteria | Row-level ✅ | Schema per tenant | Separate DBs |
|----------|:-----------:|:-----------------:|:------------:|
| Simple queries | ✅ | ⚠️ | ❌ |
| Single DB file | ✅ | ✅ | ❌ |
| Tenant isolation | ⚠️ | ✅ | ✅ |
| SQLite compatible | ✅ | ❌ | ⚠️ |

**Why NOT Schema per tenant:** SQLite doesn't support schemas.
**Why NOT Separate DBs:** File management complexity, connection pooling.
**Decision:** ✅ Row-level isolation — `tenant_id` column on all tables, enforced in every query.

---

### ADR-06: Webhook Routing — Single endpoint vs Per-tenant URL

| Criteria | Single /webhook + page_id ✅ | /webhook/:tenantId |
|----------|:---------------------------:|:------------------:|
| Standard FB SaaS pattern | ✅ | ❌ |
| No tenant ID in URL | ✅ | ❌ |
| Works with 1 FB App | ✅ | ⚠️ |
| KH setup simplicity | ✅ | ❌ |

**Why NOT /webhook/:tenantId:** Non-standard, exposes tenant ID, requires per-KH webhook config.
**Decision:** ✅ Single `/webhook` — Route by `page_id` from payload (ManyChat/Chatfuel pattern).

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (mockup design system) |
| Backend | Node.js 18+ / Express 4 |
| Database | SQLite (better-sqlite3) |
| Auth | Google OAuth 2.0 (google-auth-library) |
| Session | cookie-session (signed cookies) |
| AI | Google Gemini API (gemini-2.5-flash) |
| RAG Engine | Google Vertex AI RAG Engine (managed corpus + vector search) |
| Channel | Facebook Messenger (Graph API v21.0) |
| Tunnel | ngrok (development) |

---

### ADR-07: RAG Backend — Self-managed vs Vertex AI RAG Engine

| Tiêu chí | Self-managed (Phase 1) | Vertex AI RAG Engine ✅ |
|---|---|---|
| Chunking quality | ❌ Fixed-size, cắt giữa câu | ✅ Configurable + semantic splitting |
| Vector persistence | ⚠️ SQLite JSON (workaround) | ✅ Fully managed, persistent |
| Search performance | ❌ O(N) brute-force | ✅ O(logN) HNSW indexed |
| Scale limit | ~10K chunks | ~10M chunks |
| Maintenance effort | 🔴 Cao | ✅ Zero — fully managed |
| Multi-tenant | Manual Map per tenant | 1 Corpus per tenant |
| File format support | PDF, TXT, MD, CSV | PDF, TXT, HTML, DOCX + auto-parse |
| Cost (20 tenants) | Gemini Embedding free tier | ~$0.05-$0.18/tháng |
| Setup complexity | Zero (npm install) | 🟡 Cần GCP project + auth |

**Decision:** ✅ Vertex AI RAG Engine — Giải quyết tất cả hạn chế (persistence, chunking, scale). Chi phí ~$0.05-$0.18/tháng cho 20 tenants.

> Chi tiết phân tích chi phí: xem [Component Design — Phần 8](./component-design.md)

