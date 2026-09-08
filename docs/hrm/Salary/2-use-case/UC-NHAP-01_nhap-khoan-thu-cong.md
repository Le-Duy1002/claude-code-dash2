# UC-NHAP-01 — Nhập doanh thu demo và các khoản thủ công

| Trường | Nội dung |
| :-- | :-- |
| **Use Case ID** | UC-NHAP-01 |
| **Use Case Name** | Nhập doanh thu demo và các khoản thủ công |
| **Created By** | BA · **Cập nhật bởi:** — |
| **Ngày tạo** | 08/09/2026 · **Cập nhật:** — |
| **Primary Actor** | Quản lý (Hoàng) |
| **Secondary Actor** | — |
| **Priority** | High |
| **Frequency of Use** | ~5–15 ô / kỳ lương |
| **Nguồn** | US-NHAP-01 (AC-1, AC-2, AC-3) |

**Description:** Một số khoản không có nguồn tự động — doanh thu chốt qua xem demo và số lần nộp báo cáo tháng trễ. Use case cho phép quản lý nhập các khoản này cho từng nhân viên trên bảng lương nháp; hệ thống tính lại các ô dẫn xuất (% thưởng demo, thưởng demo, tiền phạt, % trừ mục D) và tổng lương. Kết thúc: dòng lương phản ánh đúng thưởng hiệu suất và phạt rời rạc.

**Preconditions:**
1. Quản lý đã đăng nhập.
2. Bảng lương của kỳ đang ở trạng thái "Nháp".

**Postconditions (thành công):**
1. Giá trị khoản thủ công được lưu vào dòng lương của nhân viên.
2. Các ô dẫn xuất và kết quả UC-KL-01 của dòng đã được tính lại.
3. Tổng trước khấu trừ và tổng lương thực lĩnh của dòng đã cập nhật.

## Normal Course of Events
1. Quản lý mở bảng lương nháp của kỳ.
2. Quản lý chọn một ô khoản thủ công của một nhân viên (doanh thu demo hoặc số lần nộp báo cáo trễ).
3. Quản lý nhập giá trị.
4. Hệ thống kiểm tra giá trị hợp lệ (số không âm).
5. Hệ thống lưu giá trị vào dòng lương.
6. Hệ thống tra thang thưởng demo theo tỷ lệ chốt demo của dòng và tính lại thưởng demo (khi ô là doanh thu demo).
7. Hệ thống thực hiện UC-KL-01 để tính lại % trừ hệ số và tiền phạt của dòng.
8. Hệ thống cập nhật tổng trước khấu trừ và tổng lương thực lĩnh của dòng.

## Alternative Courses
- **UC-NHAP-01.AC.1** — Tại bước 3, nếu quản lý xoá trắng một ô đã nhập, hệ thống đặt lại giá trị mặc định (0) rồi tính lại như bước 6–8.

## Exceptions
- **UC-NHAP-01.EX.1 — Giá trị không hợp lệ:** Tại bước 4, nếu giá trị âm hoặc không phải số → hệ thống không lưu, giữ nguyên giá trị trước, báo ô nhập không hợp lệ. Trạng thái cuối: dòng lương không đổi.
- **UC-NHAP-01.EX.2 — Bảng lương đã chốt:** Tại bước 1, nếu bảng đang ở trạng thái "Đã chốt" → các ô khoản thủ công ở chế độ chỉ-đọc, hệ thống hướng dẫn dùng UC-CHOT-02. Trạng thái cuối: không sửa được.
- **UC-NHAP-01.EX.3 — Mất kết nối khi lưu:** Tại bước 5, nếu ghi thất bại → hệ thống không lưu, giữ giá trị đang nhập, báo lỗi để thử lại. Trạng thái cuối: dòng lương không đổi.

## Includes
- UC-KL-01 — Áp thang khấu trừ kỷ luật và tính hệ số lương.

## Special Requirements
- Các ô dẫn xuất cập nhật trong ≤ 1 giây sau khi lưu.

## Assumptions
1. Doanh thu chốt qua demo và số lần nộp báo cáo tháng trễ không có nguồn dữ liệu tự động.
2. Số lần đến muộn và bỏ ca lấy tự động từ Lịch làm việc, không nhập ở use case này.

## Notes and Issues
- —
