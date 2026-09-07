# UC-PRJ-01 — Tạo dự án mới

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-PRJ-01 |
| **Use Case Name** | Tạo dự án mới |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý dự án (Hoàng) |
| **Secondary Actor** | Google Drive (lưu thư mục tài liệu) |
| **Priority** | High |
| **Frequency of Use** | ~4–8 lần / tháng (mỗi chiến dịch hoặc khách lớn một dự án) |
| **Nguồn** | US-PRJ-01 |

**Description:** Quản lý cần một không gian riêng cho mỗi mục tiêu công việc để công việc và tài liệu không lẫn giữa các dự án. Use case cho phép quản lý khai báo dự án mới với tên, mô tả, mốc thời gian, người phụ trách; hệ thống lưu dự án và tự khởi tạo một thư mục tài liệu Drive gắn với dự án đó. Kết thúc: có bản ghi dự án ở trạng thái "Đang chạy" và một thư mục tài liệu liên kết.

**Preconditions:**
1. Quản lý đã đăng nhập vào dashboard.
2. Cấu hình OAuth chủ thư mục Drive của ứng dụng còn hiệu lực.

**Postconditions (thành công):**
1. Bản ghi dự án được tạo với trạng thái = "Đang chạy", đủ tên, mốc thời gian và ít nhất một người phụ trách (cho phép nhiều người phụ trách).
2. Thư mục tài liệu riêng của dự án được tạo trong thư mục gốc của ứng dụng và id thư mục được lưu vào bản ghi dự án — hoặc dự án được đánh dấu "chưa có thư mục tài liệu" nếu bước này lỗi (xem EX.3).
3. Dự án hiển thị trong danh sách dự án.

## Normal Course of Events
1. Quản lý chọn chức năng "Tạo dự án".
2. Hệ thống hiển thị biểu mẫu tạo dự án.
3. Quản lý nhập tên dự án, mô tả, ngày bắt đầu, ngày kết thúc và chọn một hoặc nhiều người phụ trách.
4. Quản lý xác nhận tạo.
5. Hệ thống kiểm tra dữ liệu hợp lệ.
6. Hệ thống lưu bản ghi dự án ở trạng thái "Đang chạy".
7. Hệ thống thực hiện UC-DOC-05 để khởi tạo thư mục tài liệu cho dự án.
8. Hệ thống hiển thị dự án vừa tạo trong danh sách và thông báo tạo thành công.

## Alternative Courses
- **UC-PRJ-01.AC.1** — Tại bước 3, nếu quản lý chọn nhiều người phụ trách, hệ thống lưu toàn bộ danh sách người phụ trách và tiếp tục bước 4.

## Exceptions
- **UC-PRJ-01.EX.1 — Thiếu tên dự án:** Tại bước 5, nếu tên dự án trống → hệ thống dừng, không tạo bản ghi, thông báo "Tên dự án là bắt buộc", giữ nguyên dữ liệu đã nhập. Trạng thái cuối: chưa có dự án mới.
- **UC-PRJ-01.EX.5 — Thiếu người phụ trách:** Tại bước 5, nếu chưa chọn người phụ trách nào → hệ thống dừng, thông báo "Phải chọn ít nhất một người phụ trách". Trạng thái cuối: chưa có dự án mới.
- **UC-PRJ-01.EX.2 — Ngày kết thúc trước ngày bắt đầu:** Tại bước 5, nếu ngày kết thúc < ngày bắt đầu → hệ thống dừng, thông báo "Ngày kết thúc phải sau ngày bắt đầu". Trạng thái cuối: chưa có dự án mới.
- **UC-PRJ-01.EX.3 — Không tạo được thư mục tài liệu:** Tại bước 7, nếu UC-DOC-05 thất bại → hệ thống vẫn giữ bản ghi dự án đã lưu ở bước 6, đánh dấu dự án "chưa có thư mục tài liệu", thông báo cho quản lý và cung cấp thao tác tạo lại thư mục sau. Trạng thái cuối: dự án tồn tại nhưng chưa liên kết thư mục.
- **UC-PRJ-01.EX.4 — Mất kết nối khi lưu:** Tại bước 6, nếu ghi cơ sở dữ liệu thất bại → hệ thống không tạo bản ghi, giữ nguyên dữ liệu biểu mẫu, thông báo lỗi để thử lại. Trạng thái cuối: chưa có dự án mới.

## Includes
- UC-DOC-05 — Khởi tạo thư mục tài liệu cho dự án.

## Special Requirements
- Việc tạo thư mục Drive dùng OAuth chủ thư mục (phạm vi `drive.file`) và chạy trên Node runtime.
- Biểu mẫu phản hồi kết quả tạo trong ≤ 3 giây ở điều kiện mạng bình thường.

## Assumptions
1. Mỗi dự án có đúng một thư mục tài liệu Drive.
2. Một dự án có 1 hoặc nhiều người phụ trách (đã chốt 07/09/2026).
3. Quản lý là người duy nhất tạo dự án (chưa có phân quyền cứng phía máy chủ).

## Notes and Issues
- ~~[TBD-1] Người phụ trách 1 hay nhiều người?~~ → **Đã chốt (07/09/2026):** cho phép 1 hoặc nhiều người.
- **[TBD-2]** Có sinh mã dự án tự động (PRJ-2026-001…) không? | Owner: Hoàng | Chưa quyết

