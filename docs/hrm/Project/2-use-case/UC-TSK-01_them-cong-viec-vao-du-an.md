# UC-TSK-01 — Thêm công việc vào dự án

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-TSK-01 |
| **Use Case Name** | Thêm công việc vào dự án |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý dự án (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | ~5–20 lần / tuần |
| **Nguồn** | US-TSK-01 |

**Description:** Quản lý cần giao việc rõ ràng, gắn với dự án và có hạn chót để nhân viên biết chính xác việc cần làm. Use case cho phép thêm một công việc vào một dự án với tiêu đề, người đảm nhiệm, độ ưu tiên, mốc thời gian và trạng thái ban đầu. Kết thúc: công việc mới thuộc dự án, ở trạng thái "Chưa bắt đầu", có người đảm nhiệm.

**Preconditions:**
1. Quản lý đã đăng nhập.
2. Dự án đích đã tồn tại.

**Postconditions (thành công):**
1. Bản ghi công việc được tạo và gắn với dự án đích.
2. Công việc có người đảm nhiệm thuộc đội, độ ưu tiên và ít nhất là ngày kết thúc.
3. Công việc xuất hiện trong bảng công việc và bảng Kanban của dự án.

## Normal Course of Events
1. Quản lý mở dự án đích và chọn "Thêm công việc".
2. Hệ thống hiển thị biểu mẫu thêm công việc.
3. Quản lý nhập tiêu đề, chọn người đảm nhiệm, độ ưu tiên, ngày bắt đầu và ngày kết thúc.
4. Quản lý xác nhận.
5. Hệ thống kiểm tra dữ liệu hợp lệ.
6. Hệ thống lưu công việc ở trạng thái "Chưa bắt đầu", gắn với dự án.
7. Hệ thống hiển thị công việc trong bảng công việc của dự án.

## Alternative Courses
- **UC-TSK-01.AC.1** — Tại bước 3, nếu ngày kết thúc công việc trễ hơn ngày kết thúc dự án, tại bước 5 hệ thống vẫn chấp nhận nhưng kèm cảnh báo "Hạn công việc trễ hơn hạn dự án"; quản lý xác nhận tiếp để sang bước 6.

## Exceptions
- **UC-TSK-01.EX.1 — Thiếu người đảm nhiệm:** Tại bước 5, nếu chưa chọn người đảm nhiệm → hệ thống dừng, thông báo "Phải chọn người đảm nhiệm", giữ dữ liệu. Trạng thái cuối: chưa tạo công việc.
- **UC-TSK-01.EX.2 — Thiếu tiêu đề:** Tại bước 5, nếu tiêu đề trống → hệ thống dừng, thông báo bắt buộc nhập tiêu đề. Trạng thái cuối: chưa tạo công việc.
- **UC-TSK-01.EX.3 — Lỗi lưu:** Tại bước 6, nếu ghi thất bại → hệ thống giữ nguyên biểu mẫu, thông báo để thử lại. Trạng thái cuối: chưa tạo công việc.

## Includes
- —

## Special Requirements
- Người đảm nhiệm chỉ chọn được trong danh sách 4 nhân viên sale cấu hình sẵn.

## Assumptions
1. Một công việc có đúng một người đảm nhiệm.
2. Mọi công việc đều thuộc một dự án (không có công việc lẻ).

## Notes and Issues
- **[TBD-1]** Có hỗ trợ công việc con / checklist trong một công việc không? | vòng sau
