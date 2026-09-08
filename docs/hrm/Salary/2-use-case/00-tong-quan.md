# Use Case — Bảng tính lương nhân sự Sale – Pancake (tổng quan)

> Đọc file này để nắm toàn bộ. Mỗi Use Case có file chi tiết riêng cùng thư mục.
> Nguồn: [../1-user-story/us.md](../1-user-story/us.md) — 7 user story.
> Template: Karl Wiegers / IIBA (13 trường), tham chiếu Cockburn.

## Bối cảnh

Dashboard nội bộ Next.js + Firebase, giao diện tiếng Việt. Đội gồm **1 quản lý (Hoàng)** và **4 nhân viên sale (Duy, Hà, Quyến, Thương)**. Không có phân quyền phía máy chủ — mọi vai trò gác quyền phía client (quy ước).

Tính năng #4 — module `features/payroll` (mới). Bảng lương **không nhập tay xuyên bảng**: hệ thống gom số từ hai nguồn sẵn có rồi áp công thức A–E của bảng Excel cũ:

- **Lịch làm việc** (`features/schedule`) — giờ đăng ký, giờ làm thực tế, số lần đến muộn / bỏ ca (đối chiếu giờ vào/ra ca bằng quét Pancake).
- **Theo dõi công việc / Nhật ký AI** (`features/pancake`) — tỷ lệ phản hồi đúng hạn, tỷ lệ gán tag, số hội thoại bỏ sót, tỷ lệ chốt qua demo, xếp loại tổng kỳ.

Chỉ **doanh thu chốt qua demo** và **số lần nộp báo cáo tháng trễ** là nhập tay; **thưởng cố định 500.000 đ** do quản lý duyệt khi có gợi ý.

## Quyết định đã chốt (08/09/2026)

- **Đơn giá giờ:** giờ thường 25.000 đ; **giờ cuối của mỗi ca tính gấp đôi — 50.000 đ** (Sáng 12–13h, Chiều 18–19h, Tối 23–24h).
- **Giờ theo lịch** giữ đúng độ dài từng ca (Sáng 5h / Chiều 6h / Tối 5h), **không** quy tròn về 6h như sheet cũ.
- **Thang thưởng demo:** mốc biên thuộc bậc dưới — phải vượt hẳn mốc mới lên bậc trên (đúng 20% vẫn là 10%, > 20% mới 18%).
- **Thưởng cố định:** hệ thống hiện thông báo gợi ý khi nhân viên xếp loại "Xuất sắc" (điểm ≥ 90); **quản lý tự duyệt**, không tự cộng.
- **Đến muộn** = vào ca trễ 10 phút → dưới 60 phút (< 10 phút: dung sai). **Bỏ ca** = vắng mặt trong ca ≥ 60 phút, chia hai mức tại **90 phút**.
- **Giờ vào / ra ca:** giờ vào = tin nhắn bot đầu tiên trong khung ca; giờ ra = hoạt động cuối gần cuối ca (cuối ca vắng khách tự nhiên vẫn tính đủ ca). Việc phát hiện này thuộc Lịch làm việc, ngoài phạm vi các use case ở đây.

## Còn chờ quyết định

- Mốc 90 phút chia hai mức "bỏ ca" là quy ước tạm — có thể chỉnh qua tham số (UC-KL-01 TBD-1).
- Có cho dựng bảng lương khi tháng chưa kết thúc (xem trước giữa kỳ) không (UC-LUONG-01 TBD-1).
- Có yêu cầu vai trò "quản lý" cứng phía máy chủ để chốt lương không (UC-CHOT-01 TBD-1).
- Có lưu lịch sử các lần đổi tham số lương không (UC-CAUHINH-01 TBD-1).

## Actor

| Actor | Vai trò |
| :-- | :-- |
| **Quản lý** (Hoàng) | Dựng bảng lương, nhập khoản thủ công, duyệt thưởng cố định, xem phiếu chi tiết, chốt & điều chỉnh, cấu hình tham số |
| **Nhân viên sale** (Duy/Hà/Quyến/Thương) | Xem phiếu lương của chính mình sau khi đã chốt |
| **Hệ thống — tính khấu trừ** | Quy các chỉ số kỷ luật thành % trừ hệ số, cộng tổng, kẹp trần khi số liệu một dòng lương thay đổi |
| **Lịch làm việc / Chấm điểm Pancake** *(nguồn dữ liệu)* | Cung cấp giờ công và các chỉ số chấm điểm cho kỳ |

## Danh sách Use Case

