# Tài liệu thiết kế Component (Component Design)

Tài liệu này mô tả chi tiết cách thức hoạt động và thiết kế của các domain component chính trong hệ thống SaaS Chatbot Platform. 

---

## 1. Knowledge Base Component (`src/knowledgeBase.js`)

**Nhiệm vụ:**
Quản lý tài liệu tri thức (Documents) của từng Tenant, trích xuất văn bản, cắt nhỏ (chunking) và tạo vector nhúng (embeddings) để phục vụ cho việc tìm kiếm ngữ cảnh.

**Luồng hoạt động (Upload & Process Document):**
1. **Kiểm tra định dạng:** Hỗ trợ các file `.pdf`, `.txt`, `.md`, `.csv`.
2. **Lưu trữ vật lý:** File được lưu vào thư mục riêng của Tenant: `uploads/{tenantId}/`. 
3. **Trích xuất văn bản (Text Extraction):**
   - Với file `.pdf`: Sử dụng thư viện `pdf-parse` để đọc nội dung text.
   - Với các định dạng khác: Đọc buffer trực tiếp thành chuỗi UTF-8.
4. **Lưu Metadata:** Gọi `database.js` để tạo bản ghi vào bảng `documents` với trạng thái ban đầu.
5. **Cắt văn bản (Chunking):** Chia văn bản thành các đoạn nhỏ bằng hàm `chunkText`.
   - **Kích thước chunk (Size):** 1000 ký tự.
   - **Độ chồng lấp (Overlap):** 200 ký tự (giúp ngữ cảnh không bị đứt đoạn giữa 2 chunk liền kề).
6. **Nhúng Vector (Embedding):** Gọi Gemini API (`gemini-embedding-001`) qua `ai.js` để chuyển mỗi chunk thành vector số thực.
7. **Lưu Vector Store:** Thêm document chunks và embeddings vào `VectorStore` instance của riêng Tenant đó.
8. **Cập nhật Database:** Lưu lại số lượng chunk đã xử lý thành công.

---

## 2. Vector Store Component (`src/vectorStore.js`)

**Nhiệm vụ:**
Lưu trữ In-memory vector embeddings cho từng Tenant và thực hiện tìm kiếm ngữ cảnh (Semantic Search). Nằm trong bộ nhớ (RAM) của ứng dụng để đảm bảo tốc độ truy xuất nhanh nhất.

**Thiết kế Dữ liệu:**
- Được khởi tạo riêng cho mỗi Tenant khi tenant đó cần phản hồi tin nhắn hoặc quản lý tài liệu.
- Dữ liệu rác (Garbage Collection): Khi cần có thể xóa thông qua `clearTenantInstance`.

**Luồng tìm kiếm (Semantic Search):**
1. Nhận vào Vector của câu hỏi người dùng (Query Embedding).
2. Duyệt qua toàn bộ chunks trong `VectorStore` của Tenant.
3. Tính toán **Cosine Similarity** (Độ tương đồng Cosine) giữa Query Embedding và Document Embedding.
4. Sắp xếp giảm dần theo điểm số (Score).
5. Trả về **Top K** kết quả cao nhất (Mặc định `topK = 5`).

---

## 3. Tenant Manager Component (`src/tenantManager.js`)

**Nhiệm vụ:**
Trạm kiểm soát trung tâm (Central Controller) điều phối luồng xử lý AI, phân tách dữ liệu (isolation) giữa các Tenants và kiểm soát quota sử dụng (Rate Limiting).

**Quản lý Instance Cache:**
Sử dụng cấu trúc `Map` (Cache In-memory) để lưu `tenantInstances`. Một `instance` chứa:
- Thông tin Tenant từ Database.
- Cấu hình Bot (System Prompt, model lựa chọn...).
- `VectorStore` In-memory chứa knowledge tài liệu của Tenant đó.

**Luồng sinh câu trả lời AI (Generate Response):**
1. **Load Instance:** Tìm trong Cache hoặc khởi tạo từ DB + nạp VectorStore.
2. **Kiểm tra Quota:** Chặn phản hồi nếu số lượng quy đổi `tokens_used` vượt quá `token_limit` (Bỏ qua đối với gói `whitelist` hoặc `pro`).
3. **RAG (Retrieval-Augmented Generation):**
   - Tạo Embedding từ tin nhắn người dùng.
   - Tìm 5 chunk liên quan nhất trong `VectorStore`.
   - Gộp Nội dung các chunk tìm được làm `Context`.
