# UC-XEM-01 — Nhân viên xem phiếu lương của mình

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-XEM-01 |
| **Use Case Name** | Nhân viên xem phiếu lương của mình |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Nhân viên sale (Duy / Hà / Quyến / Thương) |
| **Secondary Actor** | — |
| **Priority** | Medium |
| **Frequency of Use** | ~1–2 lần / kỳ / người |
| **Nguồn** | US-XEM-01 |

**Description:** Nhân viên cần biết lương kỳ của mình được tính ra sao để đối chiếu với ghi nhận cá nhân, thay vì hỏi quản lý qua tin nhắn. Use case cho phép nhân viên xem phiếu lương tháng của chính mình sau khi quản lý đã chốt, gồm đủ các mục A–E. Use case chỉ đọc và chỉ truy cập phiếu gắn với tài khoản đang đăng nhập.

**Preconditions:**
1. Nhân viên đã đăng nhập.
2. Tài khoản đăng nhập khớp một nhân viên sale trong danh sách.

**Postconditions (thành công):**
1. Không có thay đổi dữ liệu.
2. Nhân viên xem được phiếu lương của chính mình cho kỳ đã chốt.

## Normal Course of Events
1. Nhân viên mở mục lương của mình và chọn kỳ (tháng, năm).
2. Hệ thống kiểm tra bảng lương của kỳ đó đang ở trạng thái "Đã chốt".
3. Hệ thống hiển thị phiếu lương của chính nhân viên đó với đủ các mục A–E và tổng lương thực lĩnh.

## Alternative Courses
- **UC-XEM-01.AC.1** — Tại bước 3, nếu nhân viên cho rằng một chỉ số sai, phiếu nêu rõ nhân viên gửi thắc mắc cho quản lý (quản lý xử lý qua UC-CHOT-02), không sửa trực tiếp trên phiếu.

## Exceptions
- **UC-XEM-01.EX.1 — Kỳ chưa chốt:** Tại bước 2, nếu bảng lương ở "Nháp" hoặc chưa dựng → hệ thống hiển thị "Bảng lương tháng này chưa được chốt" và không hiển thị số liệu. Trạng thái cuối: không lộ số nháp.
- **UC-XEM-01.EX.2 — Truy cập phiếu người khác:** Tại bước 1, nếu nhân viên tìm cách mở phiếu của đồng nghiệp → hệ thống chỉ trả về phiếu gắn với tài khoản đang đăng nhập. Trạng thái cuối: không lộ phiếu người khác.
- **UC-XEM-01.EX.3 — Tài khoản không khớp nhân viên sale:** Tại bước 1, nếu tài khoản đăng nhập không nằm trong danh sách nhân viên sale → hệ thống thông báo không có phiếu lương cho tài khoản này. Trạng thái cuối: không hiển thị phiếu nào.

## Includes
- —

## Special Requirements
- Nhân viên chỉ đọc được phiếu của chính mình; đối chiếu tài khoản với danh sách nhân viên, gác quyền phía client.

## Assumptions
1. Ánh xạ tài khoản đăng nhập ↔ nhân viên sale đã có (theo email hoặc uid).
2. Chưa có lớp phân quyền phía máy chủ.

## Notes and Issues
- —
