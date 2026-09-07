# UC-TSK-02 — Xem và lọc bảng công việc của dự án

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-TSK-02 |
| **Use Case Name** | Xem và lọc bảng công việc của dự án |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý dự án (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | Nhiều lần / ngày |
| **Nguồn** | US-TSK-02 |

**Description:** Quản lý cần tìm nhanh việc trễ hạn hoặc việc của một người cụ thể mà không phải đọc từng thẻ. Use case hiển thị mọi công việc của một dự án trong bảng có bộ lọc theo trạng thái, độ ưu tiên, người đảm nhiệm và khoảng thời gian, kèm cột "còn lại" và cờ cảnh báo quá hạn. Kết thúc: quản lý xem được tập công việc đã lọc kèm thông tin thời hạn.

**Preconditions:**
1. Quản lý đã đăng nhập.
2. Dự án đã tồn tại.

**Postconditions (thành công):**
1. Bảng công việc hiển thị đúng tập công việc khớp mọi điều kiện lọc.
2. Mỗi dòng hiển thị số ngày còn lại hoặc số ngày quá hạn tính theo ngày hiện tại; công việc đã hoàn thành không có cảnh báo.
3. Không có thay đổi dữ liệu.

## Normal Course of Events
1. Quản lý mở bảng công việc của một dự án.
2. Hệ thống lấy toàn bộ công việc của dự án.
3. Hệ thống tính cho mỗi công việc chưa hoàn thành: "Còn N ngày" nếu hạn ở tương lai, "Quá hạn N ngày" kèm cảnh báo nếu hạn đã qua; công việc hoàn thành hiển thị "Đã hoàn thành".
4. Hệ thống hiển thị bảng công việc đầy đủ.
5. Quản lý đặt các điều kiện lọc (trạng thái / độ ưu tiên / người đảm nhiệm / khoảng thời gian).
6. Hệ thống hiển thị lại bảng chỉ gồm công việc khớp mọi điều kiện.

## Alternative Courses
- **UC-TSK-02.AC.1** — Tại bước 6, nếu không có công việc nào khớp, hệ thống hiển thị bảng trống với thông báo "Không có công việc khớp bộ lọc". Use case kết thúc.
- **UC-TSK-02.AC.2** — Tại bước 5, nếu quản lý chọn "nhóm theo trạng thái", hệ thống hiển thị công việc gom theo cột trạng thái thay vì danh sách phẳng. *(tuỳ chọn — có thể tách story riêng)*

## Exceptions
- **UC-TSK-02.EX.1 — Lỗi tải dữ liệu:** Tại bước 2, nếu truy vấn thất bại → hệ thống hiển thị lỗi và nút thử lại, không hiển thị bảng sai lệch. Trạng thái cuối: màn hình lỗi.

## Includes
- —

## Special Requirements
- Lọc và tính "còn lại" xử lý phía client; bảng ≤ 200 công việc hiển thị trong ≤ 2 giây.
- Dùng chung component chọn khoảng thời gian (DateRangePicker) của dự án.

## Assumptions
1. Số công việc mỗi dự án ở mức vài chục đến ~200.
2. "Quá hạn" so sánh theo ngày lịch Việt Nam.

## Notes and Issues
- —
