# UC-LUONG-02 — Xem phiếu lương chi tiết một nhân viên

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-LUONG-02 |
| **Use Case Name** | Xem phiếu lương chi tiết một nhân viên |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | ~5–25 lần / kỳ (rà từng nhân viên, giải thích khi có thắc mắc) |
| **Nguồn** | US-LUONG-02 |

**Description:** Khi nhân viên thắc mắc về lương, quản lý cần chỉ ra được từng con số ra từ đâu. Use case cho phép quản lý mở phiếu lương của một nhân viên và xem rõ năm mục A–E kèm mọi số trung gian, đồng thời bấm vào một chỉ số lỗi để xem danh sách ngày / hội thoại đứng sau con số đó. Kết thúc: quản lý nắm được cấu thành lương và phát hiện sớm số liệu bất thường. Use case chỉ đọc, không thay đổi dữ liệu.

**Preconditions:**
1. Tài khoản quản trị đã đăng nhập.
2. Bảng lương của kỳ đã được dựng (trạng thái "Nháp" hoặc "Đã chốt").

**Postconditions (thành công):**
1. Không có thay đổi dữ liệu.
2. Quản lý xem được chi tiết mục A–E của nhân viên đã chọn cho kỳ đó.

## Normal Course of Events
1. Quản lý mở bảng lương của kỳ và chọn một nhân viên.
2. Hệ thống hiển thị phiếu lương với năm mục kèm mọi số trung gian: A — đơn giá giờ thường / giờ cuối ca, giờ thực tế, lương giờ; B — doanh thu demo, % thưởng, thưởng demo, thưởng cố định; C — % trừ theo từng chỉ số tần suất cao; D — tiền phạt và % trừ theo từng loại lỗi rời rạc; E — tổng % trừ, hệ số còn lại, tổng lương thực lĩnh.
3. Quản lý bấm vào một chỉ số lỗi (ví dụ "số hội thoại bỏ sót").
4. Hệ thống hiển thị danh sách sự kiện đứng sau con số đó — hội thoại kèm thời điểm, tên khách và lối mở nhanh trên Pancake; hoặc ca lỗi kèm ngày, buổi, giờ vào ca thực tế và số phút vào ca muộn.

## Alternative Courses
- **UC-LUONG-02.AC.1** — Tại bước 2, nếu một mục đang ở trạng thái "chờ", hệ thống nêu rõ mục đó chưa tính được và lý do, không hiển thị con số 0 như thể đã tính.
- **UC-LUONG-02.AC.2** — Tại bước 3, nếu quản lý bấm vào một chỉ số đạt mức tối đa (không có sự kiện lỗi), hệ thống hiển thị "không có sự kiện nào".

## Exceptions
- **UC-LUONG-02.EX.1 — Không tải được danh sách chi tiết:** Tại bước 4, nếu đọc dữ liệu sự kiện thất bại → hệ thống vẫn giữ phiếu lương, hiển thị thông báo không tải được phần chi tiết và cho thử lại. Trạng thái cuối: phiếu vẫn xem được, phần chi tiết để trống.

## Includes
- —

## Special Requirements
- Phiếu lương hiển thị trong ≤ 2 giây ở điều kiện mạng bình thường.
- Danh sách chi tiết khớp đúng dữ liệu của phần Theo dõi công việc / Lịch làm việc cùng kỳ.

## Assumptions
1. Phần xem chi tiết tái dùng cơ chế drill-down của phần Theo dõi công việc.

## Notes and Issues
- —
