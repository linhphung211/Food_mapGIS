<div align="center">

# 🍜 Food Map GIS — Việt Nam

**Ứng dụng bản đồ ẩm thực Việt Nam với tích hợp GIS đầy đủ**

![Tech Stack](https://img.shields.io/badge/Backend-Spring%20Boot%203-6DB33F?style=for-the-badge&logo=spring)
![Java](https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?style=for-the-badge&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript)
![Leaflet](https://img.shields.io/badge/Map-Leaflet.js-199900?style=for-the-badge&logo=leaflet)

</div>

---

## 📖 Giới thiệu

**Food Map GIS** là ứng dụng web bản đồ ẩm thực cho phép người dùng khám phá, đánh giá quán ăn trên bản đồ tương tác. Dự án tích hợp **GIS thực sự** (PostGIS + Leaflet + GeoServer WMS) để hiển thị vị trí quán ăn theo toạ độ địa lý chuẩn WGS84.

### ✨ Tính năng chính

**Dành cho người dùng (User)**
- 🗺️ Xem bản đồ quán ăn tương tác (Leaflet.js + OpenStreetMap)
- 🔥 Chuyển đổi giữa **bản đồ điểm marker** và **heatmap mật độ**
- 🔍 Tìm kiếm địa điểm, lọc quán ăn theo danh mục
- 🏆 Xem **Top 10 quán ăn được đánh giá cao nhất**
- ⭐ Đọc và viết đánh giá (review) cho quán ăn
- 👤 Quản lý profile cá nhân (avatar, email, ngày sinh)
- 🔐 Xác thực OTP qua Email khi đăng ký / cập nhật email
- 🖥️ **Single-device login** — tự động đăng xuất khi đăng nhập thiết bị khác

**Dành cho chủ quán (Merchant)**
- 📍 Thêm / sửa / xoá quán ăn trực tiếp trên bản đồ (click để chọn tọa độ)
- 🖼️ Upload nhiều ảnh cho quán ăn (lưu trên Supabase S3)
- 💬 Xem và phản hồi các bình luận của khách hàng
- 📊 Xem thống kê đánh giá (avg rating, tổng số review)
- 🗂️ Quản lý danh sách quán của mình

---

## 🏗️ Kiến trúc tổng thể

```
Food_mapGIS/
│
├── front-end/
│   ├── user/                    ← Giao diện người dùng (HTML/CSS/JS)
│   └── merchant/                ← Dashboard chủ quán (HTML/CSS/JS)
│
├── back-end/                    ← Backend cũ (Django 6 + DRF) – để tham khảo
│
└── back-end-spring/             ← Backend mới (Spring Boot 3) ✅ ACTIVE
```

### Sơ đồ kiến trúc

```
                    ┌──────────────────────────────────────┐
                    │           FRONTEND (Browser)          │
                    │                                      │
                    │   [User App]        [Merchant App]   │
                    │   Leaflet.js        Leaflet.js        │
                    │   Vanilla JS        Vanilla JS        │
                    └─────────────┬────────────────────────┘
                                  │ REST API (HTTP/JSON)
                                  │ WebSocket (STOMP)
                                  ▼
                    ┌─────────────────────────────────────┐
                    │         SPRING BOOT 3 (Port 8000)   │
                    │                                     │
                    │  ┌─────────┐  ┌──────────────────┐ │
                    │  │  JWT    │  │  REST Controllers │ │
                    │  │ Filter  │  │  /api/users/      │ │
                    │  └────┬────┘  │  /api/storefronts/│ │
                    │       │       │  /api/reviews/    │ │
                    │       │       └──────────────────┘ │
                    │  ┌────▼────────────────────────┐   │
                    │  │      Spring Security         │   │
                    │  └────┬────────────────────────┘   │
                    └───────┼─────────────────────────────┘
                            │
              ┌─────────────┼──────────────────┐
              ▼             ▼                  ▼
    ┌──────────────┐  ┌──────────┐    ┌──────────────┐
    │  PostgreSQL  │  │  Redis   │    │  Supabase S3 │
    │  + PostGIS   │  │  (OTP,   │    │  (Ảnh, file) │
    │  (Dữ liệu)   │  │  Cache)  │    │              │
    └──────────────┘  └──────────┘    └──────────────┘
              │
    ┌─────────▼────────┐
    │    GeoServer     │
    │  (WMS ranh giới  │
    │    Cầu Giấy)     │
    └──────────────────┘
```

---

## 🛠️ Tech Stack

### Backend (Spring Boot — `back-end-spring/`)

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Framework | Spring Boot 3.3.5 | Java 21 LTS |
| Database | PostgreSQL 14+ + PostGIS | Hibernate Spatial + JTS |
| ORM | Spring Data JPA | Giữ nguyên schema Django |
| Security | Spring Security + JJWT | Stateless JWT |
| Cache / OTP | Spring Data Redis + Lettuce | OTP 5 phút |
| Scheduler | `@Scheduled` (built-in) | Thay Celery Beat |
| WebSocket | Spring STOMP | Thay Django Channels |
| File Storage | AWS SDK v2 | Supabase S3-compatible |
| API Docs | SpringDoc OpenAPI | Swagger UI tại `/api/swagger/` |
| Build | Maven 3.9 | |
| Container | Docker + Docker Compose | 2 containers: app + redis |

### Frontend (`front-end/`)

| Thành phần | Công nghệ |
|---|---|
| Bản đồ | Leaflet.js 1.9.4 |
| Tile Layer | OpenStreetMap |
| Ranh giới hành chính | GeoServer WMS |
| Heatmap | Leaflet.heat plugin |
| Font | Google Fonts (Comfortaa) |
| Icons | Font Awesome 6 |
| Logic | Vanilla JavaScript (ES Modules) |
| Style | Vanilla CSS |

### Hạ tầng

| Dịch vụ | Dùng cho |
|---|---|
| PostgreSQL + PostGIS | Lưu trữ dữ liệu quán ăn (geometry Point WGS84) |
| Redis | Cache OTP, theo dõi session |
| GeoServer | Phục vụ WMS ranh giới quận Cầu Giấy |
| Supabase S3 | Lưu trữ ảnh avatar và ảnh quán ăn |
| Gmail SMTP | Gửi OTP qua email |

---

## 📁 Cấu trúc chi tiết

```
Food_mapGIS/
├── front-end/
│   ├── user/
│   │   ├── index.html          ← Trang bản đồ chính (User)
│   │   ├── login.html          ← Đăng nhập
│   │   ├── register.html       ← Đăng ký
│   │   ├── profile.html        ← Trang cá nhân
│   │   ├── api.js              ← API client (fetch wrapper + JWT auto-refresh)
│   │   ├── script.js           ← Logic bản đồ, heatmap, review
│   │   └── style.css
│   │
│   └── merchant/
│       ├── index.html          ← Dashboard Merchant (bản đồ + quản lý quán)
│       ├── login.html
│       ├── register.html
│       ├── api.js              ← API client (access token lưu in-memory)
│       ├── app.js              ← Logic đầy đủ: CRUD quán, reply review...
│       └── style.css
│
├── back-end-spring/            ← ✅ Backend chính (Spring Boot 3)
│   ├── pom.xml
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   └── src/main/java/com/foodmap/
│       ├── FoodmapApplication.java
│       ├── config/             ← Security, S3, WebSocket, OpenAPI
│       ├── security/           ← JWT provider, filter, UserDetailsService
│       ├── common/             ← GlobalExceptionHandler
│       ├── user/               ← User, UserSession, OTP, Auth
│       ├── storefront/         ← Category, FoodPlace (GIS), Images
│       ├── review/             ← Review, ReviewReply
│       └── websocket/          ← Session tracking qua STOMP
│
└── back-end/                   ← 📦 Backend cũ (Django 6) – tham khảo
    ├── pyproject.toml
    ├── docker-compose.yml
    └── footmap_project/
        ├── core/               ← Django settings, URLs, ASGI, Celery
        └── apps/
            ├── user/           ← User model, JWT views, WebSocket consumer
            ├── storefront/     ← FoodPlace (PointField), Category, Images
            └── review/         ← Review, ReviewReply, signals
```

---

## 🗄️ Database Schema

```
┌──────────────┐       ┌─────────────────────────┐
│    "user"    │       │      thongtinquanan      │
│──────────────│       │─────────────────────────│
│ id (PK)      │◄──┐   │ id (PK)                 │
│ username     │   │   │ geom  (Point, SRID=4326) │  ← PostGIS
│ email        │   │   │ name                    │
│ password     │   │   │ address                 │
│ role         │   │   │ category_id (FK)        │──► category
│ avatar       │   └───│ owner_id (FK)           │
│ birthday     │       │ avg_rating              │
│ is_active    │       │ total_reviews           │
└──────┬───────┘       └──────────────┬──────────┘
       │                              │
       │                   ┌──────────┴──────┐
┌──────▼───────┐           │  food_place_image│
│ user_session │           │─────────────────│
│──────────────│           │ id (PK)         │
│ session_id   │           │ food_place_id   │
│ user_id (FK) │           │ image (URL S3)  │
│ refresh_token│           └─────────────────┘
│ user_agent   │
│ is_revoked   │    ┌─────────┐      ┌──────────────┐
│ expired_at   │    │ review  │      │ review_reply │
└──────────────┘    │─────────│      │──────────────│
                    │ id (PK) │◄─────│ review_id    │
  ┌─────────┐       │ user_id │      │ merchant_id  │
  │category │       │fp_id    │      │ content      │
  │─────────│       │ rating  │      └──────────────┘
  │ id (PK) │       │ comment │
  │ name    │       └─────────┘
  │icon_mark│
  └─────────┘
```

---

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống

- **Java 21** (JDK)
- **Maven 3.9+** (hoặc dùng `./mvnw` đã đính kèm)
- **Docker & Docker Compose**
- **PostgreSQL 14+** với extension **PostGIS**
- **Redis 7+**
- *(Tuỳ chọn)* **GeoServer** để hiển thị ranh giới hành chính

---

### 1. Clone dự án

```bash
git clone https://github.com/linhphung211/Food_mapGIS.git
cd Food_mapGIS
```

---

### 2. Cài đặt Database

```sql
-- Kết nối PostgreSQL và tạo database
CREATE DATABASE foodmap;
\c foodmap

-- Bật extension PostGIS (bắt buộc cho GIS)
CREATE EXTENSION IF NOT EXISTS postgis;
```

Sau đó import dữ liệu GIS ban đầu (nếu có file dump):
```bash
psql -U postgres -d foodmap < dump.sql
```

---

### 3. Chạy Backend (Spring Boot)

```bash
cd back-end-spring/

# Sao chép và điền thông tin môi trường
cp .env.example .env
```

Mở file `.env` và điền các giá trị:

```dotenv
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=foodmap
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost

# JWT (tối thiểu 64 ký tự)
JWT_SECRET_KEY=your-very-long-secret-key-at-least-64-characters

# Email (Gmail App Password)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Supabase S3
SUPABASE_S3_ACCESS_KEY=...
SUPABASE_S3_SECRET_KEY=...
SUPABASE_S3_ENDPOINT=https://your-project.supabase.co/storage/v1/s3
SUPABASE_PROJECT_ID=your-project-id
```

#### Chạy bằng Docker (khuyến nghị)

```bash
docker-compose up --build
# Backend khởi động tại: http://localhost:8000
```

#### Chạy trực tiếp (cần Java 21 + Maven)

```bash
./mvnw spring-boot:run
```

---

### 4. Chạy Frontend

Frontend là **Vanilla HTML/JS** — không cần build step.

#### User App
```bash
cd front-end/user/

# Dùng VS Code Live Server (port 5500)
# hoặc
python -m http.server 5500
# Mở: http://localhost:5500
```

#### Merchant App
```bash
cd front-end/merchant/

# Dùng VS Code Live Server (port 3000)
# hoặc
python -m http.server 3000
# Mở: http://localhost:3000
```

> **Lưu ý:** `BASE_URL` trong `api.js` mặc định trỏ tới `http://localhost:8000`. Thay đổi nếu backend chạy ở host/port khác.

---

### 5. Cài đặt GeoServer *(tuỳ chọn)*

GeoServer cần thiết để hiển thị lớp WMS ranh giới quận Cầu Giấy.

1. Tải GeoServer tại: https://geoserver.org/download/
2. Chạy GeoServer tại port `8080`
3. Import shapefile ranh giới Cầu Giấy vào workspace `dacn`, layer name `cau_giay`

Nếu không có GeoServer, bản đồ vẫn hoạt động — chỉ thiếu lớp ranh giới hành chính.

---

## 📡 API Reference

### Base URL
```
http://localhost:8000
```

### Swagger UI (Interactive Docs)
```
http://localhost:8000/api/swagger/
```

### Endpoints chính

#### 👤 Users

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/api/users/register/` | Đăng ký tài khoản | ❌ |
| `POST` | `/api/users/login/` | Đăng nhập → JWT | ❌ |
| `POST` | `/api/users/logout/` | Đăng xuất | ✅ |
| `GET` | `/api/users/me/` | Thông tin cá nhân | ✅ |
| `PATCH` | `/api/users/update_profile/` | Cập nhật profile | ✅ |
| `POST` | `/api/users/send-otp/` | Gửi mã OTP qua email | ❌ |
| `POST` | `/api/users/verify-otp/` | Xác thực OTP | ✅ |
| `POST` | `/api/users/token/refresh/` | Làm mới access token | ❌ |

#### 🏪 Storefronts

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/api/storefronts/categories/` | Danh sách danh mục | ❌ |
| `GET` | `/api/storefronts/categories/{id}/` | Chi tiết danh mục | ❌ |
| `GET` | `/api/storefronts/foodplaces/` | Danh sách quán ăn | ❌ |
| `GET` | `/api/storefronts/foodplaces/?format=geojson` | GeoJSON cho bản đồ | ❌ |
| `GET` | `/api/storefronts/foodplaces/?manage=true` | Quán của merchant đang login | ✅ |
| `GET` | `/api/storefronts/foodplaces/?category=Nhà+Hàng` | Lọc theo danh mục | ❌ |
| `GET` | `/api/storefronts/foodplaces/top_rated/` | Top 10 quán đánh giá cao | ❌ |
| `GET` | `/api/storefronts/foodplaces/{id}/` | Chi tiết quán ăn | ❌ |
| `POST` | `/api/storefronts/foodplaces/` | Tạo quán mới (Merchant) | ✅ |
| `PUT/PATCH` | `/api/storefronts/foodplaces/{id}/` | Cập nhật quán | ✅ |
| `DELETE` | `/api/storefronts/foodplaces/{id}/` | Xóa quán | ✅ |
| `POST` | `/api/storefronts/foodplaces/{id}/upload_image/` | Upload ảnh quán | ✅ |

#### ⭐ Reviews

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/api/reviews/` | Danh sách review | ✅ |
| `GET` | `/api/reviews/?food_place_id={id}` | Review của 1 quán | ✅ |
| `POST` | `/api/reviews/` | Viết đánh giá | ✅ |
| `PUT/PATCH` | `/api/reviews/{id}/` | Sửa đánh giá | ✅ |
| `DELETE` | `/api/reviews/{id}/` | Xóa đánh giá | ✅ |
| `POST` | `/api/reviews/{id}/reply/` | Merchant phản hồi | ✅ |
| `PATCH` | `/api/reviews/{id}/reply/` | Sửa phản hồi | ✅ |
| `DELETE` | `/api/reviews/{id}/reply/` | Xóa phản hồi | ✅ |

### Xác thực

Tất cả endpoints yêu cầu auth cần header:
```
Authorization: Bearer <access_token>
```

---

## 🔒 Bảo mật

- **JWT Stateless** — Access token (1 giờ) + Refresh token (7 ngày)
- **Single-device login** — Ngăn đăng nhập đồng thời trên nhiều thiết bị
- **WebSocket session tracking** — Tự động revoke session khi mất kết nối
- **OTP qua Email** — Xác thực email bằng mã 6 số (TTL 5 phút, lưu Redis)
- **Role-based access** — Phân quyền rõ ràng: `user` vs `merchant`
- **Merchant Dashboard** — Access token lưu in-memory (không localStorage) để chống XSS
- **CORS** — Whitelist chỉ các origin đã cấu hình

---

## 🧪 Chạy Tests

```bash
cd back-end-spring/
./mvnw test
```

Test coverage bao gồm:
- `JwtTokenProviderTest` — Tạo và xác thực JWT
- `OtpServiceTest` — Gửi và xác thực OTP qua Redis
- `ReviewServiceTest` — Tính toán lại avg_rating sau thay đổi review

---

## 🗺️ Tính năng GIS nổi bật

### 1. Bản đồ điểm (Marker Map)
Hiển thị tất cả quán ăn theo toạ độ thực tế (SRID=4326) bằng Leaflet marker. Mỗi marker có popup hiển thị tên, địa chỉ, đánh giá.

### 2. Heatmap mật độ
Chuyển đổi sang chế độ heatmap để xem mật độ quán ăn theo khu vực (dùng `leaflet.heat`).

### 3. GeoJSON streaming
Endpoint `/api/storefronts/foodplaces/?format=geojson` trả về chuẩn GeoJSON `FeatureCollection` để Leaflet vẽ trực tiếp lên bản đồ.

### 4. GeoServer WMS Layer
Hiển thị lớp ranh giới hành chính quận Cầu Giấy từ GeoServer WMS phủ lên OpenStreetMap.

### 5. Chọn toạ độ qua click bản đồ
Merchant click trực tiếp lên bản đồ để chọn vị trí khi tạo/cập nhật quán — toạ độ (lng, lat) được gửi dưới dạng GeoJSON Point.

---

## 📊 So sánh Backend cũ vs mới

| | Django (cũ) | Spring Boot (mới) |
|---|---|---|
| **Runtime** | Python 3.12 | Java 21 |
| **Framework** | Django 6 + DRF | Spring Boot 3.3 |
| **Containers** | 4 (web + 2 celery + redis) | 2 (app + redis) |
| **Scheduler** | Celery Beat (riêng) | `@Scheduled` (built-in) |
| **WebSocket** | Daphne + Django Channels | Spring STOMP |
| **GIS** | GeoDjango + GDAL (nặng) | Hibernate Spatial + JTS |
| **Build thời gian** | ~120s (GDAL compile) | ~45s (JAR) |
| **Memory** | ~350MB | ~200MB |

---

## 🤝 Đóng góp

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'feat: thêm tính năng X'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

---

## 📄 License

[MIT License](LICENSE)

---

<div align="center">

Made with ❤️ by **linhphung211**

</div>