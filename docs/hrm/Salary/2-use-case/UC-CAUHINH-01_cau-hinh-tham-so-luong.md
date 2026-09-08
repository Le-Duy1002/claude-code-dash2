# UC-CAUHINH-01 — Cấu hình tham số lương

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CAUHINH-01 |
| **Use Case Name** | Cấu hình tham số lương |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | Medium |
| **Frequency of Use** | Hiếm — vài lần / năm khi đổi chính sách lương |
| **Nguồn** | US-CAUHINH-01 |

**Description:** Khi chính sách lương thay đổi, quản lý cần cập nhật một chỗ thay vì sửa công thức trong từng bảng. Use case cho phép quản lý chỉnh bộ tham số lương — đơn giá giờ thường, đơn giá giờ cuối ca, thang thưởng demo, thang trừ hệ số mục C và D, mức phạt tiền mỗi lần, trần % trừ và hệ số sàn. Tham số mới áp cho các kỳ dựng hoặc điều chỉnh sau thời điểm này; kỳ đã chốt giữ snapshot riêng.

**Preconditions:**
1. Quản lý đã đăng nhập.

**Postconditions (thành công):**
1. Bộ tham số lương hiện hành được cập nhật.
2. Kỳ dựng hoặc điều chỉnh sau thời điểm này dùng tham số mới.
3. Kỳ đã chốt giữ nguyên snapshot tham số lúc chốt.

## Normal Course of Events
1. Quản lý mở "Tham số lương".
2. Hệ thống hiển thị bộ tham số hiện hành: đơn giá giờ thường, đơn giá giờ cuối ca, thang thưởng demo, thang trừ mục C, thang trừ và phạt tiền mục D, trần % trừ, hệ số sàn.
3. Quản lý sửa một hoặc nhiều tham số.
4. Quản lý lưu.
5. Hệ thống kiểm tra tính hợp lệ: các đơn giá và mức phạt là số dương; các bậc của mỗi thang liền mạch, không chồng lấn, không hở; hệ số sàn trong khoảng 0–100%.
6. Hệ thống lưu bộ tham số mới.

## Alternative Courses
- **UC-CAUHINH-01.AC.1** — Tại bước 3, nếu quản lý bấm "Khôi phục mặc định", hệ thống nạp lại bộ tham số mặc định vào biểu mẫu để quản lý xem trước khi lưu ở bước 4.

## Exceptions
- **UC-CAUHINH-01.EX.1 — Thang bậc chồng lấn hoặc hở:** Tại bước 5, nếu các mốc bậc của một thang tạo khoảng chồng lấn hoặc bỏ trống một khoảng giá trị → hệ thống không lưu và chỉ ra khoảng lỗi. Trạng thái cuối: tham số không đổi.
- **UC-CAUHINH-01.EX.2 — Giá trị phi lệ:** Tại bước 5, nếu đơn giá âm, trần % trừ âm, hoặc hệ số sàn lớn hơn 100% → hệ thống không lưu và báo giá trị không hợp lệ. Trạng thái cuối: tham số không đổi.
- **UC-CAUHINH-01.EX.3 — Mất kết nối khi lưu:** Tại bước 6, nếu ghi thất bại → hệ thống không lưu, giữ tham số cũ, báo lỗi để thử lại. Trạng thái cuối: tham số không đổi.

## Includes
- —

## Special Requirements
- Thay đổi tham số không hồi tố các bảng lương đã dựng cho kỳ trước.

## Assumptions
1. Chỉ có một bộ tham số lương hiện hành tại một thời điểm.
2. Bảng lương "Nháp" đã dựng sẽ dùng tham số mới ở lần "Dựng lại" kế tiếp, không tự đổi.

## Notes and Issues
- **[TBD-1]** Có lưu lịch sử các lần đổi tham số lương không? | Owner: Hoàng | Chưa quyết