| ID | Tên | Primary Actor | Priority | Nguồn |
| :-- | :-- | :-- | :-- | :-- |
| [UC-LUONG-01](UC-LUONG-01_dung-bang-luong-thang.md) | Dựng bảng lương tháng | Quản lý | High | US-LUONG-01 |
| [UC-KL-01](UC-KL-01_ap-thang-khau-tru-ky-luat.md) | Áp thang khấu trừ kỷ luật và tính hệ số lương | Hệ thống *(khi số liệu đổi)* | High | US-KL-01 |
| [UC-NHAP-01](UC-NHAP-01_nhap-khoan-thu-cong.md) | Nhập doanh thu demo và các khoản thủ công | Quản lý | High | US-NHAP-01 |
| [UC-NHAP-02](UC-NHAP-02_duyet-thuong-co-dinh.md) | Duyệt thưởng cố định | Quản lý | Medium | US-NHAP-01 AC-4/5 |
| [UC-LUONG-02](UC-LUONG-02_xem-phieu-luong-chi-tiet.md) | Xem phiếu lương chi tiết một nhân viên | Quản lý | High | US-LUONG-02 |
| [UC-CHOT-01](UC-CHOT-01_chot-bang-luong-thang.md) | Chốt bảng lương tháng | Quản lý | High | US-CHOT-01 |
| [UC-CHOT-02](UC-CHOT-02_dieu-chinh-sau-khi-chot.md) | Điều chỉnh bảng lương sau khi chốt | Quản lý | Medium | US-CHOT-01 AC-3/4 |
| [UC-CHOT-03](UC-CHOT-03_xem-lich-su-dieu-chinh.md) | Xem lịch sử điều chỉnh bảng lương | Quản lý | Low | US-CHOT-01 + Ghi chú 13 |
| [UC-CAUHINH-01](UC-CAUHINH-01_cau-hinh-tham-so-luong.md) | Cấu hình tham số lương | Quản lý | Medium | US-CAUHINH-01 |
| [UC-XEM-01](UC-XEM-01_nhan-vien-xem-phieu-luong.md) | Nhân viên xem phiếu lương của mình | Nhân viên sale | Medium | US-XEM-01 |

## Quan hệ giữa Use Case

- **UC-LUONG-01** `«includes»` **UC-KL-01** — dựng bảng xong thì tính ngay % trừ và hệ số cho từng dòng.
- **UC-NHAP-01** `«includes»` **UC-KL-01** — nhập khoản làm đổi tiền phạt / % trừ mục D.
- **UC-CHOT-02** `«includes»` **UC-KL-01** — điều chỉnh số liệu thì tính lại.
- **UC-NHAP-02** không đụng % trừ, chỉ làm tính lại tổng mục E của dòng.
- **UC-CHOT-01** và **UC-CHOT-02** ghi vào lịch sử mà **UC-CHOT-03** đọc.
- **UC-CAUHINH-01** cấp tham số cho **UC-LUONG-01** và **UC-KL-01**; bảng đã chốt giữ snapshot riêng.

## Tóm tắt từng Use Case

1. **UC-LUONG-01 Dựng bảng lương tháng** — Quản lý chọn kỳ → hệ thống tạo bảng lương nháp, mỗi nhân viên một dòng, tự điền giờ công từ Lịch và các chỉ số từ Chấm điểm, tính lương giờ (giờ cuối ca ×2), rồi chạy UC-KL-01. Kỳ chưa có lịch chốt → các mục giờ để "chờ". Dựng lại giữ nguyên khoản nhập tay. Bảng đã chốt không dựng lại được.
2. **UC-KL-01 Áp thang khấu trừ kỷ luật** — Khi số liệu một dòng đổi, hệ thống quy tỷ lệ rep / tag (mục C, chỉ trừ hệ số) và các lỗi rời rạc (mục D, phạt tiền + trừ hệ số) thành % trừ, cộng tổng, kẹp trần 15%, ra hệ số ≥ 85% và tổng tiền phạt.
3. **UC-NHAP-01 Nhập khoản thủ công** — Quản lý nhập doanh thu demo (→ tra thang thưởng, tính thưởng demo) và số lần nộp báo cáo trễ (→ tiền phạt + % trừ). Giá trị âm / phi số bị từ chối. Bảng đã chốt: ô chỉ-đọc.
4. **UC-NHAP-02 Duyệt thưởng cố định** — Hệ thống gợi ý cộng 500.000 đ cho nhân viên xếp loại "Xuất sắc"; quản lý duyệt hoặc bỏ qua. Không "Xuất sắc" → không có gợi ý.
5. **UC-LUONG-02 Xem phiếu lương chi tiết** — Quản lý bung mục A–E của một nhân viên kèm mọi số trung gian; bấm vào một chỉ số lỗi để xem danh sách hội thoại / ca lỗi. Mục "chờ" nêu rõ lý do, không hiện số 0 giả.
6. **UC-CHOT-01 Chốt bảng lương** — Quản lý bấm "Chốt lương", xác nhận → trạng thái "Đã chốt", số chỉ-đọc, lưu snapshot tham số, ghi lịch sử. Còn mục "chờ" → cảnh báo trước khi chốt.
7. **UC-CHOT-02 Điều chỉnh sau khi chốt** — Quản lý mở chế độ điều chỉnh kèm lý do bắt buộc, sửa ô → tính lại qua UC-KL-01, mỗi thay đổi ghi "sau chốt" + lý do. Có nhánh "Bỏ chốt" đưa bảng về "Nháp".
8. **UC-CHOT-03 Xem lịch sử điều chỉnh** — Quản lý xem danh sách thao tác chốt / điều chỉnh / bỏ chốt của kỳ, lọc theo nhân viên và "chỉ sau chốt". Không có dòng khớp → thông báo trống.
9. **UC-CAUHINH-01 Cấu hình tham số lương** — Quản lý sửa đơn giá giờ (thường + giờ cuối ca), thang thưởng demo, thang trừ C/D, phạt tiền, trần/sàn. Bậc thang chồng lấn / hở hoặc giá trị phi lệ bị từ chối. Kỳ đã chốt giữ snapshot cũ.
10. **UC-XEM-01 Nhân viên xem phiếu lương** — Nhân viên chọn kỳ, xem phiếu của chính mình khi đã chốt. Kỳ chưa chốt → thông báo, không lộ số nháp. Không mở được phiếu người khác.

