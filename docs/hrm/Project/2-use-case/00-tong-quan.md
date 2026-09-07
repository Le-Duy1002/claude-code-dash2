# Use Case — Quản lý dự án & tài liệu (tổng quan)

> Đọc file này để nắm toàn bộ. Mỗi Use Case có file chi tiết riêng cùng thư mục.
> Nguồn: [../1-user-story/us.md](../1-user-story/us.md) — 8 user story.
> Template: Karl Wiegers / IIBA (13 trường), tham chiếu Cockburn.

## Bối cảnh

Dashboard nội bộ Next.js + Firebase, giao diện tiếng Việt. Đội gồm **1 quản lý (Hoàng)** và **4 nhân viên sale (Duy, Hà, Quyến, Thương)**. Không có phân quyền phía máy chủ — mọi vai trò gác quyền phía client (quy ước). Tài liệu đồng bộ **hai chiều** với Google Drive; chiều Drive → web dùng **webhook gần realtime** kèm quét dự phòng.

## Actor

| Actor | Vai trò |
| :-- | :-- |
| **Quản lý dự án** (Hoàng) | Tạo & xem dự án, thêm công việc, xem bảng công việc, bình luận, tạo lại thư mục tài liệu |
| **Nhân viên sale** (Duy/Hà/Quyến/Thương) | Kéo-thả cập nhật trạng thái, phản hồi bình luận, tải tài liệu |
| **Thành viên dự án** | Chỉ chung: quản lý *hoặc* nhân viên (tài liệu, bình luận) |
| **Google Drive** (secondary) | Lưu thư mục & tệp; gửi thông báo thay đổi |
| **Hệ thống — tác vụ định kỳ** | Gia hạn kênh theo dõi, quét đối chiếu dự phòng |

## Danh sách Use Case

| ID | Tên | Primary Actor | Priority | Nguồn |
| :-- | :-- | :-- | :-- | :-- |
| [UC-PRJ-01](UC-PRJ-01_tao-du-an-moi.md) | Tạo dự án mới | Quản lý dự án | High | US-PRJ-01 |
| [UC-PRJ-02](UC-PRJ-02_xem-danh-sach-du-an.md) | Xem danh sách dự án | Quản lý dự án | High | US-PRJ-02 |
| [UC-TSK-01](UC-TSK-01_them-cong-viec-vao-du-an.md) | Thêm công việc vào dự án | Quản lý dự án | High | US-TSK-01 |
| [UC-TSK-02](UC-TSK-02_xem-va-loc-bang-cong-viec.md) | Xem và lọc bảng công việc của dự án | Quản lý dự án | High | US-TSK-02 |
| [UC-TSK-03](UC-TSK-03_cap-nhat-trang-thai-keo-tha.md) | Cập nhật trạng thái công việc bằng kéo-thả | Nhân viên sale | High | US-KAN-01 |
| [UC-DOC-01](UC-DOC-01_tai-tai-lieu-len-du-an-tu-web.md) | Tải tài liệu lên dự án từ web | Thành viên dự án | High | US-DOC-01 |
| [UC-DOC-02](UC-DOC-02_dong-bo-thay-doi-tu-drive-ve-web.md) | Đồng bộ thay đổi tài liệu từ Drive về web | Thành viên dự án *(qua Drive)* | High | US-DOC-02 |
| [UC-DOC-03](UC-DOC-03_gia-han-kenh-theo-doi-drive.md) | Gia hạn kênh theo dõi thư mục Drive | Hệ thống *(định kỳ)* | Medium | US-DOC-02 AC-4 |
| [UC-DOC-04](UC-DOC-04_quet-doi-chieu-tai-lieu-du-phong.md) | Quét đối chiếu tài liệu dự phòng | Hệ thống *(định kỳ)* | Medium | US-DOC-02 AC-5 |
| [UC-DOC-05](UC-DOC-05_khoi-tao-thu-muc-tai-lieu-du-an.md) | Khởi tạo thư mục tài liệu cho dự án | Quản lý dự án | Medium | US-PRJ-01 AC-4 |
| [UC-CMT-01](UC-CMT-01_dang-binh-luan-hoac-phan-hoi.md) | Đăng bình luận hoặc phản hồi trên công việc | Thành viên dự án | Medium | US-CMT-01 |
| [UC-CMT-02](UC-CMT-02_xoa-binh-luan.md) | Xoá bình luận trên công việc | Thành viên dự án | Low | US-CMT-01 AC-3 |

