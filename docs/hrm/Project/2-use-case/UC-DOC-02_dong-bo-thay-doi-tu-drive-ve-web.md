# UC-DOC-02 — Đồng bộ thay đổi tài liệu từ Drive về web

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-DOC-02 |
| **Use Case Name** | Đồng bộ thay đổi tài liệu từ Drive về web |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Thành viên dự án (thao tác trực tiếp trong thư mục Drive) |
| **Secondary Actor** | Google Drive (gửi thông báo thay đổi) |
| **Priority** | High |
| **Frequency of Use** | Theo sự kiện — ước ~5–40 thông báo / ngày cho toàn bộ dự án |
| **Nguồn** | US-DOC-02 |

**Description:** Danh sách tài liệu trên web phải khớp với Drive dù người thao tác không dùng web, với độ trễ thấp. Use case: khi thư mục Drive của một dự án thay đổi, Google Drive gửi thông báo tới hệ thống, hệ thống đọc lại thư mục và cập nhật danh sách tài liệu của dự án trên web trong vài giây. Kết thúc: danh sách tài liệu web phản ánh nội dung thư mục Drive.

**Preconditions:**
1. Dự án đã có thư mục tài liệu Drive.
2. Hệ thống đã đăng ký kênh theo dõi thay đổi (watch channel) cho thư mục đó và kênh còn hiệu lực.

**Postconditions (thành công):**
1. Mọi tệp mới trong thư mục Drive có bản ghi tài liệu tương ứng trên web, đánh dấu nguồn "từ Drive".
2. Mọi tệp đã bị xoá khỏi thư mục Drive không còn trong danh sách web.
3. Không tạo bản ghi trùng cho tệp đã có (kể cả tệp vừa tải lên từ web).

## Normal Course of Events
1. Thành viên thêm, đổi tên hoặc xoá một tệp trong thư mục Drive của dự án.
2. Google Drive gửi thông báo thay đổi tới endpoint của hệ thống.
3. Hệ thống xác thực nguồn thông báo và xác định dự án tương ứng với kênh.
4. Hệ thống đọc nội dung hiện tại của thư mục Drive dự án đó.
5. Hệ thống đối chiếu với danh sách tài liệu của dự án trên web: thêm bản ghi cho tệp mới, gỡ bản ghi cho tệp đã mất, cập nhật tên và thời điểm sửa cho tệp đổi.
6. Danh sách tài liệu của dự án trên web phản ánh thay đổi trong vài giây.

## Alternative Courses
- **UC-DOC-02.AC.1** — Tại bước 5, nếu tệp thay đổi là tệp vừa được tải lên qua web (UC-DOC-01), hệ thống nhận diện theo liên kết Drive đã lưu và chỉ cập nhật, không tạo bản ghi mới.

## Exceptions
- **UC-DOC-02.EX.1 — Thông báo không xác thực được:** Tại bước 3, nếu không xác thực được nguồn từ Google → hệ thống bỏ qua thông báo và ghi nhật ký cảnh báo. Trạng thái cuối: không thay đổi dữ liệu.
- **UC-DOC-02.EX.2 — Không đọc được thư mục Drive:** Tại bước 4, nếu quyền truy cập thư mục bị thu hồi hoặc Drive lỗi → hệ thống giữ nguyên danh sách tài liệu hiện có của dự án, ghi cảnh báo đồng bộ, không xoá dữ liệu. Trạng thái cuối: danh sách cũ được bảo toàn.
- **UC-DOC-02.EX.3 — Mất thông báo:** Nếu trong một khoảng thời gian không nhận được thông báo nào cho một dự án → đợt quét dự phòng UC-DOC-04 sẽ đối chiếu lại. (Không xử lý trong use case này.)

## Includes
- —

## Special Requirements
- Endpoint nhận webhook chạy trên Node runtime, xác thực token kênh của Google.
- Cập nhật web trong ≤ 10 giây kể từ khi nhận thông báo.

## Assumptions
1. Mỗi thư mục dự án có đúng một kênh theo dõi.
2. Google Drive gửi thông báo ở mức "thư mục có thay đổi"; hệ thống tự đọc chi tiết.

## Notes and Issues
- **[TBD-1]** Endpoint webhook công khai host ở đâu (Vercel function)? | Owner: Dev
- **[TBD-2]** Có gộp các thông báo dồn dập (debounce) không? | Owner: Dev
