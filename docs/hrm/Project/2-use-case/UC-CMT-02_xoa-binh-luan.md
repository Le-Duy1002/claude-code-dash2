# UC-CMT-02 — Xoá bình luận trên công việc

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-CMT-02 |
| **Use Case Name** | Xoá bình luận trên công việc |
| **Created By** | BA · **Cập nhật bởi:** BA |
| **Ngày tạo** | 07/09/2026 · **Cập nhật:** 08/09/2026 |
| **Primary Actor** | Thành viên dự án — người đã viết bình luận đó |
| **Secondary Actor** | — |
| **Priority** | Low |
| **Frequency of Use** | Hiếm — vài lần / tháng |
| **Nguồn** | US-CMT-01 (AC-3) |

**Description:** Người viết cần gỡ một bình luận sai hoặc thừa. Use case xoá bình
luận đó; nếu bình luận còn phản hồi bên dưới thì **cả nhánh** (bình luận gốc và
mọi phản hồi con) bị xoá cùng lúc trong một thao tác nguyên tử — đồng bộ với hành
vi bình luận phân luồng của `features/tasks`. Kết thúc: nhánh bình luận không còn
trong luồng của công việc.

**Preconditions:**
1. Thành viên đã đăng nhập.
2. Bình luận đích tồn tại và do chính thành viên đó viết.

**Postconditions (thành công):**
1. Bản ghi bình luận đích bị xoá hoàn toàn khỏi luồng.
2. Nếu bình luận có phản hồi con: mọi phản hồi con (mọi cấp) cũng bị xoá trong
   cùng một batch ghi.
3. Luồng bình luận của công việc cập nhật cho mọi người xem trong vài giây.

## Normal Course of Events
1. Thành viên chọn "xoá" trên bình luận của mình.
2. Hệ thống hỏi xác nhận, nêu rõ mọi phản hồi bên trong cũng sẽ bị xoá.
3. Thành viên xác nhận.
4. Hệ thống thu thập id của bình luận đích và toàn bộ phản hồi con từ cây bình
   luận đang hiển thị.
5. Hệ thống xoá tất cả các bản ghi đó trong một `writeBatch` nguyên tử.
6. Hệ thống cập nhật luồng bình luận của công việc.

## Alternative Courses
- —

## Exceptions
- **UC-CMT-02.EX.1 — Không có quyền:** Tại bước 1, nếu bình luận không do thành
  viên đang đăng nhập viết → hệ thống không hiển thị nút xoá cho bình luận đó.
  Trạng thái cuối: bình luận không đổi.
- **UC-CMT-02.EX.2 — Lỗi xoá:** Tại bước 5, nếu batch ghi thất bại → hệ thống
  giữ nguyên toàn bộ nhánh bình luận và thông báo để thử lại. Trạng thái cuối:
  bình luận không đổi.

## Includes
- —

## Special Requirements
- Xoá nhánh phải nguyên tử: hoặc xoá hết, hoặc không xoá gì.

## Assumptions
1. "Quyền xoá" là quy ước phía client cộng với luật Firestore
   `resource.data.createdByUid == request.auth.uid` — chỉ người viết xoá được.
2. Không có chức năng khôi phục bình luận đã xoá.
3. Không giữ "bia mộ" (đánh dấu đã xoá) — nhánh biến mất hẳn khỏi luồng.

## Notes and Issues
- Trước đây bản nháp mô tả xoá mềm (giữ phản hồi, đánh dấu bình luận gốc "đã
  xoá"). Đã đổi sang xoá cả nhánh để đồng bộ với `features/tasks` được tái dùng.
