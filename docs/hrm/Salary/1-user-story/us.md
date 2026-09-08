# EPIC: Bảng tính lương nhân sự Sale – Pancake

> Tính năng #4 của dashboard quản lý đội sale.
> Phân hệ: module `features/payroll` (mới), tiêu thụ dữ liệu từ
> `features/schedule` (Lịch làm việc) và `features/pancake`
> (Theo dõi công việc / Nhật ký AI — chấm điểm).
> Trạng thái: Draft — chờ duyệt Sprint Planning.

## Đối tượng sử dụng (Persona)

| Persona | Mô tả |
| :-- | :-- |
| **Quản lý** | Hoàng — **tài khoản quản trị được định danh cụ thể**; dựng / dựng thử bảng lương, nhập khoản thủ công, duyệt thưởng, chốt & điều chỉnh, cấu hình tham số, và xem rõ phiếu lương của **mọi** nhân viên |
| **Nhân viên sale** | Duy / Hà / Quyến / Thương — chỉ xem phiếu lương của **chính mình** sau khi đã chốt |

## Nguồn dữ liệu

| Mục trên bảng lương | Lấy tự động từ | Ghi chú |
| :-- | :-- | :-- |
| Tổng giờ theo lịch phân công | `features/schedule` — giờ đăng ký của các tuần **đã chốt** trong kỳ | Tổng độ dài ca đã đăng ký (Sáng 5h / Chiều 6h / Tối 5h), cộng giờ làm thêm |
| Tổng giờ làm thực tế | `features/schedule` — quét Pancake của nhân viên trực ca trong khung ca | Giờ vào ca = tin bot đầu tiên; giờ ra ca = hoạt động cuối gần cuối ca |
| Đến muộn / bỏ ca | `features/schedule` — đối chiếu giờ vào/ra ca với khung ca đăng ký | Phân mức theo số phút vào muộn / vắng mặt (xem Ghi chú 8) |
| Tỷ lệ phản hồi đúng hạn ≤ 3′ | `features/pancake` — tiêu chí 4 | |
| Tỷ lệ gán tag đúng & đầy đủ | `features/pancake` — tiêu chí 6 | |
| Số hội thoại bỏ sót (> 15′ / không rep) | `features/pancake` — tiêu chí 5 | |
| Tỷ lệ chốt qua demo | `features/pancake` — tiêu chí 8 | Doanh thu demo (VND) vẫn nhập tay |
| Xếp loại tổng (Xuất sắc…) | `features/pancake` — điểm tổng kỳ | Dùng để xét thưởng cố định |

## Bảng mã tính năng

| Mã | Nhóm |
| :-- | :-- |
| LUONG | Dựng & xem bảng lương tháng |
| NHAP | Nhập các khoản thủ công |
| KL | Thang khấu trừ kỷ luật |
| CHOT | Chốt lương & điều chỉnh sau chốt |
| CAUHINH | Tham số lương |
| XEM | Nhân viên tự xem phiếu lương |

## Danh sách User Story

| Mã | Tiêu đề | Persona chính |
| :-- | :-- | :-- |
| US-LUONG-01 | Dựng bảng lương tháng cho toàn đội | Quản lý |
| US-NHAP-01 | Nhập các khoản thủ công cho từng nhân viên | Quản lý |
| US-KL-01 | Áp thang khấu trừ kỷ luật và chặn trần hệ số | Quản lý |
| US-LUONG-02 | Xem phiếu lương chi tiết một nhân viên | Quản lý |
| US-CHOT-01 | Chốt bảng lương tháng và điều chỉnh sau chốt | Quản lý |
| US-CAUHINH-01 | Cấu hình tham số lương | Quản lý |
| US-XEM-01 | Nhân viên xem phiếu lương của mình | Nhân viên sale |

---

## US-LUONG-01 — Dựng bảng lương tháng cho toàn đội

