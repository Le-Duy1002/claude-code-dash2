# UC-CHOT-01 — Chốt bảng lương tháng

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CHOT-01 |
| **Use Case Name** | Chốt bảng lương tháng |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | ~1 lần / kỳ lương |
| **Nguồn** | US-CHOT-01 (AC-1, AC-2) |

**Description:** Cần một mốc "lương chính thức" để chi trả và để mọi thay đổi về sau đều truy vết được. Use case cho phép quản lý chốt bảng lương một kỳ sau khi đã rà xong: hệ thống khoá số liệu ở chế độ chỉ-đọc, lưu snapshot toàn bộ tham số đang dùng và ghi một dòng vào lịch sử. Kết thúc: bảng lương ở trạng thái "Đã chốt".

**Preconditions:**
1. Tài khoản quản trị đã đăng nhập.
2. Bảng lương của kỳ đang ở trạng thái "Nháp".

**Postconditions (thành công):**
1. Trạng thái bảng lương chuyển sang "Đã chốt".
2. Mọi ô số và ô nhập tay ở chế độ chỉ-đọc.
3. Toàn bộ tham số lương đang dùng được lưu snapshot vào bản ghi bảng lương.
4. Một dòng "Chốt bảng lương [kỳ]" kèm tên người chốt và thời điểm được ghi vào lịch sử.

## Normal Course of Events
1. Quản lý mở bảng lương nháp của kỳ.
2. Quản lý bấm "Chốt lương".
3. Hệ thống hiển thị hộp xác nhận, nêu số nhân viên và tổng quỹ lương của kỳ.
4. Quản lý xác nhận.
5. Hệ thống kiểm tra không còn mục nào ở trạng thái "chờ".
6. Hệ thống lưu snapshot bộ tham số lương vào bản ghi bảng lương.
7. Hệ thống chuyển trạng thái bảng sang "Đã chốt" và đặt mọi ô về chỉ-đọc.
8. Hệ thống ghi một dòng "Chốt bảng lương [kỳ]" vào lịch sử kèm tên người chốt và thời điểm.

## Alternative Courses
- **UC-CHOT-01.AC.1** — Tại bước 5, nếu còn mục ở trạng thái "chờ", hệ thống cảnh báo và cho quản lý chọn: huỷ để bổ sung dữ liệu, hoặc xác nhận chốt với các mục đó ghi nhận bằng 0.

## Exceptions
- **UC-CHOT-01.EX.1 — Bảng đã ở trạng thái "Đã chốt":** Tại bước 2, nút "Chốt lương" không hiển thị. Trạng thái cuối: không đổi.
- **UC-CHOT-01.EX.2 — Mất kết nối khi ghi:** Tại bước 7, nếu ghi thất bại → hệ thống không đổi trạng thái, giữ bảng ở "Nháp", báo lỗi để thử lại. Trạng thái cuối: bảng vẫn "Nháp".

## Includes
- —

## Special Requirements
- —

## Assumptions
1. Chỉ tài khoản quản trị được định danh (uid/email của Hoàng) mới chốt được — luật Firestore chặn tài khoản khác; danh tính người chốt được ghi vào lịch sử.
2. Lịch sử chốt / điều chỉnh chỉ được đọc và thêm mới, không sửa / xoá qua web.

## Notes and Issues
- Phân quyền chốt lương **có kiểm soát phía máy chủ** (đã chốt 08/09/2026) — khác các tính năng khác của dashboard vốn gác quyền phía client.
