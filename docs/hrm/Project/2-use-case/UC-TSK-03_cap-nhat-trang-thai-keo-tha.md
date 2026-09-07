# UC-TSK-03 — Cập nhật trạng thái công việc bằng kéo-thả

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-TSK-03 |
| **Use Case Name** | Cập nhật trạng thái công việc bằng kéo-thả |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Nhân viên sale (Duy / Hà / Quyến / Thương) |
| **Secondary Actor** | Quản lý dự án (người đang xem bảng đồng thời) |
| **Priority** | High |
| **Frequency of Use** | Hàng chục lần / ngày toàn đội |
| **Nguồn** | US-KAN-01 |

**Description:** Nhân viên cần báo tiến độ tức thì mà không phải mở form chỉnh sửa, để dữ liệu tiến độ sát thực tế. Use case cho phép kéo thẻ công việc giữa các cột trạng thái trên bảng Kanban; hệ thống cập nhật trạng thái ngay và đồng bộ cho những người đang xem bảng của dự án. Kết thúc: trạng thái công việc phản ánh cột nơi thả thẻ và mọi người xem thấy cùng kết quả.

**Preconditions:**
1. Nhân viên đã đăng nhập.
2. Công việc đang hiển thị trên bảng Kanban của dự án.

**Postconditions (thành công):**
1. Trạng thái công việc bằng trạng thái của cột nơi thả thẻ.
2. Bản ghi cập nhật (thời điểm, người thực hiện) được lưu.
3. Bảng Kanban của mọi người đang xem dự án hiển thị thẻ ở cột mới trong vài giây.

## Normal Course of Events
1. Nhân viên kéo thẻ công việc ra khỏi cột hiện tại.
2. Hệ thống hiển thị vị trí thả dự kiến.
3. Nhân viên thả thẻ vào một cột trạng thái khác.
4. Hệ thống cập nhật trạng thái công việc theo cột đích và lưu bản ghi cập nhật.
5. Hệ thống hiển thị thẻ ở cột đích trên bảng của nhân viên.
6. Hệ thống phát thay đổi tới các phiên đang mở bảng Kanban của dự án; các bảng đó hiển thị thẻ ở cột đích.

## Alternative Courses
- **UC-TSK-03.AC.1** — Tại bước 3, nếu nhân viên thả thẻ trở lại đúng cột cũ, hệ thống không thay đổi trạng thái và không tạo bản ghi cập nhật. Use case kết thúc.

## Exceptions
- **UC-TSK-03.EX.1 — Lỗi ghi trạng thái:** Tại bước 4, nếu ghi cơ sở dữ liệu thất bại → hệ thống đưa thẻ về cột cũ trên bảng của nhân viên và thông báo "Không cập nhật được trạng thái, thử lại". Trạng thái cuối: trạng thái công việc không đổi.
- **UC-TSK-03.EX.2 — Xung đột đồng thời:** Tại bước 4, nếu trạng thái công việc vừa bị người khác đổi → hệ thống áp trạng thái theo thao tác hoàn tất sau cùng và đồng bộ lại tất cả bảng về trạng thái đó. Trạng thái cuối: nhất quán trên mọi phiên.

## Includes
- —

## Special Requirements
- Đồng bộ realtime cho ≥ 3 người xem cùng lúc.
- Có phản hồi hình ảnh khi kéo và khi thả, không giật.
- Hoàn tác được về trạng thái cũ khi ghi lỗi. (Xem Definition of Done trong US-KAN-01.)

## Assumptions
1. Các cột Kanban ánh xạ 1-1 với tập trạng thái công việc.
2. Kéo-thả chỉ đổi trạng thái, không đổi thứ tự ưu tiên trong cột (vòng sau).

## Notes and Issues
- **[TBD-1]** Số cột và nhãn cột Kanban cuối cùng | Owner: Hoàng