**As a** quản lý đội sale
**I want to** chọn một tháng và để hệ thống tạo bảng lương nháp cho mọi nhân viên sale, tự điền số giờ từ Lịch làm việc và các chỉ số chấm điểm từ Theo dõi công việc / Nhật ký AI của kỳ đó
**So that** tôi không phải chép tay từng con số từ nhiều bảng như trước, và bảng lương luôn khớp với dữ liệu chấm điểm

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần Lịch làm việc (tính năng #1) và chấm điểm Pancake có dữ liệu cho kỳ |
| Negotiable | ✅ | Danh sách chỉ số kéo tự động có thể bàn thêm |
| Valuable | ✅ | Bỏ hẳn khâu nhập tay xuyên bảng |
| Estimable | ✅ | Gộp dữ liệu hai module sẵn có + ghi một doc bảng lương / kỳ |
| Small | ⚠️ | Hơi lớn — gom từ hai nguồn; có thể tách phần "kéo từ Lịch" và "kéo từ chấm điểm" |
| Testable | ✅ | Đối chiếu số trên bảng với số trên Lịch và Bảng điểm của cùng kỳ |

### Tiêu chí nghiệm thu

**AC-1: Dựng bảng lương của một tháng (luồng thường)**
- **Given** tháng 8/2026 đã có các tuần lịch "Đã chốt" và đã có dữ liệu chấm điểm Pancake
- **When** quản lý chọn kỳ "Tháng 8 / 2026" và bấm "Dựng bảng lương"
- **Then** hệ thống tạo một bảng lương nháp cho kỳ đó, mỗi nhân viên sale một dòng, đã điền: tổng giờ theo lịch phân công, tổng giờ làm thực tế, lương giờ (áp đơn giá giờ cuối ca gấp đôi), tỷ lệ phản hồi đúng hạn, tỷ lệ gán tag, số hội thoại bỏ sót, số lần đến muộn, số lần bỏ ca theo mức, và tỷ lệ chốt qua demo

**AC-2: Kỳ chưa có tuần lịch nào được chốt (xác thực nghiệp vụ)**
- **Given** tháng 9/2026 chưa có tuần lịch nào ở trạng thái "Đã chốt"
- **When** quản lý dựng bảng lương cho tháng 9/2026
- **Then** hệ thống vẫn tạo bảng, nhưng các mục phụ thuộc lịch (giờ theo lịch, giờ thực tế, đến muộn, bỏ ca) để trạng thái "chờ — chưa có lịch chốt cho kỳ này", lương giờ tạm tính bằng 0 và bảng hiển thị cảnh báo còn mục chưa tính

**AC-3: Dựng lại bảng đã có ở trạng thái nháp (luồng biên)**
- **Given** bảng lương tháng 8/2026 đã tồn tại ở trạng thái "Nháp" và quản lý đã nhập tay doanh thu demo cho Hà
- **When** quản lý bấm "Dựng lại" cho tháng 8/2026
- **Then** hệ thống cập nhật lại toàn bộ số kéo tự động theo dữ liệu mới nhất và **giữ nguyên** các khoản đã nhập tay

**AC-4: Không đọc được dữ liệu nguồn (luồng lỗi)**
- **Given** quản lý bấm "Dựng bảng lương" cho một kỳ
- **When** việc đọc dữ liệu chấm điểm hoặc lịch thất bại
- **Then** hệ thống không tạo bảng lương nửa vời, giữ nguyên trạng thái trước đó và báo để thử lại

**AC-5: Dựng thử giữa kỳ khi tháng chưa kết thúc (luồng thường)**
- **Given** hôm nay là 27/8/2026, tháng 8 chưa kết thúc, đã có khung bảng lương tháng 8 sẵn sàng dựng
- **When** quản lý bấm "Dựng thử" cho tháng 8/2026
- **Then** hệ thống dựng bảng nháp với số liệu tính đến thời điểm hiện tại, đánh dấu là "dựng thử — chưa đủ kỳ", các ngày/ca chưa diễn ra không tính vào giờ thiếu; quản lý dựng lại nhiều lần và dựng bản cuối khi tháng kết thúc

### Ghi chú
- "Khung bảng lương" của mỗi kỳ được tạo sẵn (danh sách nhân viên + các ô trống) để quản lý dựng thử bất kỳ lúc nào trong tháng; mỗi lần "Dựng thử" / "Dựng lại" ghi đè số tự động, giữ khoản nhập tay.
- Mục D kéo tự động: "Bỏ sót inbox" từ tiêu chí 5; "Đến muộn", "Bỏ ca 1–1,5 tiếng", "Bỏ ca ≥ 1,5 tiếng" từ đối chiếu giờ vào/ra ca (quét Pancake) với khung ca đăng ký. Chỉ "Nộp báo cáo tháng trễ hạn" nhập tay (US-NHAP-01).
- Lương giờ mục A: mỗi ca, giờ thực tế thuộc giờ cuối ca (Sáng 12–13h, Chiều 18–19h, Tối 23–24h) tính đơn giá gấp đôi (50.000 đ), các giờ còn lại tính 25.000 đ.

---

## US-NHAP-01 — Nhập các khoản thủ công cho từng nhân viên

**As a** quản lý đội sale
**I want to** nhập các khoản không thể lấy tự động — doanh thu chốt qua xem demo, số lần nộp báo cáo tháng trễ — và duyệt thưởng cố định cho từng nhân viên trên bảng lương nháp
**So that** phần thưởng hiệu suất và phần phạt rời rạc được tính đủ, không bị bỏ sót vì thiếu dữ liệu tự động

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần bảng lương nháp từ US-LUONG-01 |
| Negotiable | ✅ | Danh sách khoản nhập tay có thể co lại khi có thêm nguồn tự động |
| Valuable | ✅ | Hoàn thiện phần B và D của bảng lương |
| Estimable | ✅ | Vài ô nhập số + tính lại các ô dẫn xuất |
| Small | ✅ | Thao tác nhập từng ô |
| Testable | ✅ | Ô dẫn xuất (% thưởng, tiền phạt, % trừ hệ số) cập nhật đúng theo giá trị nhập |

### Tiêu chí nghiệm thu

**AC-1: Nhập doanh thu demo và tính lại thưởng (luồng thường)**
- **Given** dòng lương của Duy có tỷ lệ chốt qua demo là 24%
- **When** quản lý nhập doanh thu chốt qua demo = 30.000.000 đ cho Duy
- **Then** hệ thống tra thang thưởng demo (> 20% và ≤ 30% → 18%), tính "Thưởng demo" = 30.000.000 × 18% = 5.400.000 đ và cập nhật ngay tổng trước khấu trừ

**AC-2: Nhập số lần nộp báo cáo trễ (luồng thường)**
- **Given** dòng lương của Hà chưa ghi lần nộp báo cáo tháng trễ nào
- **When** quản lý nhập "Nộp báo cáo tháng trễ hạn" = 2 lần cho Hà
- **Then** hệ thống tính phạt tiền dòng đó = 2 × 100.000 = 200.000 đ và đặt % trừ hệ số của dòng đó theo bậc "2 lần" = 2%

**AC-3: Giá trị nhập không hợp lệ (xác thực nghiệp vụ)**
- **Given** quản lý đang sửa một ô khoản thủ công
- **When** quản lý nhập số âm hoặc ký tự không phải số vào ô doanh thu hoặc ô số lần
- **Then** hệ thống không lưu giá trị đó, giữ nguyên giá trị trước và báo ô nhập không hợp lệ

**AC-4: Duyệt thưởng cố định khi có gợi ý (luồng thường)**
- **Given** điểm tổng kỳ của Quyến xếp loại "Xuất sắc" nên hệ thống đã hiện thông báo gợi ý cộng thưởng cố định
- **When** quản lý mở thông báo đó và bấm "Duyệt thưởng cố định" cho Quyến
- **Then** hệ thống cộng 500.000 đ vào phần thưởng của Quyến; nếu quản lý không duyệt thì không cộng khoản này

**AC-5: Không có gợi ý thưởng cố định cho người chưa Xuất sắc (xác thực nghiệp vụ)**
- **Given** điểm tổng kỳ của Duy xếp loại "Tốt", chưa đạt "Xuất sắc"
- **When** quản lý xem bảng lương kỳ đó
- **Then** hệ thống không hiện gợi ý thưởng cố định cho Duy và không có lối duyệt khoản 500.000 đ cho Duy

---

## US-KL-01 — Áp thang khấu trừ kỷ luật và chặn trần hệ số

**As a** quản lý đội sale
**I want to** hệ thống tự quy các chỉ số kỷ luật thành phần trăm trừ hệ số lương theo đúng thang quy định, cộng tổng và chặn trần
**So that** mức trừ lương do kỷ luật nhất quán giữa các nhân viên và không ai bị trừ quá giới hạn đã cam kết

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần các chỉ số từ US-LUONG-01 và US-NHAP-01 |
| Negotiable | ✅ | Các mốc bậc và trần lấy từ tham số (US-CAUHINH-01) |
| Valuable | ✅ | Đảm bảo công bằng và đúng cam kết "không tụt dưới 85%" |
| Estimable | ✅ | Hàm thuần tra bậc + cộng + kẹp trần |
| Small | ✅ | Một bước tính |
| Testable | ✅ | Cho bộ chỉ số biết trước, ra đúng % trừ và hệ số |

### Tiêu chí nghiệm thu

**AC-1: Tra bậc cho lỗi tần suất cao (luồng thường)**
- **Given** tỷ lệ phản hồi đúng hạn của một nhân viên trong kỳ là 82%
- **When** hệ thống tính khấu trừ kỷ luật
- **Then** chỉ số đó rơi vào bậc "80–90%" → trừ 3% hệ số, và **không** sinh khoản phạt tiền nào

**AC-2: Cộng tổng và chặn trần 15% (xác thực nghiệp vụ)**
- **Given** một nhân viên có: rep đúng hạn < 80% (−5%), gán tag < 70% (−5%), bỏ sót inbox 3 lần (−5%), đến muộn 2 lần (−2%)
- **When** hệ thống cộng tổng % trừ
- **Then** tổng cộng dồn là 17% nhưng hệ thống chặn ở trần 15%, hệ số lương còn lại = 85%

**AC-3: Không vi phạm gì (luồng biên)**
- **Given** mọi chỉ số kỷ luật của một nhân viên đều ở mức đạt và không có lần vi phạm rời rạc nào
- **When** hệ thống tính khấu trừ
- **Then** tổng % trừ = 0%, hệ số lương còn lại = 100%, tổng tiền phạt = 0 đ

**AC-4: Phân biệt hai nhóm lỗi (xác thực nghiệp vụ)**
- **Given** một nhân viên vừa có rep chậm (lỗi tần suất cao) vừa có 1 lần bỏ ca ≥ 1,5 tiếng (lỗi rời rạc)
- **When** hệ thống tính khấu trừ
- **Then** lỗi rep chậm chỉ trừ hệ số; lần bỏ ca ≥ 1,5 tiếng vừa cộng 500.000 đ tiền phạt vừa trừ 7% hệ số

---

## US-LUONG-02 — Xem phiếu lương chi tiết một nhân viên

**As a** quản lý đội sale
**I want to** mở phiếu lương của một nhân viên và xem rõ từng mục A–E với công thức và số nguồn, bấm vào một chỉ số lỗi để xem danh sách ngày / hội thoại đứng sau con số đó
**So that** tôi giải thích được với nhân viên vì sao ra mức lương này và phát hiện sớm số liệu bất thường

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần bảng lương đã dựng |
| Negotiable | ✅ | Mức chi tiết của drill-down có thể bàn |
| Valuable | ✅ | Minh bạch, giảm tranh luận về lương |
| Estimable | ✅ | Trình bày số đã tính + tái dùng drill-down của Theo dõi công việc |
| Small | ⚠️ | Có phần drill-down; có thể tách riêng phần liệt kê hội thoại / ca lỗi |
| Testable | ✅ | Số trên phiếu khớp công thức; danh sách drill-down khớp phần chấm điểm |

### Tiêu chí nghiệm thu

**AC-1: Xem đủ năm mục (luồng thường)**
- **Given** bảng lương tháng 8/2026 đã dựng cho Hà
- **When** quản lý mở phiếu lương của Hà
- **Then** hệ thống hiển thị: A — lương giờ (giờ thường × 25.000 + giờ cuối ca × 50.000), B — thưởng demo và thưởng cố định, C — % trừ do lỗi tần suất cao, D — tiền phạt và % trừ do lỗi rời rạc, E — hệ số còn lại và tổng lương thực lĩnh, kèm mọi số trung gian

**AC-2: Xem chi tiết hội thoại bỏ sót (luồng thường)**
- **Given** phiếu lương của Hà ghi "số hội thoại bỏ sót = 3"
- **When** quản lý bấm vào con số đó
- **Then** hệ thống liệt kê 3 hội thoại kèm thời điểm, tên khách và lối mở nhanh hội thoại trên Pancake

**AC-3: Xem chi tiết lần đến muộn / bỏ ca (luồng thường)**
- **Given** phiếu lương của Hà ghi "đến muộn 2 lần"
- **When** quản lý bấm vào con số đó
- **Then** hệ thống liệt kê 2 ca kèm ngày, buổi, giờ vào ca thực tế và số phút vào ca muộn

**AC-4: Phiếu của kỳ còn mục chưa tính (luồng biên)**
- **Given** bảng lương tháng 9/2026 có mục giờ đang ở trạng thái "chờ"
- **When** quản lý mở phiếu lương một nhân viên của kỳ đó
- **Then** hệ thống nêu rõ mục nào chưa tính được và lý do, không hiển thị con số giả bằng 0 như thể đã tính

---

## US-CHOT-01 — Chốt bảng lương tháng và điều chỉnh sau chốt

**As a** quản lý đội sale
**I want to** bấm "Chốt lương" khi bảng lương một tháng đã rà xong, và sau đó chỉ sửa được kèm lý do bắt buộc
**So that** có một mốc "lương chính thức" để chi trả, mọi thay đổi về sau đều truy vết được

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần bảng lương đã dựng |
| Negotiable | ✅ | Ai được chốt có thể siết sau |
| Valuable | ✅ | Cắt mốc chi trả, khoá số liệu |
| Estimable | ✅ | Đổi trạng thái doc + ghi lịch sử, theo mẫu "Chốt tuần" của Lịch làm việc |
| Small | ✅ | Một nút + trạng thái |
| Testable | ✅ | Sau chốt số liệu chỉ-đọc; thay đổi ghi "sau chốt" kèm lý do |

### Tiêu chí nghiệm thu

**AC-1: Chốt bảng lương (luồng thường)**
- **Given** bảng lương tháng 8/2026 đang ở trạng thái "Nháp"
- **When** quản lý bấm "Chốt lương" và xác nhận
- **Then** trạng thái bảng chuyển "Đã chốt", mọi ô số và ô nhập tay thành chỉ-đọc, một dòng "Chốt bảng lương T8/2026" kèm tên người chốt và thời điểm được ghi vào lịch sử

**AC-2: Không cho dựng lại số tự động sau khi đã chốt (xác thực nghiệp vụ)**
- **Given** bảng lương tháng 8/2026 đang "Đã chốt"
- **When** quản lý bấm "Dựng lại"
- **Then** hệ thống chặn thao tác và hướng dẫn dùng "Điều chỉnh" kèm lý do nếu thật sự cần sửa

**AC-3: Điều chỉnh sau chốt kèm lý do (luồng biên)**
- **Given** bảng lương tháng 8/2026 đang "Đã chốt"
- **When** quản lý bấm "Điều chỉnh", nhập lý do "Bổ sung doanh thu demo của Hà bị vào sổ muộn" và sửa ô đó
- **Then** hệ thống lưu thay đổi, ghi một dòng lịch sử đánh dấu "sau chốt" kèm lý do, và các số dẫn xuất (thưởng, hệ số, thực lĩnh) được tính lại

**AC-4: Bỏ chốt (luồng biên)**
- **Given** bảng lương đang "Đã chốt"
- **When** quản lý bấm "Bỏ chốt" và nhập lý do
- **Then** trạng thái bảng về "Nháp" và một dòng "Bỏ chốt" (đánh dấu sau chốt) kèm lý do được ghi vào lịch sử

---

## US-CAUHINH-01 — Cấu hình tham số lương

**As a** quản lý đội sale
**I want to** chỉnh các tham số tính lương — đơn giá giờ thường và đơn giá giờ cuối ca, thang thưởng demo, thang trừ hệ số của mục C và D, mức phạt tiền mỗi lần, trần % trừ và hệ số sàn
**So that** khi chính sách lương thay đổi tôi cập nhật một chỗ, không phải sửa công thức trong từng bảng

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ✅ | Có thể làm trước, dùng giá trị mặc định |
| Negotiable | ✅ | Tập tham số cho phép chỉnh có thể mở rộng dần |
| Valuable | ✅ | Chính sách lương linh hoạt, không phải sửa code |
| Estimable | ✅ | Một doc tham số + màn hình sửa |
| Small | ⚠️ | Nhiều bảng tham số; có thể tách "đơn giá + trần" khỏi "các thang bậc" |
| Testable | ✅ | Bảng dựng sau khi đổi tham số dùng giá trị mới; bảng đã chốt giữ giá trị cũ |

### Tiêu chí nghiệm thu

**AC-1: Sửa đơn giá giờ (luồng thường)**
- **Given** đơn giá giờ thường hiện tại là 25.000 đ và đơn giá giờ cuối ca là 50.000 đ
- **When** quản lý đổi đơn giá giờ thường thành 27.000 đ
- **Then** các bảng lương **dựng sau** thời điểm sửa dùng đơn giá 27.000 đ; các bảng đã chốt trước đó giữ nguyên 25.000 đ

**AC-2: Sửa một bậc của thang thưởng demo (xác thực nghiệp vụ)**
- **Given** thang thưởng demo đang có các bậc liền mạch từ "< 10%" đến "> 40%"
- **When** quản lý sửa một mốc bậc khiến hai bậc chồng lấn hoặc để hở một khoảng tỷ lệ
- **Then** hệ thống từ chối lưu và chỉ ra khoảng bị chồng lấn hoặc bị hở

**AC-3: Bảng đã chốt không đổi theo tham số mới (xác thực nghiệp vụ)**
- **Given** bảng lương tháng 7/2026 đã "Đã chốt" với trần % trừ là 15%
- **When** quản lý đổi trần % trừ thành 12%
- **Then** bảng tháng 7/2026 vẫn giữ trần 15% đã dùng lúc chốt; chỉ kỳ dựng sau mới áp trần 12%

**AC-4: Nhập tham số phi lệ (luồng lỗi)**
- **Given** quản lý đang sửa tham số lương
- **When** quản lý nhập đơn giá giờ âm, hệ số sàn lớn hơn 100% hoặc trần % trừ âm
- **Then** hệ thống không lưu và báo giá trị không hợp lệ

**AC-5: Ghi lịch sử mỗi lần đổi tham số (luồng thường)**
- **Given** đơn giá giờ thường đang là 25.000 đ
- **When** quản lý đổi thành 27.000 đ và lưu
- **Then** hệ thống lưu một bản ghi lịch sử: người sửa, thời điểm, tham số nào, giá trị cũ → giá trị mới; danh sách lịch sử này xem được, chỉ đọc

---

## US-XEM-01 — Nhân viên xem phiếu lương của mình

**As a** nhân viên sale
**I want to** xem phiếu lương tháng của chính mình sau khi quản lý đã chốt, gồm đủ các mục A–E
**So that** tôi biết lương kỳ này được tính ra sao và đối chiếu với ghi nhận của mình

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần bảng lương đã chốt |
| Negotiable | ✅ | Mức chi tiết cho nhân viên xem có thể bàn |
| Valuable | ✅ | Minh bạch lương, giảm thắc mắc qua tin nhắn |
| Estimable | ✅ | Màn hình chỉ-đọc lọc theo nhân viên đang đăng nhập |
| Small | ✅ | Một phiếu, chỉ-đọc |
| Testable | ✅ | Nhân viên chỉ thấy phiếu của mình, chỉ với kỳ đã chốt |

### Tiêu chí nghiệm thu

**AC-1: Xem phiếu lương đã chốt của mình (luồng thường)**
- **Given** bảng lương tháng 8/2026 đã "Đã chốt" và có dòng của Duy
- **When** Duy mở mục lương của mình và chọn kỳ "Tháng 8 / 2026"
- **Then** hệ thống hiển thị phiếu lương của Duy với đủ các mục A–E và tổng lương thực lĩnh

**AC-2: Kỳ chưa chốt (luồng biên)**
- **Given** bảng lương tháng 9/2026 đang ở trạng thái "Nháp"
- **When** Duy chọn kỳ "Tháng 9 / 2026"
- **Then** hệ thống hiển thị thông báo "Bảng lương tháng này chưa được chốt", không hiển thị số liệu

**AC-3: Không xem được phiếu của người khác (xác thực nghiệp vụ)**
- **Given** Duy đang xem mục lương của mình
- **When** Duy tìm cách mở phiếu lương của Hà
- **Then** hệ thống không cung cấp lối vào phiếu của đồng nghiệp; nhân viên chỉ truy cập được phiếu gắn với tài khoản của chính mình

**AC-4: Bất đồng về số liệu (luồng thường)**
- **Given** Duy đang xem phiếu lương đã chốt và cho rằng một chỉ số sai
- **When** Duy muốn phản hồi
- **Then** phiếu nêu rõ nhân viên không sửa trực tiếp mà gửi thắc mắc cho quản lý để quản lý dùng luồng "Điều chỉnh sau chốt"

---

## Ghi chú chung, giả định & câu hỏi làm rõ

1. **Kỳ lương = một tháng dương lịch.** Một nhân viên có đúng một dòng lương trong một kỳ. Bảng lương lưu một doc / kỳ, có trạng thái "Nháp" / "Đã chốt".
2. **Đơn giá giờ:** giờ thường **25.000 đ/giờ**; **giờ cuối của mỗi ca tính gấp đôi — 50.000 đ/giờ** (Sáng 12–13h, Chiều 18–19h, Tối 23–24h). Cả hai là tham số, chỉnh qua US-CAUHINH-01.
3. **Giờ theo lịch phân công** dùng tổng độ dài ca đã đăng ký ở các tuần **đã chốt** trong kỳ — Sáng 5h, Chiều 6h, Tối 5h (giữ đúng độ dài từng ca, **không** quy tròn về 6h như bảng Excel cũ) — cộng giờ làm thêm.
4. **Lương giờ tính trên giờ làm thực tế**, không phải giờ theo lịch. Với mỗi ca: (giờ thực tế trừ phần giờ cuối ca) × 25.000 + (giờ thực tế thuộc giờ cuối ca) × 50.000. Giờ theo lịch chỉ để đối chiếu và tính "giờ thiếu".
5. **Cách xác định giờ vào / ra ca:** mỗi ca có một nhân viên trực (theo lịch đã chốt). Hệ thống quét hoạt động Pancake của nhân viên đó trong khung ca:
   - **Giờ vào ca** = thời điểm tin nhắn tự động (bot) đầu tiên được gửi trong khung ca — bot cần người kích hoạt nên tin bot đầu tiên coi như mốc bắt đầu làm.
   - **Giờ ra ca** = hoạt động cuối cùng gần cuối ca; nếu cuối ca không còn khách nhắn thì vẫn tính đủ ca (không phạt phần đuôi ca vắng khách tự nhiên).
   - **Đi muộn** = giờ vào ca − giờ bắt đầu ca. **Vắng mặt trong ca** = phần khung ca không có hoạt động (vào muộn và/hoặc về sớm).
6. **Thang thưởng demo** (theo tỷ lệ chốt qua demo — **mốc biên thuộc bậc dưới**, phải vượt hẳn mốc mới lên bậc trên):
   - ≤ 10% → 5% (Cơ bản)
   - > 10% và ≤ 20% → 10% (Trung bình)
   - > 20% và ≤ 30% → 18% (Khá)
   - > 30% và ≤ 40% → 25% (Tốt)
   - > 40% → 30% (Xuất sắc)
7. **Thưởng cố định 500.000 đ:** khi điểm tổng kỳ của một nhân viên xếp loại **"Xuất sắc" (điểm ≥ 90)**, hệ thống hiện một **thông báo gợi ý** cộng khoản này; **quản lý tự duyệt**, hệ thống không tự cộng. Không đạt "Xuất sắc" thì không có gợi ý.
8. **Mục C — lỗi tần suất cao (chỉ trừ hệ số, không phạt tiền):**
   - Tỷ lệ phản hồi đúng hạn ≤ 3′: ≥ 95% → 0% · 90–95% → 1% · 80–90% → 3% · < 80% → 5%.
   - Tỷ lệ gán tag đúng & đầy đủ: ≥ 95% → 0% · 85–95% → 1% · 70–85% → 3% · < 70% → 5%.
9. **Mục D — lỗi rời rạc (phạt tiền theo lần + trừ hệ số theo số lần):**

   | Loại vi phạm | Định nghĩa | Phạt / lần | 1 lần | 2 lần | 3+ lần | Nguồn số lần |
   | :-- | :-- | --: | --: | --: | --: | :-- |
   | Bỏ sót inbox (> 15′ / không rep) | tiêu chí 5 | 50.000 | 1% | 3% | 5% | tự động (chấm điểm) |
   | Nộp báo cáo tháng trễ hạn | — | 100.000 | 1% | 2% | 3% | nhập tay |
   | Đến muộn | vào ca trễ **10 phút → dưới 60 phút** (< 10 phút: dung sai, bỏ qua) | 50.000 | 1% | 2% | 4% | tự động (quét Pancake) |
   | Bỏ ca 1 – 1,5 tiếng | tổng vắng mặt trong ca từ **60 đến dưới 90 phút** | 300.000 | 3% | 6% | 10% | tự động (quét Pancake) |
   | Bỏ ca ≥ 1,5 tiếng | tổng vắng mặt trong ca **từ 90 phút trở lên** (gồm ca bỏ hẳn) | 500.000 | 7% | 12% | 15% | tự động (quét Pancake) |

   *Mốc 90 phút giữa hai mức "bỏ ca" **tạm chốt** (08/09/2026), có thể chỉnh qua tham số.*
10. **Chặn trần khấu trừ:** tổng % trừ hệ số của mục C + D tối đa **15%**; hệ số lương còn lại tối thiểu **85%**. Cả hai là tham số.
11. **Công thức mục E:**
    - Tổng trước khấu trừ = Lương giờ + Thưởng demo + Thưởng cố định.
    - Hệ số còn lại = max(85%, 100% − min(15%, tổng % trừ C+D)).
    - Lương sau hệ số = Tổng trước khấu trừ × Hệ số còn lại.
    - **Tổng lương thực lĩnh = Lương sau hệ số − Tổng tiền phạt (mục D).**
12. **Snapshot tham số:** khi chốt, bảng lương lưu lại toàn bộ tham số đang dùng để về sau đổi chính sách không làm lệch số đã chốt.
13. **Lịch sử chốt / điều chỉnh** và **lịch sử đổi tham số lương** chỉ được đọc và thêm mới, không sửa / xoá qua web — theo mẫu `workScheduleChanges` của Lịch làm việc.
14. **Phân quyền (khác các tính năng khác — có kiểm soát phía máy chủ):** chỉ **tài khoản quản trị được định danh cụ thể** (uid/email của Hoàng, để trong danh sách quản trị) mới được dựng / nhập / duyệt / chốt / điều chỉnh / cấu hình và xem phiếu của mọi nhân viên. Nhân viên chỉ đọc phiếu của chính mình. Luật Firestore chặn tài khoản ngoài danh sách quản trị ghi vào dữ liệu bảng lương và đọc phiếu người khác.
15. **Dựng thử giữa kỳ:** mỗi kỳ có sẵn "khung bảng lương" để quản lý dựng thử bất kỳ lúc nào trong tháng (gần cuối tháng dựng thử, cuối tháng dựng bản cuối). Bản dựng thử đánh dấu "chưa đủ kỳ"; ngày/ca chưa diễn ra không tính vào giờ thiếu.
16. **Chưa bao gồm (vòng sau):** xuất bảng lương ra tệp để bàn giao kế toán, gửi phiếu lương qua email, lịch sử lương nhiều tháng / biểu đồ xu hướng, tính lương cho nhân sự ngoài đội sale, tạm ứng và các khoản cộng / trừ đột xuất ngoài khung A–E.
