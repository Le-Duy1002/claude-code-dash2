# UC-CHOT-02 — Điều chỉnh bảng lương sau khi chốt

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CHOT-02 |
| **Use Case Name** | Điều chỉnh bảng lương sau khi chốt |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | Medium |
| **Frequency of Use** | Hiếm — 0–2 lần / kỳ |
| **Nguồn** | US-CHOT-01 (AC-3, AC-4) |

**Description:** Sau khi bảng lương đã chốt vẫn có thể phát hiện sai sót (ví dụ doanh thu demo vào sổ muộn). Use case cho phép quản lý mở lại bảng đã chốt để sửa, với lý do bắt buộc; mỗi thay đổi được ghi vào lịch sử với nhãn "sau chốt". Có nhánh "Bỏ chốt" đưa bảng về "Nháp". Kết thúc: số liệu được cập nhật, dấu vết đầy đủ.

**Preconditions:**
1. Tài khoản quản trị đã đăng nhập.
2. Bảng lương của kỳ đang ở trạng thái "Đã chốt".

**Postconditions (thành công):**
1. Ô được sửa có giá trị mới; các số dẫn xuất (qua UC-KL-01) và tổng lương thực lĩnh được tính lại.
2. Mỗi thay đổi được ghi một dòng lịch sử đánh dấu "sau chốt" kèm lý do.
3. Bảng vẫn ở trạng thái "Đã chốt" sau khi kết thúc điều chỉnh (trừ nhánh Bỏ chốt — AC.2).

## Normal Course of Events
1. Quản lý mở bảng lương đã chốt của kỳ.
2. Quản lý bấm "Điều chỉnh" và nhập lý do.
3. Hệ thống mở các ô cho sửa và hiển thị dải cảnh báo nêu lý do đang áp dụng.
4. Quản lý sửa một hoặc nhiều ô.
5. Hệ thống lưu từng thay đổi, thực hiện UC-KL-01 và tính lại tổng lương thực lĩnh.
6. Hệ thống ghi mỗi thay đổi vào lịch sử kèm nhãn "sau chốt" và lý do.
7. Quản lý bấm "Xong".
8. Hệ thống đưa bảng về chỉ-đọc, giữ trạng thái "Đã chốt".

## Alternative Courses
- **UC-CHOT-02.AC.1** — Tại bước 4, nếu quản lý bấm "Dựng lại số tự động" trong chế độ điều chỉnh, hệ thống dựng lại các ô tự động (theo UC-LUONG-01) nhưng ghi toàn bộ thay đổi với nhãn "sau chốt" và giữ trạng thái "Đã chốt".
- **UC-CHOT-02.AC.2** — Tại bước 2, nếu quản lý chọn "Bỏ chốt" và nhập lý do, hệ thống chuyển bảng về "Nháp", ghi một dòng "Bỏ chốt" (đánh dấu sau chốt) kèm lý do; các ô mở lại bình thường.

## Exceptions
- **UC-CHOT-02.EX.1 — Không nhập lý do:** Tại bước 2, nếu lý do trống → hệ thống không mở chế độ điều chỉnh. Trạng thái cuối: bảng vẫn chỉ-đọc.
- **UC-CHOT-02.EX.2 — Mất kết nối khi lưu thay đổi:** Tại bước 5, nếu ghi một ô thất bại → hệ thống không lưu ô đó, giữ giá trị cũ, báo lỗi. Trạng thái cuối: ô chưa đổi, các ô khác đã lưu vẫn giữ.

## Includes
- UC-KL-01 — Áp thang khấu trừ kỷ luật và tính hệ số lương.

## Special Requirements
- —

## Assumptions
1. Một lý do áp cho cả lần điều chỉnh; mỗi thay đổi vẫn ghi riêng một dòng lịch sử.
2. Lịch sử chốt / điều chỉnh chỉ được đọc và thêm mới.

## Notes and Issues
- —