## Quan hệ giữa Use Case

- **UC-PRJ-01** `«includes»` **UC-DOC-05** — tạo dự án luôn kéo theo tạo thư mục tài liệu.
- **UC-DOC-05** cũng chạy độc lập khi quản lý bấm "Tạo lại thư mục" (sau lỗi ở UC-PRJ-01.EX.3).
- **UC-DOC-01** phụ thuộc **UC-DOC-05** đã hoàn tất (dự án phải có thư mục).
- **UC-DOC-03** và **UC-DOC-04** là lưới an toàn cho **UC-DOC-02** (kênh hết hạn / mất thông báo).

## Tóm tắt từng Use Case

1. **UC-PRJ-01 Tạo dự án mới** — Quản lý nhập tên/mô tả/mốc thời gian/người phụ trách → hệ thống lưu dự án "Đang chạy" và tạo thư mục Drive riêng (qua UC-DOC-05). Chặn: thiếu tên, ngày kết thúc trước ngày bắt đầu. Nếu tạo thư mục lỗi thì dự án vẫn lưu, đánh dấu "chưa có thư mục".
2. **UC-PRJ-02 Xem danh sách dự án** — Hiển thị mọi dự án kèm tiến độ "x/y công việc hoàn thành" và cờ "Quá hạn"; lọc theo khoảng thời gian. Trạng thái trống → mời tạo dự án đầu tiên.
3. **UC-TSK-01 Thêm công việc vào dự án** — Quản lý thêm công việc (tiêu đề, người đảm nhiệm, độ ưu tiên, mốc thời gian) → lưu ở "Chưa bắt đầu", gắn dự án. Chặn: thiếu tiêu đề / người đảm nhiệm. Cảnh báo (không chặn): hạn công việc trễ hơn hạn dự án.
4. **UC-TSK-02 Xem và lọc bảng công việc** — Bảng mọi công việc của dự án, lọc theo trạng thái / độ ưu tiên / người đảm nhiệm / thời gian; cột "Còn N ngày" hoặc "Quá hạn N ngày" (việc đã hoàn thành không cảnh báo); bộ lọc rỗng → bảng trống có thông báo.
5. **UC-TSK-03 Kéo-thả cập nhật trạng thái** — Kéo thẻ sang cột khác → trạng thái đổi ngay, không mở form, đồng bộ cho người xem khác trong vài giây. Thả lại cột cũ → không đổi. Ghi lỗi → thẻ về cột cũ. Xung đột đồng thời → thao tác sau cùng thắng, đồng bộ lại tất cả.
6. **UC-DOC-01 Tải tài liệu lên từ web** — Chọn tệp trên web → đẩy vào thư mục Drive của dự án + tạo bản ghi tài liệu (nguồn "web"). Chặn: tệp > ~4 MB (mời tải thẳng lên Drive), dự án chưa có thư mục (mời tạo).
7. **UC-DOC-02 Đồng bộ Drive → web (webhook)** — Ai đó đổi tệp thẳng trong thư mục Drive → Google gửi thông báo → hệ thống đọc lại thư mục, thêm/gỡ/cập nhật bản ghi tài liệu trong vài giây; tệp tải từ web không bị nhân đôi. Mất quyền đọc Drive → giữ nguyên danh sách cũ, ghi cảnh báo.
8. **UC-DOC-03 Gia hạn kênh theo dõi** — Tác vụ định kỳ đăng ký kênh mới trước khi kênh cũ hết hạn (~7 ngày) để UC-DOC-02 không đứt. Đăng ký lỗi → thử lại lần sau, tạm dựa vào UC-DOC-04.
9. **UC-DOC-04 Quét đối chiếu dự phòng** — Tác vụ định kỳ thưa (mỗi giờ) quét mọi thư mục dự án và đồng bộ lại danh sách web cho khớp Drive, bù cho các thông báo webhook bị mất. Quá thời gian chạy → làm dở đến đâu lưu đến đó, tiếp tục lần sau.
10. **UC-DOC-05 Khởi tạo thư mục tài liệu** — Tạo thư mục con trong thư mục gốc ứng dụng (phạm vi `drive.file`), liên kết id với dự án, đăng ký kênh theo dõi. Gọi bởi UC-PRJ-01 hoặc chạy độc lập khi tạo lại.
11. **UC-CMT-01 Đăng bình luận / phản hồi** — Thành viên viết bình luận trên công việc, hoặc phản hồi lồng dưới một bình luận có sẵn; kèm tên người + thời điểm. Chặn: nội dung rỗng.
12. **UC-CMT-02 Xoá bình luận** — Người viết (hoặc quản lý) xoá bình luận của mình. Nếu còn phản hồi con → gỡ nội dung, đánh dấu "đã xoá", giữ các phản hồi. Không phải người viết / không phải quản lý → không thấy nút xoá.

