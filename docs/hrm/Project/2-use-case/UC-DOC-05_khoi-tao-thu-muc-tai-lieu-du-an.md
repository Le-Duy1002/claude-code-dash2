# UC-DOC-05 — Khởi tạo thư mục tài liệu cho dự án

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-DOC-05 |
| **Use Case Name** | Khởi tạo thư mục tài liệu cho dự án |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý dự án (Hoàng) |
| **Secondary Actor** | Google Drive |
| **Priority** | Medium |
| **Frequency of Use** | 1 lần khi tạo dự án; thêm vài lần khi tạo lại do lỗi trước đó |
| **Nguồn** | US-PRJ-01 (AC-4) |

**Description:** Mỗi dự án cần một thư mục Drive riêng để tài liệu không lẫn giữa các dự án; phạm vi `drive.file` chỉ cho ghi vào thư mục do ứng dụng tự tạo. Use case tạo một thư mục con trong thư mục gốc của ứng dụng, liên kết id thư mục với dự án và đăng ký kênh theo dõi thay đổi cho thư mục đó. Kết thúc: dự án có thư mục tài liệu Drive liên kết và đang được theo dõi thay đổi.

**Preconditions:**
1. Bản ghi dự án đã tồn tại.
2. Cấu hình OAuth chủ thư mục của ứng dụng còn hiệu lực.
3. Dự án chưa có thư mục tài liệu liên kết.

**Postconditions (thành công):**
1. Một thư mục con mang tên dự án được tạo trong thư mục gốc của ứng dụng.
2. Id thư mục được lưu vào bản ghi dự án; cờ "chưa có thư mục" được gỡ.
3. Một kênh theo dõi thay đổi được đăng ký cho thư mục đó.

## Normal Course of Events
1. Use case được gọi bởi UC-PRJ-01, hoặc quản lý chọn "Tạo thư mục tài liệu cho dự án".
2. Hệ thống tạo một thư mục con trong thư mục gốc của ứng dụng bằng OAuth chủ thư mục.
3. Hệ thống lưu id thư mục vào bản ghi dự án và gỡ cờ "chưa có thư mục tài liệu".
4. Hệ thống đăng ký kênh theo dõi thay đổi cho thư mục vừa tạo.
5. Hệ thống thông báo thư mục tài liệu đã sẵn sàng.

## Alternative Courses
- **UC-DOC-05.AC.1** — Tại bước 4, nếu đăng ký kênh theo dõi thất bại nhưng thư mục đã tạo, hệ thống vẫn giữ liên kết thư mục (bước 3), ghi cảnh báo, và để UC-DOC-03 đăng ký kênh ở lần chạy sau.

## Exceptions
- **UC-DOC-05.EX.1 — Không tạo được thư mục:** Tại bước 2, nếu Drive từ chối hoặc lỗi → hệ thống không thay đổi bản ghi dự án, giữ cờ "chưa có thư mục tài liệu", thông báo lỗi cho quản lý. Trạng thái cuối: dự án vẫn chưa có thư mục.

## Includes
- —

## Special Requirements
- Chạy trên Node runtime với OAuth chủ thư mục.
- Tên thư mục xử lý được trùng tên dự án (thêm hậu tố phân biệt nếu cần).

## Assumptions
1. Thư mục gốc của ứng dụng đã được `scripts/create-drive-folder.mjs` tạo sẵn.
2. Mỗi dự án đúng một thư mục, không lồng nhiều cấp.

## Notes and Issues
- **[TBD-1]** Xoá dự án có xoá luôn thư mục Drive không? | vòng sau
