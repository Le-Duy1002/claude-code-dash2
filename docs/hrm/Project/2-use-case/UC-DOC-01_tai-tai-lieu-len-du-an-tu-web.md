# UC-DOC-01 — Tải tài liệu lên dự án từ web

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-DOC-01 |
| **Use Case Name** | Tải tài liệu lên dự án từ web |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Thành viên dự án (quản lý hoặc nhân viên sale) |
| **Secondary Actor** | Google Drive (nơi lưu tệp) |
| **Priority** | High |
| **Frequency of Use** | ~10–30 lần / tuần |
| **Nguồn** | US-DOC-01 |

**Description:** Thành viên cần đưa tài liệu vào dự án ngay trên web và có nó trong Drive để cả đội truy cập từ Drive. Use case nhận tệp tải lên từ web, đẩy tệp vào thư mục Drive của dự án và tạo bản ghi tài liệu của dự án. Kết thúc: tài liệu hiển thị trong dự án trên web và nằm trong thư mục Drive của dự án.

**Preconditions:**
1. Thành viên đã đăng nhập.
2. Dự án đã có thư mục tài liệu Drive liên kết.
3. Tệp không vượt giới hạn dung lượng (khoảng 4 MB).

**Postconditions (thành công):**
1. Bản ghi tài liệu được tạo, gắn với dự án, đánh dấu nguồn "tải từ web".
2. Tệp tồn tại trong thư mục Drive của dự án.
3. Tài liệu hiển thị trong danh sách tài liệu của dự án.

## Normal Course of Events
1. Thành viên mở khu vực tài liệu của dự án và chọn tải lên.
2. Thành viên chọn tệp từ máy.
3. Hệ thống kiểm tra dung lượng và loại tệp.
4. Hệ thống tải tệp lên thư mục Drive của dự án bằng OAuth chủ thư mục.
5. Hệ thống tạo bản ghi tài liệu gắn dự án, lưu liên kết Drive và nguồn "web".
6. Hệ thống hiển thị tài liệu trong danh sách tài liệu của dự án.

## Alternative Courses
- **UC-DOC-01.AC.1** — Tại bước 2, nếu thành viên chọn nhiều tệp, hệ thống lặp bước 3–6 cho từng tệp và báo tổng kết số tệp thành công / thất bại. *(tuỳ chọn)*

## Exceptions
- **UC-DOC-01.EX.1 — Vượt giới hạn dung lượng:** Tại bước 3, nếu tệp lớn hơn giới hạn → hệ thống từ chối, thông báo "Tệp vượt giới hạn, vui lòng tải trực tiếp lên thư mục Drive của dự án". Trạng thái cuối: không có tài liệu mới.
- **UC-DOC-01.EX.2 — Dự án chưa có thư mục tài liệu:** Tại bước 1, nếu dự án chưa liên kết thư mục Drive → hệ thống ẩn chức năng tải lên và hiển thị thao tác "Tạo thư mục tài liệu cho dự án" (UC-DOC-05). Trạng thái cuối: chưa tải được.
- **UC-DOC-01.EX.3 — Lỗi khi đẩy lên Drive:** Tại bước 4, nếu tải lên Drive thất bại → hệ thống không tạo bản ghi tài liệu treo, thông báo "Tải lên thất bại, thử lại". Trạng thái cuối: không có tài liệu mới.

## Includes
- — (phụ thuộc UC-DOC-05 đã chạy trước để dự án có thư mục)

## Special Requirements
- Upload chạy trên Node runtime; kích thước tối đa khoảng 4 MB do giới hạn thân request của nền tảng.
- Hiển thị tiến trình tải cho người dùng.

## Assumptions
1. Tài liệu gắn ở cấp dự án, không cấp công việc (vòng sau).
2. Không kiểm soát phiên bản khi trùng tên tệp — để Drive tự xử lý.

## Notes and Issues
- **[TBD-1]** Có chặn loại tệp nguy hiểm (exe, script…) không? | Owner: BA
