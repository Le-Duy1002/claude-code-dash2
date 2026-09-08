# UC-LUONG-01 — Dựng bảng lương tháng

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-LUONG-01 |
| **Use Case Name** | Dựng bảng lương tháng |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | Lịch làm việc, Chấm điểm Pancake (nguồn dữ liệu) |
| **Priority** | High |
| **Frequency of Use** | ~1–3 lần / kỳ lương (một lần dựng chính, cộng vài lần dựng lại) |
| **Nguồn** | US-LUONG-01 |

**Description:** Trước đây quản lý phải chép tay từng con số từ nhiều bảng để tính lương, dễ lệch với dữ liệu chấm điểm. Use case cho phép quản lý chọn một kỳ lương (tháng/năm) và để hệ thống dựng bảng lương nháp cho toàn đội sale: tự đọc giờ công từ Lịch làm việc, các chỉ số từ Theo dõi công việc / Nhật ký AI, tính lương giờ và chạy khấu trừ kỷ luật. Kết thúc: có một bảng lương nháp cho kỳ, mỗi nhân viên một dòng với đủ số tự động và hệ số lương.

**Preconditions:**
1. Quản lý đã đăng nhập vào dashboard.
2. Danh sách nhân viên sale đã được cấu hình.

**Postconditions (thành công):**
1. Có một bản ghi bảng lương cho kỳ ở trạng thái "Nháp", mỗi nhân viên sale một dòng.
2. Các ô số tự động (giờ theo lịch, giờ thực tế, lương giờ, các tỷ lệ chấm điểm, số hội thoại bỏ sót, số lần đến muộn / bỏ ca, tỷ lệ chốt demo) đã được điền — hoặc đánh dấu "chờ" nếu thiếu nguồn.
3. Các khoản nhập tay từ lần dựng trước (nếu có) được giữ nguyên.
4. Mỗi dòng đã chạy UC-KL-01 và có % trừ hệ số, hệ số lương, tổng tiền phạt.

## Normal Course of Events
1. Quản lý chọn chức năng "Bảng lương" và chọn kỳ (tháng, năm).
2. Hệ thống hiển thị trạng thái bảng lương của kỳ (chưa có / Nháp / Đã chốt).
3. Quản lý bấm "Dựng bảng lương".
4. Hệ thống đọc giờ đăng ký và giờ làm thực tế của từng nhân viên từ Lịch làm việc cho kỳ.
5. Hệ thống đọc các tỷ lệ chấm điểm, số hội thoại bỏ sót, số lần đến muộn và số lần bỏ ca theo mức từ phần Theo dõi công việc / Nhật ký AI cho kỳ.
6. Hệ thống tính lương giờ cho từng nhân viên theo đơn giá giờ thường và đơn giá giờ cuối ca.
7. Hệ thống tạo hoặc cập nhật bản ghi bảng lương nháp, mỗi nhân viên một dòng, giữ nguyên các khoản đã nhập tay.
8. Hệ thống thực hiện UC-KL-01 để tính % trừ hệ số và hệ số lương cho từng dòng.
9. Hệ thống hiển thị bảng lương nháp và cảnh báo nếu còn mục ở trạng thái "chờ".

## Alternative Courses
- **UC-LUONG-01.AC.1** — Tại bước 4–5, nếu kỳ chưa có tuần lịch nào ở trạng thái "Đã chốt", hệ thống để các mục phụ thuộc lịch (giờ theo lịch, giờ thực tế, đến muộn, bỏ ca) ở trạng thái "chờ — chưa có lịch chốt cho kỳ này", đặt lương giờ tạm tính bằng 0 và tiếp tục bước 6 với phần dữ liệu còn lại.
- **UC-LUONG-01.AC.2** — Tại bước 7, nếu bảng lương của kỳ đã tồn tại ở trạng thái "Nháp", hệ thống cập nhật lại toàn bộ số tự động theo dữ liệu mới nhất và giữ nguyên các khoản đã nhập tay.

## Exceptions
- **UC-LUONG-01.EX.1 — Bảng lương của kỳ đã chốt:** Tại bước 3, nếu bảng lương đang ở trạng thái "Đã chốt" → hệ thống không dựng lại, thông báo dùng UC-CHOT-02 nếu cần sửa. Trạng thái cuối: bảng đã chốt không đổi.
- **UC-LUONG-01.EX.2 — Không đọc được dữ liệu nguồn:** Tại bước 4 hoặc 5, nếu đọc Lịch làm việc hoặc Chấm điểm thất bại → hệ thống không tạo và không cập nhật bản ghi bảng lương, giữ nguyên trạng thái trước, thông báo để thử lại. Trạng thái cuối: bảng lương không đổi.
- **UC-LUONG-01.EX.3 — Không có nhân viên sale:** Tại bước 4, nếu danh sách nhân viên sale rỗng → hệ thống không tạo bảng, thông báo cấu hình danh sách nhân viên trước. Trạng thái cuối: chưa có bảng lương.
- **UC-LUONG-01.EX.4 — Mất kết nối khi ghi:** Tại bước 7, nếu ghi cơ sở dữ liệu thất bại → hệ thống không lưu bản ghi, thông báo lỗi để thử lại. Trạng thái cuối: bảng lương chưa được tạo hoặc chưa cập nhật.

## Includes
- UC-KL-01 — Áp thang khấu trừ kỷ luật và tính hệ số lương.

## Special Requirements
- Việc đọc và gom dữ liệu hoàn tất trong ≤ 10 giây cho đội 5 người ở điều kiện mạng bình thường.
- Số tự động chỉ đọc trên bảng — mọi thay đổi phải qua "Dựng lại" (khi Nháp) hoặc UC-CHOT-02 (khi đã chốt).

## Assumptions
1. Kỳ lương = một tháng dương lịch; một nhân viên có đúng một dòng lương trong một kỳ.
2. Giờ vào / ra ca do phần Lịch làm việc xác định bằng quét Pancake (tin bot đầu tiên, hoạt động cuối ca) — ngoài phạm vi use case này.
3. Đơn giá giờ thường 25.000 đ, đơn giá giờ cuối ca 50.000 đ (đã chốt 08/09/2026), lấy từ tham số hiện hành.

## Notes and Issues
- **[TBD-1]** Có cho dựng bảng lương khi tháng chưa kết thúc (xem trước giữa kỳ) không? | Owner: Hoàng | Chưa quyết
