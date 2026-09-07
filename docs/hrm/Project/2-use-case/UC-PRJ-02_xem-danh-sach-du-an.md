# UC-PRJ-02 — Xem danh sách dự án

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-PRJ-02 |
| **Use Case Name** | Xem danh sách dự án |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý dự án (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | Nhiều lần / ngày (~5–15) |
| **Nguồn** | US-PRJ-02 |

**Description:** Quản lý cần nắm nhanh tình hình mọi dự án để phát hiện dự án đang trễ mà không phải mở từng dự án. Use case hiển thị toàn bộ dự án kèm tiến độ công việc (đã hoàn thành / tổng số), cờ "Quá hạn", và cho lọc danh sách theo khoảng thời gian. Kết thúc: quản lý thấy danh sách dự án đã tổng hợp và lọc.

**Preconditions:**
1. Quản lý đã đăng nhập.

**Postconditions (thành công):**
1. Danh sách dự án được hiển thị với tiến độ tổng hợp và cờ quá hạn tính đúng theo ngày hiện tại.
2. Không có thay đổi dữ liệu.

## Normal Course of Events
1. Quản lý mở màn hình danh sách dự án.
2. Hệ thống lấy toàn bộ dự án và công việc liên quan.
3. Hệ thống tính cho mỗi dự án: số công việc đã hoàn thành trên tổng số, và cờ "Quá hạn" nếu ngày kết thúc đã qua và còn công việc chưa hoàn thành.
4. Hệ thống hiển thị danh sách dự án kèm tiến độ và cờ trạng thái.
5. Quản lý chọn một khoảng thời gian ở bộ lọc.
6. Hệ thống hiển thị lại danh sách chỉ gồm dự án có thời gian hoạt động giao với khoảng đã chọn.

## Alternative Courses
- **UC-PRJ-02.AC.1** — Tại bước 4, nếu chưa có dự án nào, hệ thống hiển thị trạng thái trống kèm lối tắt "Tạo dự án đầu tiên". Use case kết thúc.

## Exceptions
- **UC-PRJ-02.EX.1 — Không tải được dữ liệu:** Tại bước 2, nếu truy vấn thất bại → hệ thống hiển thị thông báo lỗi và nút thử lại, không hiển thị danh sách sai lệch. Trạng thái cuối: màn hình lỗi.

## Includes
- —

## Special Requirements
- Tổng hợp tiến độ tính phía client; danh sách 50 dự án hiển thị trong ≤ 2 giây.

## Assumptions
1. Số dự án đồng thời ở mức vài chục, không cần phân trang máy chủ.
2. "Tiến độ" đo bằng tỷ lệ công việc hoàn thành, không theo trọng số công việc.

## Notes and Issues
- **[TBD-1]** Cách hiển thị tiến độ: "x/y", phần trăm, hay thanh tiến độ? | Owner: Hoàng