4. **Gọi AI:** Gửi `System Prompt` + `Context` + `User Message` lên Gemini API (`gemini-2.5-flash`).
5. **Cập nhật Quota:** Tính toán số token tiêu thụ (ước lượng: 1 token ≈ 4 ký tự) và ghi tăng vào cơ sở dữ liệu. Cập nhật lại Cache.

---

## 4. Webhook & Messenger Component (`src/webhook.js` & `src/messenger.js`)

**Nhiệm vụ:**
Xử lý tương tác hai chiều với Facebook Messenger qua một điểm (Single Endpoint) duy nhất cho toàn bộ hệ thống Multi-Tenant.

**Thiết kế định tuyến (Routing Logic):**
1. **Single Endpoint:** Dùng chung URL `/webhook` khai báo trên 1 Facebook App duy nhất của Platform.
2. Khi có tin nhắn đến (POST request):
   - Trả về `200 OK` ngay lập tức để Facebook không bị timeout.
   - Duyệt payload để lấy ID của Fanpage nhận tin nhắn (`entry[].id` tức `page_id`).
   - Gọi hàm `getTenantByPageId` trong `TenantManager` để query config từ Database, xác định tin nhắn này thuộc về Tenant nào.
3. Lấy `page_access_token` thuộc về Tenant đó (đã phân tách).
4. **Phản hồi:**
   - Bật trạng thái Chatbot đang gõ (`typing_on`).
   - Gọi `Tenant Manager` tạo câu trả lời thông minh dựa trên Knowledge Base.
   - Gửi văn bản phản hồi và tắt trạng thái gõ (`typing_off`).

---

## 5. AI Factory Component (`src/ai.js`)

**Nhiệm vụ:**
Giao tiếp trực tiếp với SDK của bộ sinh AI (Google Generative AI). Cung cấp 2 hàm chức năng chính độc lập:
1. `generateResponse`: Lắp ráp Full Prompt (Bao gồm System Rules + Context + Tin nhắn khách). Xử lý call API Text Generation. Xử lý fallback (Catch Error) khi rớt mạng hoặc lỗi API.
2. `getEmbedding`: Gọi mô hình `gemini-embedding-001` để biến đổi string thuần thành mảng giá trị float (Vector). 

---

## 6. Phân tích chuyên sâu: RAG Pipeline — So sánh giải pháp hiện tại vs Giải pháp nâng cao

> Phần này giải thích **tại sao** hệ thống MVP chọn giải pháp đơn giản, và **khi nào** cần nâng cấp lên các kỹ thuật tiên tiến hơn.

### 6.1. Thuật toán Chunking — So sánh

| Tiêu chí | Fixed-size (Đang dùng ✅) | Recursive Text Splitting | Semantic Chunking |
|-----------|:------------------------:|:------------------------:|:-----------------:|
| **Cách hoạt động** | Cắt cố định mỗi N ký tự, chồng lấp M ký tự | Ưu tiên cắt ở `\n\n` → `\n` → `.` → `,` → ký tự | AI so sánh embedding giữa các câu liền kề, cắt khi chủ đề thay đổi |
| **Độ phức tạp triển khai** | ⭐ Rất thấp (10 dòng code) | ⭐⭐ Thấp (dùng thư viện) | ⭐⭐⭐⭐ Cao (cần gọi API embedding cho từng câu) |
| **Bảo toàn ngữ nghĩa** | ❌ Có thể cắt giữa câu | ✅ Giữ nguyên câu/đoạn | ✅✅ Giữ nguyên chủ đề |
| **Chi phí API** | Thấp | Thấp | Cao (gọi embedding N lần khi chunking) |
| **Phù hợp với** | MVP, tài liệu ngắn (<50 trang) | Production, tài liệu trung bình | Enterprise, tài liệu phức tạp |

**Hiện tại dùng Fixed-size vì:**
- Tài liệu khách sạn thường ngắn (FAQ, policy, menu) → cắt tĩnh 1000 ký tự đủ tốt.
- Overlap 200 ký tự giúp vớt vát phần ngữ cảnh bị đứt.
- Zero dependency — không cần thêm thư viện ngoài.

**Nhược điểm cần biết:**
- Nếu 1000 ký tự cắt đúng giữa câu quan trọng → embedding vector bị sai lệch → RAG gắp nhầm chunk → câu trả lời AI kém chính xác.

