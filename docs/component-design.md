# Tài liệu thiết kế Component (Component Design)

Tài liệu này mô tả chi tiết cách thức hoạt động và thiết kế của các domain component chính trong hệ thống SaaS Chatbot Platform. 

---

## 1. Knowledge Base Component (`src/knowledgeBase.js`)

**Nhiệm vụ:**
Quản lý tài liệu tri thức (Documents) của từng Tenant. Thay vì tự xử lý chunking/embedding, component này đóng vai trò điều phối việc đẩy dữ liệu lên **Vertex AI RAG Engine**.

**Luồng hoạt động (Upload & Process Document):**
1. **Kiểm tra định dạng:** Hỗ trợ các file `.pdf`, `.txt`, `.md`, `.csv`.
2. **Lưu trữ vật lý:** File được lưu tạm vào thư mục riêng của Tenant: `uploads/{tenantId}/`. 
3. **Đẩy lên Vertex AI:** Gọi `vertexRag.uploadFile` để chuyển file sang Vertex AI RAG Engine. Google sẽ tự động thực hiện trích xuất văn bản, cắt nhỏ (chunking), tạo Vector nhúng (Embedding) và lưu trữ vào Vector Database (managed).
4. **Lưu Resource Name:** Lưu lại `rag_file_name` vào bảng `documents` trong SQLite để quản lý việc truy vấn và xóa.
5. **Cập nhật Database:** Đánh dấu document đã sẵn sàng.

---

## 2. Vertex AI RAG Wrapper (`src/vertexRag.js`)

**Nhiệm vụ:**
Lớp trừu tượng (Abstraction Layer) kết nối với Google Cloud REST API. Thay thế hoàn toàn cho `vectorStore.js` cũ.

**Chức năng chính:**
- `createCorpus`: Tự động khởi tạo Corpus khi tenant upload tài liệu lần đầu.
- `uploadFile`: Thực hiện upload file qua multipart/form-data lên Google Cloud.
- `retrieveContexts`: Tìm kiếm ngữ cảnh dựa trên câu hỏi người dùng.
- `deleteFile`: Xóa tài liệu khỏi Vertex AI khi người dùng yêu cầu trên giao diện.

---

## 3. Tenant Manager Component (`src/tenantManager.js`)

**Nhiệm vụ:**
Điều phối luồng xử lý AI, phân tách dữ liệu giữa các Tenants và kiểm soát quota sử dụng.

**Luồng sinh câu trả lời AI (Generate Response):**
1. **Load Instance:** Lấy thông tin Tenant (bao gồm `corpus_name`) từ Cache hoặc Database.
2. **Kiểm tra Quota:** Chặn phản hồi nếu số lượng tokens đã dùng vượt quá hạn mức.
3. **RAG (Retrieval-Augmented Generation):**
   - Gọi `vertexRag.retrieveContexts` với `corpus_name` của Tenant.
   - Vertex AI thực hiện Semantic Search và trả về danh sách các đoạn văn bản (contexts) liên quan nhất.
4. **Gọi AI:** Gộp các context thành đoạn văn bản và gửi cùng `System Prompt` + `User Message` lên Gemini API qua `ai.js`.
5. **Cập nhật Quota:** Tính toán token và lưu lại vào database.

---

## 4. Webhook & Messenger Component (`src/webhook.js` & `src/messenger.js`)

**Nhiệm vụ:**
Xử lý tương tác hai chiều với Facebook Messenger qua một điểm (Single Endpoint) duy nhất cho toàn bộ hệ thống Multi-Tenant.

**Định tuyến theo Page ID:**
Khi có tin nhắn đến, hệ thống dựa vào `page_id` để xác định Tenant, từ đó lấy đúng `page_access_token` và `corpus_name` để xử lý.

---

## 5. AI Factory Component (`src/ai.js`)

**Nhiệm vụ:**
Giao tiếp trực tiếp với Google Generative AI SDK để sinh nội dung văn bản (Gemini 1.5 Flash).

**Lưu ý:** Chức năng tạo Embedding độc lập đã được loại bỏ vì Vertex AI RAG Engine đã tự đảm nhận phần này trong pipeline RAG.

---

## 6. Pipeline RAG Pipeline — Vertex AI Edition

Hệ thống đã chuyển từ việc tự quản lý Vector Store sang kiến trúc **Managed RAG**:
- **Tốc độ:** Tìm kiếm ngữ cảnh nhanh hơn nhờ hạ tầng của Google.
- **Chính xác:** Tận dụng khả năng parsing PDF/Layout tiên tiến của Google.
- **Bảo trì:** Không cần bảo trì các model embedding cục bộ hay lo lắng về việc đồng bộ RAM cho Vector Store.
