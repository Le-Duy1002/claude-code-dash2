# UC-CHOT-03 — Xem lịch sử điều chỉnh bảng lương

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CHOT-03 |
| **Use Case Name** | Xem lịch sử điều chỉnh bảng lương |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | Low |
| **Frequency of Use** | Vài lần / kỳ khi có tranh luận về lương |
| **Nguồn** | US-CHOT-01 + us.md Ghi chú 13 |

**Description:** Khi có tranh luận về một con số lương, quản lý cần biết ai đã đổi gì, khi nào và vì sao. Use case cho phép quản lý xem toàn bộ thao tác chốt / điều chỉnh / bỏ chốt của một kỳ, lọc theo nhân viên và theo "chỉ sau khi chốt". Use case chỉ đọc.

**Preconditions:**
1. Tài khoản quản trị đã đăng nhập.
2. Bảng lương của kỳ đã tồn tại.

**Postconditions (thành công):**
1. Không có thay đổi dữ liệu.
2. Quản lý xem được danh sách lịch sử của kỳ theo bộ lọc đã chọn.

## Normal Course of Events
1. Quản lý mở "Lịch sử điều chỉnh" của bảng lương kỳ.
2. Hệ thống hiển thị danh sách thay đổi, mới nhất trước, mỗi dòng gồm: thời gian, người thực hiện, nhân viên bị ảnh hưởng, nội dung thay đổi, nhãn "sau chốt" nếu có.
3. Quản lý chọn lọc theo nhân viên hoặc chọn "chỉ sau khi chốt".
4. Hệ thống hiển thị danh sách khớp bộ lọc.

## Alternative Courses
- **UC-CHOT-03.AC.1** — Tại bước 3, nếu quản lý chọn nhiều điều kiện lọc cùng lúc, hệ thống áp tất cả các điều kiện.

## Exceptions
- **UC-CHOT-03.EX.1 — Không có thay đổi khớp:** Tại bước 4, nếu không có dòng nào khớp bộ lọc → hệ thống hiển thị "Không có thay đổi nào khớp bộ lọc". Trạng thái cuối: danh sách trống.

## Includes
- —

## Special Requirements
- —

## Assumptions
1. Lịch sử dùng chung cơ chế `workScheduleChanges` của Lịch làm việc (chỉ đọc và thêm mới).

## Notes and Issues
- Truy vết: use case này suy ra từ US-CHOT-01 và Ghi chú 13 của us.md (chưa có user story riêng cho phần xem lịch sử — cân nhắc bổ sung khi vào Sprint Planning).