### 6.2. Vector Database — So sánh

| Tiêu chí | In-Memory Array (Đang dùng ✅) | ChromaDB | Pinecone | sqlite-vss |
|-----------|:-----------------------------:|:--------:|:--------:|:----------:|
| **Lưu trữ** | RAM (mất khi restart) | Disk (persistent) | Cloud (managed) | SQLite file |
| **Thuật toán tìm kiếm** | Brute-force `O(N)` | HNSW `O(logN)` | HNSW (optimized) | IVF/Flat |
| **Cài đặt** | 0 bước | Docker hoặc pip | Đăng ký SaaS + API key | npm install |
| **Giới hạn hiệu quả** | ~10K chunks | ~10M chunks | ~1B chunks | ~1M chunks |
| **Chi phí** | Free | Free (self-hosted) | $70+/tháng | Free |
| **Multi-tenant** | Manual (Map per tenant) | Collection per tenant | Namespace per tenant | Table per tenant |
| **Phù hợp với** | MVP (<100 tenants, <1K chunks/tenant) | Startup/Scale-up | Enterprise | MVP+ (persistence) |

**Hiện tại dùng In-Memory Array vì (ADR: Zero Setup):**
- Yêu cầu "tải về, chạy liền" — không Docker, không SaaS đăng ký.
- Mỗi tenant khách sạn thường có ~500-1000 chunks → brute-force dưới 10ms.
- Hoàn toàn đủ cho giai đoạn MVP với <100 tenants.

**Rủi ro lớn nhất:**
- **Mất dữ liệu khi restart:** Vector embeddings chỉ ở RAM. Khi server restart phải re-embed lại toàn bộ documents → tốn tiền Gemini API.
- **Không scale:** Nếu 1 tenant có 100K chunks, brute-force sẽ mất >1 giây.

### 6.3. Embedding Model — So sánh

| Tiêu chí | Gemini Embedding (Đang dùng ✅) | OpenAI text-embedding-3-small | Cohere embed-v3 |
|-----------|:------------------------------:|:-----------------------------:|:----------------:|
| **Dimensions** | 768 | 1536 (hoặc custom) | 1024 |
| **Chi phí** | Free tier rộng rãi | $0.02/1M tokens | $0.10/1M tokens |
| **Chất lượng** | Tốt | Rất tốt | Rất tốt |
| **Đa ngôn ngữ (Tiếng Việt)** | ✅ Tốt | ✅ Tốt | ✅ Khá |

**Gemini phù hợp vì:** Đã dùng Gemini cho text generation → dùng chung API key, không thêm provider, free tier đủ cho MVP.

---

## 7. Lộ trình nâng cấp RAG → Vertex AI RAG Engine

> Thay thế toàn bộ RAG pipeline tự quản lý bằng Google Vertex AI RAG Engine (managed service).

### 7.1. Kiến trúc mới

**Upload Flow:** File → (Local/GCS) → `importRagFiles()` → RAG Corpus (1 per tenant)
**Query Flow:** User message → `retrieveContexts()` → Context chunks → `generateContent()` → AI Reply

### 7.2. Thành phần bị thay thế

| Trước (tự quản lý) | Sau (Vertex AI managed) |
|---|---|
| `chunkText()` — fixed 1000 chars | Auto chunking (semantic splitting) |
| `getEmbedding()` — gọi API | Auto embedding (`text-embedding-004`) |
| `VectorStore` class — in-memory | Managed Vector Store (HNSW indexed) |
| `cosineSimilarity()` — brute-force | Optimized search `O(logN)` |
| `document_chunks` SQLite table | Fully managed, persistent |

### 7.3. Files bị ảnh hưởng

| File | Mức độ |
|---|---|
| `vectorStore.js` | 🔴 DELETE |
| `knowledgeBase.js` | 🔴 Major refactor |
| `tenantManager.js` | 🔴 Major refactor |
| `ai.js` | 🟡 Bỏ `getEmbedding()` |
| `config.js` | 🟡 Thêm GCP env vars |
| `database.js` | 🟢 Thêm `corpus_name`, bỏ `document_chunks` |

---

## 8. Phân tích chi phí Vertex AI RAG Engine

> Giả định: 20 tenants × 10-50 docs/tenant, ~10K tokens/doc, 200-500 queries/ngày

