# Hướng dẫn Deploy FBBot lên GCP (Compute Engine - VM)

Hướng dẫn này giúp bạn triển khai ứng dụng trực tiếp lên máy ảo (VM) trên Google Cloud Platform bằng cách sử dụng Git và PM2.

## 1. Chuẩn bị trên máy Local (Máy của bạn)

1.  **Đẩy code lên GitHub/GitLab**: Đảm bảo toàn bộ code (ngoại trừ file `.env` và thư mục `node_modules`) đã được push lên một repository private.
2.  **Lưu ý về SQLite**: File database `data/app.db` hiện tại trên máy local sẽ **KHÔNG** được đẩy lên Git. VM sẽ tự tạo database mới hoặc bạn có thể copy thủ công qua SSH sau.

## 2. Tạo Instance trên GCP Compute Engine

1.  Truy cập [GCP Console](https://console.cloud.google.com/compute/instances).
2.  Nhấn **Create Instance**.
3.  Cấu hình đề xuất:
    *   **Machine type**: `e2-micro` (Miễn phí nếu ở vùng us-west1, us-central1) hoặc `e2-small`.
    *   **Boot disk**: Ubuntu 22.04 LTS hoặc 24.04 LTS.
    *   **Firewall**: Check chọn **Allow HTTP traffic** và **Allow HTTPS traffic**.
4.  Nhấn **Create**.

## 3. Thiết lập SSH để Agent (Antigravity) có thể truy cập

Để tôi có thể thay bạn cài đặt trực tiếp trên VM, bạn cần cấu hình để máy local của bạn có thể SSH vào VM. Có 2 cách:

### Cách 1: Sử dụng `gcloud` (Khuyên dùng)
Bạn cần cài đặt [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) trên máy local và đã login.
Sau khi tạo VM, bạn chạy lệnh sau trên máy local:
```bash
gcloud compute ssh [INSTACE_NAME] --zone [ZONE]
```
Nếu lệnh này chạy thành công và bạn vào được VM, tôi có thể sử dụng `gcloud` để thay bạn làm việc.

### Cách 2: Sử dụng SSH Key truyền thống
1. **Tạo SSH Key** trên máy local (nếu chưa có): `ssh-keygen -t rsa`
2. **Thêm Public Key vào GCP**:
   * Vào chi tiết VM -> Edit.
   * Kéo xuống phần **SSH Keys**.
   * Nhấn **Add Item** và paste nội dung file `.pub` của bạn vào.
3. **Cung cấp thông tin cho tôi**:
   * Public IP của VM.
   * Username (thường là tên máy local của bạn).

---

## 4. Thiết lập Môi trường trên VM (Agent sẽ thực hiện)

Sau khi VM đã tạo xong, nhấn nút **SSH** để mở terminal của VM và chạy các lệnh sau:

### Cập nhật hệ thống
```bash
sudo apt update && sudo apt upgrade -y
```

### Cài đặt Node.js (Version 20+)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Cài đặt PM2 (Quản lý process)
```bash
sudo npm install -g pm2
```

## 4. Deploy Code

### Clone dự án
```bash
git clone https://github.com/USERNAME/REPOSITORY.git fbbot
cd fbbot
npm install --production
```

### Cấu hình Environment Variables
Tạo file `.env` trên server:
```bash
nano .env
```
Copy nội dung từ file `.env` local của bạn và paste vào đây. Lưu ý thay đổi `PORT=80` (hoặc để 3000 và dùng Nginx proxy).

## 5. Chạy ứng dụng với PM2

Sử dụng file `ecosystem.config.js` đã có sẵn trong dự án:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
*(Gõ lệnh startup theo hướng dẫn của PM2 để server tự chạy lại khi VM khởi động lại)*.

## 6. Mở Port trên GCP Firewall

Mặc dù đã check "Allow HTTP", nhưng app của bạn mặc định chạy port 3000 (hoặc port bất kỳ trong .env). Bạn cần tạo Firewall Rule mới:

### Bước 1: Thêm Network Tag vào VM
Để Firewall Rule biết áp dụng vào máy ảo nào, bạn cần gắn "nhãn" cho nó:
1.  Truy cập [GCP Compute Engine Instances](https://console.cloud.google.com/compute/instances).
2.  Nhấn vào **tên máy ảo** (ví dụ: `instance-1`).
3.  Nhấn nút **EDIT** ở thanh menu trên cùng.
4.  Kéo xuống phần **Network tags**.
5.  Gõ `fbbot-server` vào ô và nhấn Enter (nó sẽ hiện ra như một cái tag xanh).
6.  Kéo xuống cuối trang và nhấn **SAVE**.

### Bước 2: Tạo Firewall Rule
1.  Vào **VPC Network** -> **Firewall** (hoặc gõ Firewall vào thanh tìm kiếm trên cùng).
2.  Chọn **CREATE FIREWALL RULE**.
3.  **Name**: `allow-fbbot-3000`.
4.  **Targets**: Chọn `Specified target tags`.
5.  **Target tags**: Nhập `fbbot-server` (đúng cái tên bạn vừa gắn cho VM).
6.  **Source IPv4 ranges**: Nhập `0.0.0.0/0`.
7.  **Protocols and ports**: Chọn `Specified protocols and ports`, tích vào `TCP` và nhập `3000`.
8.  Nhấn **CREATE**.

## 7. Cài đặt Domain và SSL (HTTPS)

Vì Facebook Messenger yêu cầu Webhook phải có HTTPS, bạn cần thực hiện 3 bước sau:

### Bước 1: Trỏ Domain về IP của VM
1.  Truy cập trang quản lý DNS của domain bạn (vd: Cloudflare, Tenten, v.v.).
2.  Tạo một bản ghi **A record**:
    *   **Name**: `@` (hoặc tên subdomain vd: `bot`).
    *   **Value**: `34.9.136.241` (IP máy ảo của bạn).
3.  Chờ khoảng 5-10 phút để DNS cập nhật.

### Bước 2: Cấu hình Nginx làm Reverse Proxy
Nginx sẽ đón traffic ở port 80/443 và đẩy về port 3000 của App. Chạy lệnh sau trên VM:
```bash
sudo nano /etc/nginx/sites-available/fbbot
```
Paste nội dung sau (thay `yourdomain.com` bằng domain thật):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Sau đó kích hoạt cấu hình:
```bash
sudo ln -s /etc/nginx/sites-available/fbbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Bước 3: Chạy Certbot để lấy SSL miễn phí
Đây là "1 lệnh Certbot" mà tôi đã nhắc tới. Nó sẽ tự động biến HTTP thành HTTPS:
```bash
sudo certbot --nginx -d yourdomain.com
```
*   Nhập email của bạn khi được hỏi.
*   Chọn **Yes** để tự động redirect từ HTTP sang HTTPS.
*   Xong! Bây giờ bạn có thể truy cập `https://yourdomain.com`.

---

## 8. Cấu hình Google OAuth (Fix lỗi Access Blocked)

Sau khi có domain HTTPS, bạn phải khai báo với Google để được phép đăng nhập:

1.  Truy cập [Google Cloud Console -> API & Services -> Credentials](https://console.cloud.google.com/apis/credentials).
2.  Nhấn vào tên **OAuth 2.0 Client ID** mà bạn đang dùng cho dự án.
3.  Tại mục **Authorized JavaScript origins**, nhấn **ADD URI** và nhập:
    *   `https://yourdomain.com`
4.  Tại mục **Authorized redirect URIs**, nhấn **ADD URI** và nhập:
    *   `https://yourdomain.com/api/auth/google`
5.  Nhấn **SAVE**.
6.  **Lưu ý**: Có thể mất vài phút để Google cập nhật cấu hình mới.

---

## 9. Cấu hình Facebook Webhook

Để chatbot có thể nhận tin nhắn, bạn phải cập nhật URL mới cho Facebook:

1.  Truy cập [Meta for Developers](https://developers.facebook.com/) -> Chọn App của bạn.
2.  Tại menu bên trái, chọn **Messenger** -> **Settings**.
3.  Tìm phần **Webhooks**, nhấn **Edit** (hoặc Configure).
4.  **Callback URL**: Nhập `https://yourdomain.com/webhook`
5.  **Verify Token**: Nhập mã token bạn đã đặt trong file `.env` (biến `FB_VERIFY_TOKEN`).
6.  Nhấn **Verify and Save**.
7.  Đảm bảo bạn đã nhấn **Subscribe** cho các page cần thiết trong danh sách phía dưới.

---

## 10. Cách cập nhật Code sau này

Sau này mỗi khi bạn có code mới trên máy local:
1.  `git push` code lên GitHub.
2.  SSH vào VM và chạy:
```bash
cd ~/fbbot
git pull
npm install  # Nếu có cài thêm thư viện mới
pm2 reload hotel-chatbot-fb
```
App sẽ được cập nhật mà không bị downtime (gián đoạn).
