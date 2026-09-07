# UC-DOC-03 — Gia hạn kênh theo dõi thư mục Drive

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-DOC-03 |
| **Use Case Name** | Gia hạn kênh theo dõi thư mục Drive |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Hệ thống (tác vụ định kỳ) |
| **Secondary Actor** | Google Drive |
| **Priority** | Medium |
| **Frequency of Use** | Tự động mỗi ngày (hoặc mỗi vài giờ) |
| **Nguồn** | US-DOC-02 (AC-4) |

**Description:** Kênh theo dõi thay đổi của Drive sống tối đa khoảng 7 ngày; nếu không gia hạn, việc đồng bộ Drive → web (UC-DOC-02) ngừng hoạt động. Use case: một tác vụ định kỳ rà các kênh sắp hết hạn và đăng ký kênh mới trước khi kênh cũ hết hạn. Kết thúc: mọi thư mục dự án luôn có một kênh theo dõi còn hiệu lực.

**Preconditions:**
1. Có ít nhất một dự án với thư mục tài liệu Drive.
2. Cấu hình xác thực Drive còn hiệu lực.

**Postconditions (thành công):**
1. Mọi kênh sắp hết hạn (trong ngưỡng cấu hình) được thay bằng kênh mới.
2. Thông tin kênh mới (id kênh, thời điểm hết hạn) được lưu; kênh cũ được đánh dấu ngừng.

## Normal Course of Events
1. Tác vụ định kỳ được kích hoạt theo lịch.
2. Hệ thống lấy danh sách kênh theo dõi và thời điểm hết hạn của từng kênh.
3. Với mỗi kênh hết hạn trong ngưỡng cảnh báo, hệ thống đăng ký một kênh theo dõi mới cho cùng thư mục dự án.
4. Hệ thống lưu thông tin kênh mới và đánh dấu kênh cũ ngừng theo dõi.
5. Hệ thống ghi nhật ký số kênh đã gia hạn.

## Alternative Courses
- **UC-DOC-03.AC.1** — Tại bước 3, nếu không có kênh nào sắp hết hạn, hệ thống kết thúc mà không thay đổi gì.

## Exceptions
- **UC-DOC-03.EX.1 — Không đăng ký được kênh mới:** Tại bước 3, nếu đăng ký kênh mới với Drive thất bại cho một thư mục → hệ thống giữ kênh cũ nếu còn hiệu lực, ghi cảnh báo và thử lại ở lần chạy sau; nếu kênh cũ đã hết hạn, dự án đó dựa vào UC-DOC-04 cho đến khi gia hạn được. Trạng thái cuối: một số thư mục có thể tạm không có kênh.

## Includes
- —

## Special Requirements
- Tác vụ định kỳ chạy trên Node runtime.
- Ngưỡng gia hạn (ví dụ còn dưới 24 giờ) là cấu hình.

## Assumptions
1. Số thư mục dự án ở mức vài chục — gia hạn tuần tự trong một lần chạy là đủ.
2. Nhà cung cấp lịch chạy (cron) đáng tin cậy.

## Notes and Issues
- **[TBD-1]** Chu kỳ chạy: mỗi ngày hay mỗi 6 giờ? | Owner: Dev
