# UC-KL-01 — Áp thang khấu trừ kỷ luật và tính hệ số lương

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-KL-01 |
| **Use Case Name** | Áp thang khấu trừ kỷ luật và tính hệ số lương |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Hệ thống (kích hoạt khi số liệu một dòng lương thay đổi) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | Vài chục lần / kỳ (mỗi lần dựng bảng, nhập khoản, điều chỉnh) |
| **Nguồn** | US-KL-01 |

**Description:** Mức trừ lương do kỷ luật phải nhất quán giữa các nhân viên và không được vượt cam kết "lương không tụt dưới 85%". Use case là bước tính tự động: mỗi khi số liệu một dòng lương thay đổi, hệ thống quy các chỉ số kỷ luật thành phần trăm trừ hệ số theo đúng thang quy định (mục C — lỗi tần suất cao, chỉ trừ hệ số; mục D — lỗi rời rạc, phạt tiền + trừ hệ số), cộng tổng và kẹp trần. Kết thúc: dòng lương có % trừ mục C, % trừ mục D, tổng % trừ đã kẹp trần, hệ số lương còn lại và tổng tiền phạt.

**Preconditions:**
1. Dòng lương tồn tại, các chỉ số kỷ luật đã có giá trị hoặc đang ở trạng thái "chờ".
2. Bộ tham số thang trừ, trần % trừ và hệ số sàn của kỳ đã xác định (UC-CAUHINH-01 hoặc snapshot lúc chốt).

**Postconditions (thành công):**
1. Dòng lương có: % trừ mục C, % trừ mục D, tổng % trừ (đã kẹp trần), hệ số lương còn lại (≥ sàn), tổng tiền phạt mục D.
2. Các giá trị này sẵn sàng cho công thức mục E (tổng lương thực lĩnh).

## Normal Course of Events
1. Hệ thống nhận sự kiện "số liệu dòng lương thay đổi" từ UC-LUONG-01, UC-NHAP-01 hoặc UC-CHOT-02.
2. Hệ thống tra bậc % trừ cho tỷ lệ phản hồi đúng hạn theo thang mục C.
3. Hệ thống tra bậc % trừ cho tỷ lệ gán tag đúng & đầy đủ theo thang mục C.
4. Hệ thống tra bậc % trừ và tính tiền phạt theo số lần cho từng loại lỗi rời rạc của mục D.
5. Hệ thống cộng % trừ mục C và % trừ mục D thành tổng % trừ.
6. Hệ thống kẹp tổng % trừ ở trần (mặc định 15%) và tính hệ số lương còn lại = 100% − tổng % trừ, không thấp hơn hệ số sàn (mặc định 85%).
7. Hệ thống cộng tổng tiền phạt của mục D.
8. Hệ thống lưu các kết quả vào dòng lương.

## Alternative Courses
- **UC-KL-01.AC.1** — Tại bước 2–4, nếu một chỉ số đang ở trạng thái "chờ" (chưa có dữ liệu), hệ thống bỏ qua chỉ số đó khỏi tổng % trừ và đánh dấu kết quả của dòng là "tạm tính".

## Exceptions
- **UC-KL-01.EX.1 — Thiếu tham số thang trừ:** Tại bước 2, nếu không tra được bộ tham số thang cho kỳ → hệ thống giữ nguyên % trừ và hệ số trước đó của dòng, ghi một cảnh báo để quản lý kiểm tra cấu hình tham số. Trạng thái cuối: hệ số dòng lương không đổi.
- **UC-KL-01.EX.2 — Ghi kết quả thất bại:** Tại bước 8, nếu ghi cơ sở dữ liệu thất bại → hệ thống không cập nhật dòng lương, giữ giá trị cũ và để use case gọi (UC-LUONG-01 / UC-NHAP-01 / UC-CHOT-02) báo lỗi cho quản lý. Trạng thái cuối: dòng lương giữ hệ số cũ.

## Includes
- —

## Special Requirements
- Hàm tính thuần: cùng bộ đầu vào luôn cho cùng kết quả, không phụ thuộc thời điểm chạy.
- Kết quả tính xong trong ≤ 1 giây cho một dòng lương.

## Assumptions
1. "Lỗi tần suất cao" (mục C: rep chậm, gán tag thiếu) chỉ trừ hệ số, không sinh tiền phạt.
2. "Lỗi rời rạc" (mục D: bỏ sót inbox, báo cáo trễ, đến muộn, bỏ ca) vừa trừ hệ số vừa phạt tiền theo số lần.
3. Mốc biên của mỗi bậc thang được xử lý theo định nghĩa trong tham số (xem us.md Ghi chú 8–9).

## Notes and Issues
- **[TBD-1]** Mốc 90 phút chia hai mức "bỏ ca 1–1,5 tiếng" và "bỏ ca ≥ 1,5 tiếng" là quy ước tạm ngày 08/09/2026 | Owner: Hoàng | Có thể chỉnh qua tham số
