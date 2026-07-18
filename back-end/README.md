# Foodmap Backend — Spring Boot

Đây là phiên bản refactor backend của Foodmap từ Django sang **Spring Boot 3**.

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Spring Boot 3.3.5 + Java 21 |
| Database | PostgreSQL + PostGIS (Hibernate Spatial) |
| Auth | Spring Security + JWT (JJWT) |
| Cache/OTP | Spring Data Redis + Lettuce |
| Scheduler | Spring `@Scheduled` (thay Celery Beat) |
| WebSocket | Spring WebSocket + STOMP (thay Django Channels) |
| File Storage | AWS SDK v2 (Supabase S3-compatible) |
| API Docs | SpringDoc OpenAPI (Swagger UI) |
| Build | Maven 3.9 |

## Cấu trúc thư mục

```
src/main/java/com/foodmap/
├── FoodmapApplication.java
├── config/              # SecurityConfig, S3Config, WebSocketConfig, OpenApiConfig
├── security/            # JwtTokenProvider, JwtAuthenticationFilter, CustomUserDetailsService
├── common/              # GlobalExceptionHandler
├── user/
│   ├── entity/          # User, UserSession
│   ├── repository/
│   ├── dto/             # RegisterRequest, LoginRequest, UserProfileResponse...
│   ├── service/         # UserService, OtpService, S3UploadService
│   ├── controller/      # UserController (/api/users/*)
│   └── scheduler/       # UserCleanupScheduler (thay Celery Beat)
├── storefront/
│   ├── entity/          # Category, FoodPlace (PostGIS Point), FoodPlaceImage
│   ├── repository/
│   ├── dto/
│   ├── service/         # FoodPlaceService
│   └── controller/      # CategoryController, FoodPlaceController
├── review/
│   ├── entity/          # Review, ReviewReply
│   ├── repository/
│   ├── dto/
│   ├── service/         # ReviewService (tự tính avg_rating)
│   └── controller/      # ReviewController
└── websocket/           # LoginControlHandler (thay Django Channels Consumer)
```

## Chạy local

### 1. Yêu cầu

- Java 21
- Maven 3.9+
- PostgreSQL 14+ với extension PostGIS
- Redis 7+

### 2. Setup database

```sql
-- Cài PostGIS extension trong database của bạn
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. Cấu hình environment

```bash
cp .env.example .env
# Điền thông tin database, Redis, email, Supabase S3
```

### 4. Chạy ứng dụng

```bash
./mvnw spring-boot:run
```

Hoặc với Docker:

```bash
docker-compose up --build
```

### 5. API Documentation

Sau khi khởi động, truy cập:
- Swagger UI: http://localhost:8000/api/swagger/
- API Schema: http://localhost:8000/api/schema/

## API Endpoints

Tất cả endpoints giữ nguyên URL pattern từ Django để frontend không cần thay đổi:

| Method | URL | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/users/register/` | Đăng ký | ❌ |
| POST | `/api/users/login/` | Đăng nhập → JWT | ❌ |
| POST | `/api/users/logout/` | Đăng xuất | ✅ |
| GET | `/api/users/me/` | Thông tin cá nhân | ✅ |
| PATCH | `/api/users/update_profile/` | Cập nhật profile | ✅ |
| POST | `/api/users/send-otp/` | Gửi OTP | ❌ |
| POST | `/api/users/verify-otp/` | Xác thực OTP | ✅ |
| GET | `/api/storefronts/categories/` | Danh sách danh mục | ❌ |
| GET | `/api/storefronts/foodplaces/` | Danh sách quán ăn | ❌ |
| GET | `/api/storefronts/foodplaces/?format=geojson` | GeoJSON cho bản đồ | ❌ |
| GET | `/api/storefronts/foodplaces/top_rated/` | Top 10 quán | ❌ |
| POST | `/api/storefronts/foodplaces/` | Tạo quán (Merchant) | ✅ |
| GET/POST | `/api/reviews/` | Danh sách / Tạo review | ✅ |
| PUT/PATCH/DELETE | `/api/reviews/{id}/` | Sửa/Xóa review | ✅ |
| POST/PATCH/DELETE | `/api/reviews/{id}/reply/` | Reply của Merchant | ✅ |

## Chạy tests

```bash
./mvnw test
```

## Điểm khác biệt so với Django

| Tính năng | Django | Spring Boot |
|---|---|---|
| Scheduler | Celery + celery-beat (3 containers) | `@Scheduled` trong app (1 container) |
| Signal (update rating) | `post_save` / `post_delete` Django signal | Gọi trực tiếp `recalculateRating()` trong service |
| WebSocket | Daphne + Django Channels (ASGI) | Spring WebSocket + STOMP |
| OTP storage | `django.core.cache` (Redis) | `StringRedisTemplate` |
| GIS | GeoDjango + GDAL | Hibernate Spatial + JTS Topology Suite |