## Ngoài phạm vi (vòng sau)

Xuất bảng lương ra tệp cho kế toán · gửi phiếu lương qua email · lịch sử lương nhiều tháng / biểu đồ xu hướng · tính lương cho nhân sự ngoài đội sale · tạm ứng và các khoản cộng / trừ đột xuất ngoài khung A–E · phân quyền phía máy chủ · phát hiện giờ vào/ra ca (thuộc Lịch làm việc).

## Bước 4 — Kết quả validate (checklist 20 điểm)

| # | Item | Status | Ghi chú |
| :-- | :-- | :-- | :-- |
| C1 | Verb + Object | ✅ | Mọi tên đều dạng động từ + đối tượng |
| C2 | Coffee-break test (user-goal level) | ⚠️ | 8 UC ở user-goal level; UC-KL-01 là tác vụ nội bộ theo sự kiện (hợp lệ theo quy tắc event-driven) |
| C3 | Unique ID | ✅ | Tiền tố LUONG / KL / NHAP / CHOT / CAUHINH / XEM |
| C4 | 1 Actor, 1 Goal | ✅ | Đã tách chốt / điều chỉnh / lịch sử; tách nhập khoản / duyệt thưởng |
| C5 | System boundary | ✅ | Mỗi bước là Actor→System hoặc System→Actor |
| C6 | Specific actor (không "User") | ✅ | Quản lý / Nhân viên sale / Hệ thống |
| C7 | Description có WHY + WHAT + OUTCOME | ✅ | |
| C8 | Frequency định lượng | ✅ | Ước lượng theo kỳ lương cho đội 5 người |
| C9 | Preconditions verify được | ✅ | |
| C10 | Postconditions phủ mọi thay đổi trạng thái | ✅ | |
| C11 | Precondition ≠ Assumption | ✅ | Tách riêng hai mục |
| C12 | Mỗi step một hành động | ✅ | |
| C13 | Xen kẽ Actor / System, chủ ngữ rõ | ✅ | |
| C14 | Không nhúng if/else/loop trong Normal Course | ✅ | Chuyển sang Alternative / Exception |
| C15 | Luồng đầy đủ trigger → postcondition | ✅ | |
| C16 | Alternative Course ghi rõ "tại bước N" | ✅ | |
| C17 | Exception đủ 3 phần (trigger + phản hồi + trạng thái cuối) | ✅ | |
| C18 | Phủ các lỗi phổ biến | ✅ | Mất mạng, nhập sai, thiếu dữ liệu nguồn, thao tác trên bảng đã chốt, xem phiếu người khác |
| C19 | Includes trỏ tới UC có tồn tại | ✅ | UC-LUONG-01 / UC-NHAP-01 / UC-CHOT-02 → UC-KL-01 (đã có file) |
| C20 | Special Requirements là NFR, không phải chức năng | ✅ | Thời gian phản hồi, tính thuần của hàm tính, không hồi tố |

**Điểm ⚠️ (C2) là chủ ý** — UC-KL-01 là hàm tính chạy theo sự kiện, tách riêng để gom trọn quy tắc thang bậc; chấp nhận được để bàn giao.