## Ngoài phạm vi (vòng sau)

Sửa / đóng dự án · xoá công việc · thông báo (notification) khi được giao việc hoặc có bình luận mới · phân quyền phía máy chủ · gắn tài liệu vào từng công việc · công việc con / checklist · sắp thứ tự thẻ trong cột Kanban.

## Bước 4 — Kết quả validate (checklist 20 điểm)

| # | Item | Status | Ghi chú |
| :-- | :-- | :-- | :-- |
| C1 | Verb + Object | ✅ | Mọi tên đều dạng động từ + đối tượng |
| C2 | Coffee-break test (user-goal level) | ⚠️ | 9 UC ở user-goal level; UC-DOC-03/04 là tác vụ định kỳ nội bộ (hợp lệ theo quy tắc event-driven) |
| C3 | Unique ID | ✅ | Tiền tố PRJ / TSK / DOC / CMT |
| C4 | 1 Actor, 1 Goal | ⚠️ | UC-CMT-01 gộp "bình luận" và "phản hồi" — cùng mục tiêu trao đổi, phản hồi là Alternative Course |
| C5 | System boundary | ✅ | |
| C6 | Specific actor (không "User") | ✅ | Quản lý dự án / Nhân viên sale / Thành viên dự án / Hệ thống / Google Drive |
| C7 | Description có WHY + WHAT + OUTCOME | ✅ | |
| C8 | Frequency định lượng | ✅ | Đã ghi con số ước lượng cho đội 5 người |
| C9 | Preconditions verify được | ✅ | |
| C10 | Postconditions phủ mọi thay đổi trạng thái khi thành công | ✅ | |
| C11 | Precondition ≠ Assumption | ✅ | Tách riêng hai mục |
| C12 | Mỗi step một hành động | ✅ | |
| C13 | Xen kẽ Actor / System, chủ ngữ rõ | ✅ | |
| C14 | Không nhúng if/else/loop trong Normal Course | ✅ | Chuyển sang Alternative / Exception |
| C15 | Luồng đầy đủ trigger → postcondition | ✅ | |
| C16 | Alternative Course ghi rõ "tại bước N" | ✅ | |
| C17 | Exception đủ 3 phần (trigger + phản hồi + trạng thái cuối) | ✅ | |
| C18 | Phủ các lỗi phổ biến | ✅ | Timeout, nhập sai, mất mạng, không có quyền, xung đột đồng thời — trải khắp các UC |
| C19 | Includes trỏ tới UC có tồn tại | ✅ | UC-PRJ-01 → UC-DOC-05 (đã có file) |
| C20 | Special Requirements là NFR, không phải chức năng | ✅ | Perf, runtime, security, realtime |

**Hai điểm ⚠️ là chủ ý và có ghi chú** — chấp nhận được để bàn giao. Khi vào Sprint Planning, cân nhắc: tách "hạ tầng webhook" khỏi UC-DOC-02 nếu ước lượng lớn; tách UC-CMT-01 thành "bình luận" / "phản hồi" nếu muốn story nhỏ hơn.
