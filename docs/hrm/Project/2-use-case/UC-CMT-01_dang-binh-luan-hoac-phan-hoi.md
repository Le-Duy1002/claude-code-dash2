# UC-CMT-01 — Đăng bình luận hoặc phản hồi trên công việc

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CMT-01 |
| **Use Case Name** | Đăng bình luận hoặc phản hồi trên công việc |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Thành viên dự án (quản lý hoặc nhân viên sale) |
| **Secondary Actor** | — |
| **Priority** | Medium |
| **Frequency of Use** | ~10–40 lần / tuần toàn đội |
| **Nguồn** | US-CMT-01 |

**Description:** Trao đổi về công việc cần được lưu tại chỗ, không lạc trong tin nhắn riêng. Use case cho phép thành viên viết một bình luận trên công việc, hoặc phản hồi vào một bình luận có sẵn. Kết thúc: bình luận hoặc phản hồi hiển thị trong luồng của công việc kèm tên người và thời điểm.

**Preconditions:**
1. Thành viên đã đăng nhập.
2. Công việc đích đã tồn tại.

**Postconditions (thành công):**
1. Bản ghi bình luận được tạo, gắn với công việc, có người viết và thời điểm.
2. Nếu là phản hồi, bản ghi tham chiếu bình luận cha và hiển thị lồng dưới bình luận cha.
3. Bình luận xuất hiện trong luồng của công việc cho mọi người xem.

## Normal Course of Events
1. Thành viên mở luồng bình luận của một công việc.
2. Thành viên nhập nội dung vào ô soạn ở mức luồng.
3. Thành viên gửi.
4. Hệ thống kiểm tra nội dung không rỗng.
5. Hệ thống lưu bình luận gắn công việc, ghi người viết và thời điểm.
6. Hệ thống hiển thị bình luận ở cuối luồng.

## Alternative Courses
- **UC-CMT-01.AC.1** — Tại bước 2, nếu thành viên chọn "phản hồi" trên một bình luận có sẵn, hệ thống hiển thị ô soạn gắn với bình luận đó; ở bước 5 bản ghi được lưu kèm tham chiếu bình luận cha; ở bước 6 phản hồi hiển thị lồng dưới bình luận cha.

## Exceptions
- **UC-CMT-01.EX.1 — Nội dung rỗng:** Tại bước 4, nếu nội dung trống hoặc chỉ có khoảng trắng → hệ thống không tạo bình luận. Trạng thái cuối: không có bình luận mới.
- **UC-CMT-01.EX.2 — Lỗi lưu:** Tại bước 5, nếu ghi thất bại → hệ thống giữ lại nội dung đã soạn và thông báo để gửi lại. Trạng thái cuối: không có bình luận mới.

## Includes
- —

## Special Requirements
- Luồng bình luận phân cấp (threaded).
- Bình luận mới hiển thị cho người xem khác trong vài giây.

## Assumptions
1. Mọi thành viên đăng nhập đều được bình luận (chưa phân quyền cứng).
2. Không giới hạn độ dài bình luận ở mức nghiệp vụ.

## Notes and Issues
- **[TBD-1]** Có gửi thông báo cho người đảm nhiệm khi có bình luận mới không? | vòng sau
