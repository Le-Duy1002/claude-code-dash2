# UC-CMT-02 — Xoá bình luận trên công việc

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CMT-02 |
| **Use Case Name** | Xoá bình luận trên công việc |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Thành viên dự án (người viết bình luận đó, hoặc quản lý) |
| **Secondary Actor** | — |
| **Priority** | Low |
| **Frequency of Use** | Hiếm — vài lần / tháng |
| **Nguồn** | US-CMT-01 (AC-3) |

**Description:** Người viết cần gỡ bình luận sai hoặc thừa mà không làm mất mạch trao đổi của người khác. Use case xoá một bình luận; nếu bình luận đó còn phản hồi bên dưới thì các phản hồi được giữ lại và bình luận gốc hiển thị dạng "đã xoá". Kết thúc: bình luận không còn nội dung nhưng luồng phản hồi được bảo toàn.

**Preconditions:**
1. Thành viên đã đăng nhập.
2. Bình luận đích tồn tại và do chính thành viên đó viết, hoặc thành viên là quản lý.

**Postconditions (thành công):**
1. Nếu bình luận không có phản hồi: bản ghi bị xoá hoàn toàn khỏi luồng.
2. Nếu bình luận có phản hồi: nội dung bị gỡ, bình luận hiển thị "đã xoá", mọi phản hồi con vẫn hiển thị đúng vị trí.

## Normal Course of Events
1. Thành viên chọn "xoá" trên bình luận của mình.
2. Hệ thống hỏi xác nhận xoá.
3. Thành viên xác nhận.
4. Hệ thống kiểm tra bình luận có phản hồi con hay không.
5. Nếu không có phản hồi con, hệ thống xoá bản ghi bình luận.
6. Hệ thống cập nhật luồng bình luận của công việc.

## Alternative Courses
- **UC-CMT-02.AC.1** — Tại bước 4, nếu bình luận có phản hồi con, tại bước 5 hệ thống gỡ nội dung và đánh dấu bình luận "đã xoá" thay vì xoá bản ghi, giữ nguyên các phản hồi con.

## Exceptions
- **UC-CMT-02.EX.1 — Không có quyền:** Tại bước 1, nếu bình luận không do thành viên viết và thành viên không phải quản lý → hệ thống không hiển thị chức năng xoá. Trạng thái cuối: bình luận không đổi.
- **UC-CMT-02.EX.2 — Lỗi xoá:** Tại bước 5, nếu ghi thất bại → hệ thống giữ nguyên bình luận và thông báo để thử lại. Trạng thái cuối: bình luận không đổi.

## Includes
- —

## Special Requirements
- —

## Assumptions
1. "Quyền xoá" là quy ước phía client, không ép buộc phía máy chủ.
2. Không có chức năng khôi phục bình luận đã xoá.

## Notes and Issues
- —
