# UC-DOC-04 — Quét đối chiếu tài liệu dự phòng

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-DOC-04 |
| **Use Case Name** | Quét đối chiếu tài liệu dự phòng |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Hệ thống (tác vụ định kỳ) |
| **Secondary Actor** | Google Drive |
| **Priority** | Medium |
| **Frequency of Use** | Tự động mỗi giờ (hoặc theo cấu hình) |
| **Nguồn** | US-DOC-02 (AC-5) |

**Description:** Thông báo webhook có thể bị mất; cần một lưới an toàn để danh sách tài liệu web không lệch với Drive lâu dài. Use case: một tác vụ định kỳ thưa quét toàn bộ thư mục dự án, đối chiếu với danh sách web và bổ sung / gỡ cho khớp. Kết thúc: danh sách tài liệu web của mọi dự án khớp với Drive.

**Preconditions:**
1. Có ít nhất một dự án với thư mục tài liệu Drive.

**Postconditions (thành công):**
1. Với mỗi dự án, danh sách tài liệu web trùng khớp nội dung thư mục Drive tại thời điểm quét.
2. Nhật ký ghi số tệp được thêm / gỡ cho từng dự án.

## Normal Course of Events
1. Tác vụ định kỳ được kích hoạt theo lịch.
2. Hệ thống lấy danh sách dự án có thư mục Drive.
3. Với mỗi dự án, hệ thống đọc nội dung thư mục Drive và danh sách tài liệu web hiện có.
4. Hệ thống thêm bản ghi cho tệp có ở Drive mà thiếu ở web, gỡ bản ghi cho tệp còn ở web mà mất ở Drive.
5. Hệ thống ghi nhật ký kết quả từng dự án.

## Alternative Courses
- **UC-DOC-04.AC.1** — Tại bước 3, nếu một dự án không truy cập được thư mục Drive, hệ thống bỏ qua dự án đó, giữ nguyên danh sách web của nó, ghi cảnh báo và tiếp tục dự án kế tiếp.

## Exceptions
- **UC-DOC-04.EX.1 — Quá thời gian chạy:** Nếu số dự án lớn khiến lần chạy vượt giới hạn thời gian → hệ thống xử lý dở đến đâu lưu đến đó và tiếp tục ở lần chạy sau, không đặt lại từ đầu. Trạng thái cuối: đồng bộ dần qua nhiều lần chạy.

## Includes
- —

## Special Requirements
- Chạy trên Node runtime.
- Tần suất đủ thưa để không chạm giới hạn hạn mức API Drive.

## Assumptions
1. Đây là cơ chế bù, không thay thế UC-DOC-02.
2. Chấp nhận độ trễ tối đa bằng chu kỳ quét cho các thay đổi bị mất webhook.

## Notes and Issues
- —
