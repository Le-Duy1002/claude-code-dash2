# UC-NHAP-02 — Duyệt thưởng cố định

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-NHAP-02 |
| **Use Case Name** | Duyệt thưởng cố định |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | Medium |
| **Frequency of Use** | 0–4 lần / kỳ (theo số nhân viên đạt "Xuất sắc") |
| **Nguồn** | US-NHAP-01 (AC-4, AC-5) |

**Description:** Thưởng cố định 500.000 đ chỉ dành cho nhân viên "đạt 100% tiêu chí" — quy ước là xếp loại tổng kỳ "Xuất sắc" — và cần quản lý xác nhận chứ không cộng tự động. Use case: hệ thống hiện thông báo gợi ý cho các nhân viên đủ điều kiện, quản lý duyệt hoặc bỏ qua. Kết thúc: khoản 500.000 đ được cộng cho những người quản lý đã duyệt.

**Preconditions:**
1. Quản lý đã đăng nhập.
2. Bảng lương của kỳ đang ở trạng thái "Nháp".
3. Có ít nhất một nhân viên xếp loại "Xuất sắc" trong kỳ.

**Postconditions (thành công):**
1. Nhân viên được duyệt có thêm 500.000 đ ở phần thưởng cố định của dòng lương.
2. Tổng trước khấu trừ và tổng lương thực lĩnh của dòng đó được tính lại.
3. Việc duyệt được ghi kèm người duyệt và thời điểm.

## Normal Course of Events
1. Hệ thống hiển thị thông báo gợi ý "đề nghị thưởng cố định" cho mỗi nhân viên xếp loại "Xuất sắc" trong kỳ.
2. Quản lý mở thông báo.
3. Quản lý bấm "Duyệt thưởng cố định" cho một nhân viên.
4. Hệ thống cộng 500.000 đ vào phần thưởng cố định của dòng lương nhân viên đó.
5. Hệ thống tính lại tổng trước khấu trừ và tổng lương thực lĩnh của dòng.
6. Hệ thống đánh dấu gợi ý đã xử lý và ghi người duyệt, thời điểm.

## Alternative Courses
- **UC-NHAP-02.AC.1** — Tại bước 3, nếu quản lý bấm "Bỏ qua", hệ thống đánh dấu gợi ý đã xử lý mà không cộng khoản nào.
- **UC-NHAP-02.AC.2** — Tại bước 3, nếu quản lý gỡ duyệt một khoản đã duyệt trước đó, hệ thống trừ lại 500.000 đ khỏi phần thưởng cố định và tính lại tổng.

## Exceptions
- **UC-NHAP-02.EX.1 — Nhân viên không còn xếp loại Xuất sắc:** Tại bước 3, nếu điểm tổng kỳ đã thay đổi khiến nhân viên không còn "Xuất sắc" → hệ thống không cho duyệt và gỡ gợi ý đó. Trạng thái cuối: không cộng thưởng.
- **UC-NHAP-02.EX.2 — Bảng lương đã chốt:** Tại bước 2, nếu bảng đang "Đã chốt" → thao tác duyệt bị khoá, hệ thống hướng dẫn dùng UC-CHOT-02. Trạng thái cuối: không đổi.
- **UC-NHAP-02.EX.3 — Mất kết nối khi lưu:** Tại bước 4, nếu ghi thất bại → hệ thống không cộng khoản, giữ gợi ý ở trạng thái chưa xử lý, báo lỗi. Trạng thái cuối: dòng lương không đổi.

## Includes
- —

## Special Requirements
- —

## Assumptions
1. "Đạt 100% tiêu chí" = xếp loại tổng kỳ "Xuất sắc" (điểm ≥ 90), lấy từ phần chấm điểm.
2. Thưởng cố định là một khoản cố định 500.000 đ, lấy từ tham số hiện hành.

## Notes and Issues
- —