### 8.1. Chi phí từng thành phần

| Thành phần | Đơn giá | Min/tháng | Max/tháng |
|---|---|---|---|
| **Embedding** (query) | $0.10/1M tokens | $0.03 | $0.08 |
| **Vector Storage** | $3.00/GB | $0.02 | $0.10 |
| **Retrieval API** (`retrieveContexts`) | $0 (chỉ tính embedding) | $0 | $0 |
| **File Storage** (Local) | $0 | $0 | $0 |
| **Embedding ingest** (1 lần) | $0.10/1M tokens | $0.20 | $1.00 |
| **TỔNG** | | **~$0.05/tháng** | **~$0.18/tháng** |

> **Lưu ý:** KHÔNG dùng Grounding API ($2.50/1K requests). Dùng `retrieveContexts()` lấy context rồi tự gọi `generateContent()`.

### 8.2. So sánh Local vs GCS Storage

| Tiêu chí | Local (khuyến nghị Phase 1) | GCS (khi scale) |
|---|---|---|
| Chi phí | $0 | $0.02/GB/tháng |
| Import RAG Engine | Upload buffer (max 25MB/file) | GCS URI (không giới hạn) |
| Độ bền | ⚠️ Mất nếu server hỏng | ✅ 99.99% SLA |
| Multi-server | ❌ | ✅ |

**Khuyến nghị:** Local storage cho giai đoạn 20 tenants. Chuyển GCS khi >50 tenants hoặc multi-server.

---

## 9. Facebook Content Ingestion cho RAG

> Khả năng trích xuất nội dung từ Facebook để đưa vào Knowledge Base.

### 9.1. Trích xuất bài viết cụ thể (từ URL)

**Ví dụ URL:** `https://web.facebook.com/photo/?fbid=1308831211293306&set=a.608908887952212`

| Tiêu chí | Đánh giá |
|---|---|
| **Khả thi?** | ✅ **CÓ** — qua Facebook Graph API |
| **API endpoint** | `GET /{post-id}?fields=message,attachments,created_time` |
| **Authentication** | `page_access_token` (đã có sẵn trong `tenant_fb_config`) |
| **Dữ liệu lấy được** | Text (`message`), caption ảnh (`attachments.description`), link, thời gian |
| **Hạn chế** | Chỉ lấy được bài viết từ Page mà tenant đã kết nối (có token) |

**Flow đề xuất:**
```
Tenant paste URL → Parse fbid → GET /{fbid}?fields=message,attachments
→ Extract text → Import vào RAG Corpus
```

### 9.2. Quét bài viết mới từ Page (auto-crawl)

**Ví dụ URL:** `https://web.facebook.com/daihoctaichinhnganhanghanoi`

| Tiêu chí | Đánh giá |
|---|---|
| **Khả thi?** | ✅ **CÓ** — nhưng **chỉ với Page đã kết nối** |
| **API endpoint** | `GET /{page-id}/feed?fields=id,message,created_time&limit=25` |
| **Authentication** | `page_access_token` + quyền `pages_read_engagement` |
| **Auto-sync** | Cron job định kỳ (mỗi 1-6 giờ) gọi `/feed` → so sánh post mới → import RAG |
| **Hạn chế quan trọng** | ❌ **Không thể crawl Page của người khác** (Page Public Content Access cần App Review của Meta) |

**Kịch bản thực tế:**

| Kịch bản | Khả thi? | Giải pháp |
|---|---|---|
| Tenant crawl Page **của chính mình** | ✅ Có | Dùng `page_access_token` hiện tại |
| Tenant crawl Page **đối tác/trường** | ⚠️ Khó | Cần Page đó cấp token hoặc App Review |
| Scraping (không dùng API) | ❌ Không | Vi phạm ToS Meta, bị block |

### 9.3 Flow đề xuất cho Facebook Content Ingestion

```
1. Tenant nhập URL bài viết cụ thể
   → Parse fbid/post_id từ URL
   → Gọi Graph API GET /{post_id}
   → Lấy message + attachments
   → Import text vào RAG Corpus

2. Tenant bật "Auto-sync Page" (Page đã kết nối)
   → Cron job mỗi 6h: GET /{page_id}/feed?since=last_sync
   → Filter bài viết mới
   → Import text vào RAG Corpus
   → Cập nhật last_sync timestamp
```


