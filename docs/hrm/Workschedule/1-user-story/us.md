# EPIC: Lịch làm việc (đăng ký & giám sát ca)

> Tính năng #1 của dashboard quản lý đội sale. Đã triển khai — tài liệu này
> viết lại theo hiện trạng (`features/schedule/`, route `/lich-lam-viec`).
> Trạng thái: Done — dùng cho tra cứu & nghiệm thu.

## Đối tượng sử dụng (Persona)

| Persona | Mô tả |
| :-- | :-- |
| **Quản lý** | Hoàng — chốt lịch tuần, điều chỉnh, xem lịch sử, dùng dữ liệu chấm điểm/lương |
| **Nhân viên sale** | Duy / Hà / Quyến / Thương — tự đăng ký ca của mình, khai giờ làm thêm |

## Bảng mã tính năng

| Mã | Nhóm |
| :-- | :-- |
| LICH | Đăng ký & chốt lịch |
| OT | Giờ làm thêm |
| SUA | Điều chỉnh sau chốt & lịch sử |
| CHAM | Nối với chấm điểm (tiêu chí 1 & 2) |

## Danh sách User Story

| Mã | Tiêu đề | Persona chính |
| :-- | :-- | :-- |
| US-LICH-01 | Đăng ký ca làm vào lưới lịch tuần | Nhân viên sale |
| US-LICH-02 | Điều hướng lịch theo năm / tháng / tuần | Quản lý |
| US-LICH-03 | Chốt lịch tuần | Quản lý |
| US-OT-01 | Ghi giờ làm thêm cho từng nhân viên | Nhân viên sale |
| US-SUA-01 | Điều chỉnh lịch sau khi đã chốt | Quản lý |
| US-SUA-02 | Xem lịch sử chỉnh lịch | Quản lý |
| US-CHAM-01 | Đánh dấu ca đổi / nhờ người trực hộ | Quản lý |
| US-CHAM-02 | Chấm tiêu chí "Đủ giờ ca" & "Vào ca" từ lịch đăng ký | Quản lý |

---

## US-LICH-01 — Đăng ký ca làm vào lưới lịch tuần

**As a** nhân viên sale đã đăng nhập
**I want to** chọn tên mình vào ô ca (Sáng / Chiều / Tối × thứ trong tuần) trên lịch
**So that** quản lý và cả đội biết chính xác ai trực ca nào mà không phải nhắn hỏi

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ✅ | Là story nền của tính năng |
| Negotiable | ✅ | Số người tối đa mỗi ô có thể bàn (hiện 1) |
| Valuable | ✅ | Thay bảng Excel thủ công |
| Estimable | ✅ | 1 lưới + ghi Firestore trực tiếp |
| Small | ✅ | 1 thao tác chọn ô |
| Testable | ✅ | Ô lưu đúng nhân viên, hiện ngay cho người khác |

### Tiêu chí nghiệm thu

**AC-1: Đăng ký ca thành công (luồng thường)**
- **Given** tuần đang ở trạng thái "Nháp"
- **When** nhân viên chọn tên mình vào ô "Sáng — Thứ 4"
- **Then** hệ thống lưu ô đó với nhân viên vừa chọn và hiển thị ngay trên lịch của mọi người đang xem

**AC-2: Bỏ ca đã đăng ký (luồng biên)**
- **Given** ô "Chiều — Thứ 6" đang có nhân viên A
- **When** một người chọn "— trống —" cho ô đó
- **Then** hệ thống gỡ nhân viên khỏi ô và ghi một dòng "Bỏ ca" vào lịch sử

**AC-3: Một ca chỉ một người (xác thực nghiệp vụ)**
- **Given** ô "Tối — Thứ 2" đang có nhân viên A
- **When** một người chọn nhân viên B vào cùng ô đó
- **Then** hệ thống thay A bằng B và ghi một dòng "Đổi người: A → B" vào lịch sử

**AC-4: Mất kết nối khi lưu (luồng lỗi)**
- **Given** nhân viên vừa chọn tên vào một ô
- **When** ghi Firestore thất bại
- **Then** hệ thống báo "Không lưu được" và ô trở về giá trị trước đó

### Ghi chú
- Mỗi lần thay đổi ô đều tạo một bản ghi trong `workScheduleChanges` (kể cả khi tuần còn "Nháp"), đánh dấu `afterLock = false`.

---

## US-LICH-02 — Điều hướng lịch theo năm / tháng / tuần

**As a** quản lý
**I want to** chọn năm và tháng để xem tất cả các tuần của tháng đó, mỗi tuần là một lưới riêng
**So that** tôi xem và sắp lịch cho cả tháng ở một chỗ

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-LICH-01 để có dữ liệu hiển thị |
| Negotiable | ✅ | Cách gom tuần vào tháng có thể bàn |
| Valuable | ✅ | Nhìn tổng thể theo tháng |
| Estimable | ✅ | Tính tuần phía client |
| Small | ✅ | 1 thanh điều hướng |
| Testable | ✅ | Đúng danh sách tuần cho từng tháng |

### Tiêu chí nghiệm thu

**AC-1: Xem các tuần của một tháng (luồng thường)**
- **Given** quản lý đang ở màn hình Lịch làm việc
- **When** quản lý chọn "Tháng 7" năm "2026"
- **Then** hệ thống hiển thị các tuần của tháng 7 (tuần T2–CN), mỗi tuần một lưới, nhãn "Tuần 1 (29/06–05/07)"…

**AC-2: Tuần vắt qua hai tháng (xác thực nghiệp vụ)**
- **Given** một tuần có ngày từ 29/06 đến 05/07
- **When** quản lý xem tháng 7
- **Then** tuần đó xuất hiện dưới tháng 7 là "Tuần 1" (quy tắc: tuần thuộc tháng chứa ngày Thứ Năm của nó)

**AC-3: Chuyển nhanh tháng liền kề (luồng thường)**
- **Given** quản lý đang xem tháng 7/2026
- **When** quản lý bấm mũi tên "tháng sau"
- **Then** hệ thống hiển thị các tuần của tháng 8/2026

---

## US-LICH-03 — Chốt lịch tuần

**As a** quản lý
**I want to** bấm "Chốt tuần" khi lịch một tuần đã ổn
**So that** từ đó mọi chỉnh sửa đều được ghi vào lịch sử để truy vết

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-LICH-01 |
| Negotiable | ✅ | Ai được chốt có thể siết sau |
| Valuable | ✅ | Cắt mốc "lịch chính thức" |
| Estimable | ✅ | 1 nút + đổi trạng thái doc |
| Small | ✅ | |
| Testable | ✅ | Trạng thái tuần đổi + lịch sử ghi nhận |

### Tiêu chí nghiệm thu

**AC-1: Chốt tuần (luồng thường)**
- **Given** tuần đang ở trạng thái "Nháp"
- **When** quản lý bấm "Chốt tuần" và xác nhận
- **Then** trạng thái tuần chuyển "Đã chốt", các ô ca trở thành chỉ-đọc, và một dòng "Chốt lịch tuần" được ghi vào lịch sử kèm tên người chốt

**AC-2: Tuần đã chốt hiển thị rõ (luồng thường)**
- **Given** tuần đã ở trạng thái "Đã chốt"
- **When** bất kỳ ai mở lịch tuần đó
- **Then** hệ thống hiển thị nhãn "Đã chốt" và tên người chốt, không cho sửa ô trực tiếp

**AC-3: Bỏ chốt (luồng biên)**
- **Given** tuần đang "Đã chốt"
- **When** quản lý bấm "Bỏ chốt" và nhập lý do
- **Then** trạng thái tuần về "Nháp" và một dòng "Bỏ chốt" (đánh dấu sau chốt) kèm lý do được ghi vào lịch sử

---

## US-OT-01 — Ghi giờ làm thêm cho từng nhân viên

**As a** nhân viên sale
**I want to** thêm giờ làm thêm cho một hoặc nhiều ngày trong tuần với số giờ tương ứng
**So that** giờ làm thêm được cộng vào tổng giờ để tính điểm và lương, không cần báo miệng

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Gắn với một tuần cụ thể |
| Negotiable | ✅ | Mức giờ chọn được (hiện 1–9h) |
| Valuable | ✅ | Đầu vào tính lương |
| Estimable | ✅ | Ghi mảng vào doc tuần |
| Small | ✅ | Thao tác chọn nhanh |
| Testable | ✅ | Tổng giờ tuần cập nhật đúng |

### Tiêu chí nghiệm thu

**AC-1: Thêm giờ làm thêm (luồng thường)**
- **Given** nhân viên đang xem một tuần
- **When** nhân viên bấm "＋" ở dòng của mình, chọn "Thứ 4", chọn "2h"
- **Then** hệ thống lưu giờ làm thêm 2h cho nhân viên đó vào Thứ 4 và cộng vào "Giờ đăng ký tuần"

**AC-2: Thêm cho một dãy ngày (luồng thường)**
- **Given** nhân viên mở bảng chọn thứ
- **When** nhân viên giữ Shift chọn từ Thứ 2 đến Thứ 4 rồi chọn "2h"
- **Then** hệ thống lưu 2h làm thêm cho cả ba ngày

**AC-3: Mỗi người mỗi ngày một dòng (xác thực nghiệp vụ)**
- **Given** nhân viên A đã có 2h làm thêm vào Thứ 6
- **When** nhân viên A thêm lại cho Thứ 6 với 3h
- **Then** hệ thống ghi đè thành 3h, không tạo hai dòng cho cùng ngày

**AC-4: Ghi chú tự do (luồng thường)**
- **Given** một tuần đang "Nháp"
- **When** người dùng nhập vào ô "Ghi chú tự do" nội dung "Duy T2:2h; Hà nghỉ chiều T6 nhờ Thương"
- **Then** hệ thống lưu ghi chú và ghi một dòng "Sửa ghi chú tuần" vào lịch sử

---

## US-SUA-01 — Điều chỉnh lịch sau khi đã chốt

**As a** quản lý
**I want to** mở một tuần đã chốt để sửa, với lý do bắt buộc
**So that** mọi thay đổi sau khi lịch đã chính thức đều có dấu vết và lý do

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-LICH-03 |
| Negotiable | ✅ | Có bắt lý do từng thay đổi hay một lý do cho cả lần điều chỉnh |
| Valuable | ✅ | Vừa linh hoạt vừa truy vết được |
| Estimable | ✅ | Trạng thái editing cục bộ + gắn lý do vào change |
| Small | ✅ | |
| Testable | ✅ | Thay đổi ghi `afterLock = true` kèm lý do |

### Tiêu chí nghiệm thu

**AC-1: Vào chế độ điều chỉnh (luồng thường)**
- **Given** tuần đang "Đã chốt"
- **When** quản lý bấm "Điều chỉnh" và nhập lý do "Hà xin đổi ca chiều T4 sang Duy"
- **Then** các ô ca của tuần mở cho sửa và một dải cảnh báo hiển thị lý do đang áp dụng

**AC-2: Thay đổi được ghi là sau chốt (xác thực nghiệp vụ)**
- **Given** quản lý đang trong chế độ điều chỉnh một tuần đã chốt
- **When** quản lý đổi ô "Chiều — Thứ 4" từ Hà sang Duy
- **Then** hệ thống lưu thay đổi và ghi một dòng lịch sử đánh dấu "sau chốt" kèm lý do "Hà xin đổi ca chiều T4 sang Duy"

**AC-3: Kết thúc điều chỉnh (luồng thường)**
- **Given** quản lý đã điều chỉnh xong
- **When** quản lý bấm "Xong"
- **Then** tuần trở lại chỉ-đọc, vẫn ở trạng thái "Đã chốt"

---

## US-SUA-02 — Xem lịch sử chỉnh lịch

**As a** quản lý
**I want to** xem toàn bộ thao tác đăng ký / đổi ca / chốt / điều chỉnh của tháng, lọc được theo nhân viên và theo "chỉ sau chốt"
**So that** tôi biết ai đổi gì, khi nào, vì sao

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần có dữ liệu thay đổi |
| Negotiable | ✅ | Bộ lọc có thể mở rộng |
| Valuable | ✅ | Minh bạch, giải quyết tranh luận |
| Estimable | ✅ | Đọc `workScheduleChanges` + lọc client |
| Small | ✅ | 1 hộp thoại danh sách |
| Testable | ✅ | Kết quả lọc đúng |

### Tiêu chí nghiệm thu

**AC-1: Xem lịch sử tháng (luồng thường)**
- **Given** trong tháng đã có các thay đổi lịch
- **When** quản lý mở "Lịch sử chỉnh lịch"
- **Then** hệ thống hiển thị danh sách thay đổi mới nhất trước, mỗi dòng ghi thời gian, người sửa, tuần, nội dung, và nhãn "sau chốt" nếu có

**AC-2: Lọc theo nhân viên (luồng thường)**
- **Given** danh sách lịch sử đang mở
- **When** quản lý chọn lọc nhân viên = "Quyến"
- **Then** hệ thống chỉ hiển thị các thay đổi liên quan đến Quyến

**AC-3: Chỉ xem thay đổi sau chốt (xác thực nghiệp vụ)**
- **Given** danh sách lịch sử đang mở
- **When** quản lý chọn "Chỉ sau khi chốt"
- **Then** hệ thống chỉ hiển thị các thay đổi có nhãn "sau chốt"

**AC-4: Không có thay đổi khớp (luồng biên)**
- **Given** không có thay đổi nào của Thương sau chốt
- **When** quản lý lọc nhân viên = "Thương" và "Chỉ sau khi chốt"
- **Then** hệ thống hiển thị thông báo "Không có thay đổi nào khớp bộ lọc"

---

## US-CHAM-01 — Đánh dấu ca đổi / nhờ người trực hộ

**As a** quản lý
**I want to** đánh dấu một ô ca là "đổi ca" kèm ghi chú (ví dụ "Hà trực hộ 3h")
**So that** ca đó bị loại khỏi việc chấm tiêu chí 1 & 2, tránh chấm oan người đăng ký gốc

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Gắn với một ô ca đã có |
| Negotiable | ✅ | Cách hiển thị dấu hiệu |
| Valuable | ✅ | Chấm điểm công bằng |
| Estimable | ✅ | Thêm cờ + ghi chú vào ô |
| Small | ✅ | 1 popover trên ô |
| Testable | ✅ | Cờ lưu đúng, ô bị loại khi chấm |

### Tiêu chí nghiệm thu

**AC-1: Đánh dấu đổi ca (luồng thường)**
- **Given** ô "Chiều — Thứ 6" đang có Hà
- **When** quản lý mở ghi chú ô, nhập "Duy hỗ trợ 2h" và tick "Ca này có đổi / nhờ người — bỏ qua khi chấm tiêu chí 1 & 2"
- **Then** hệ thống lưu ghi chú + cờ, ô hiển thị chỉ báo "⇄ đổi ca", và một dòng "đánh dấu đổi ca" được ghi vào lịch sử

**AC-2: Ca đánh dấu không bị chấm (xác thực nghiệp vụ)**
- **Given** ô "Chiều — Thứ 6" của Hà đã được đánh dấu "đổi ca"
- **When** hệ thống chấm tiêu chí 1 & 2 cho kỳ chứa ngày đó
- **Then** ca đó không tính vào giờ thiếu, không tính vào lần vào ca muộn của Hà

**AC-3: Gỡ đánh dấu (luồng biên)**
- **Given** ô đang được đánh dấu "đổi ca"
- **When** quản lý bỏ tick trong ghi chú ô
- **Then** hệ thống gỡ cờ, ca quay lại được chấm bình thường

---

## US-CHAM-02 — Chấm tiêu chí "Đủ giờ ca" & "Vào ca" từ lịch đăng ký

**As a** quản lý
**I want to** hệ thống tự so lịch đăng ký với hoạt động thật trên Pancake để chấm tiêu chí 1 (Đủ giờ ca) và 2 (Vào ca)
**So that** hai tiêu chí này có số liệu khách quan thay vì để trống

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-LICH-01 (lịch) và dữ liệu hoạt động Pancake |
| Negotiable | ✅ | Ngưỡng dung sai "đi muộn" chỉnh được (hiện 10 phút) |
| Valuable | ✅ | Hoàn thiện bảng điểm |
| Estimable | ✅ | Hàm thuần so lịch vs hoạt động |
| Small | ⚠️ | Hơi lớn — chấm điểm + drill-down; có thể tách phần drill-down |
| Testable | ✅ | Đối chiếu với một tuần lịch mẫu |

### Tiêu chí nghiệm thu

**AC-1: Chấm khi có lịch (luồng thường)**
- **Given** một nhân viên có đăng ký ca Sáng (8–13h) ngày 06/09 và hoạt động Pancake đầu tiên của ca đó là 10:30
- **When** quản lý mở Bảng điểm cho kỳ chứa ngày 06/09
- **Then** tiêu chí "Vào ca" ghi nhận một lần "vào ca muộn ~150′", tiêu chí "Đủ giờ ca" cộng phần giờ thiếu của ca đó

**AC-2: Bỏ ca (xác thực nghiệp vụ)**
- **Given** một nhân viên đăng ký ca Tối (19–24h) một ngày nhưng không có hoạt động Pancake nào trong khung giờ đó
- **When** hệ thống chấm điểm
- **Then** ca đó tính là "bỏ ca": cộng đủ 5h vào giờ thiếu và +1 lần vi phạm nặng cho tiêu chí "Vào ca"

**AC-3: Tin khách nhắn 0h–8h không ảnh hưởng (xác thực nghiệp vụ)**
- **Given** một nhân viên không đăng ký ca nào và cũng không có ca chưa kết thúc
- **When** hệ thống chấm điểm cho kỳ đó
- **Then** tiêu chí 1 & 2 ở trạng thái "chờ — chưa có lịch đăng ký cho kỳ này", không chấm

**AC-4: Ca chưa kết thúc không bị chấm (luồng biên)**
- **Given** hôm nay là ngày D, một nhân viên đăng ký ca Tối của ngày D và ca đó chưa hết giờ
- **When** hệ thống chấm điểm
- **Then** ca đó chưa được đưa vào tính giờ thiếu / vào ca muộn

**AC-5: Xem chi tiết ca lỗi (luồng thường)**
- **Given** bảng điểm hiển thị điểm tiêu chí 1 hoặc 2 dưới mức tối đa
- **When** quản lý bấm vào ô điểm đó
- **Then** hệ thống liệt kê từng ca lỗi kèm mô tả ("Sáng · Thứ 6 · 06/09 — vào ca muộn 150′", "thiếu 2.5h (làm 2.5/5h)")

---

## Ghi chú chung, giả định & câu hỏi làm rõ

1. **Ca làm cố định:** Sáng 8–13h (5h), Chiều 13–19h (6h), Tối 19–24h (5h). Khung 0h–8h là ngoài giờ trực, tin khách trong khung này không tính rep muộn / bỏ sót.
2. **Một ô ca = một người** (đã chốt 07/09/2026). Trường hợp nhiều người / một buổi ghi ở "Ghi chú tự do" hoặc dùng cờ "đổi ca".
3. **"Đi muộn"** đo từ hoạt động đầu tiên có ghi nhận trên Pancake (tin nhắn / tạo đơn / xem hội thoại), không phải lúc đăng nhập — có dung sai 10 phút, là hằng số chỉnh được.
4. **Phân quyền:** hiện gác quyền phía client, không ép buộc máy chủ. Ai đăng nhập cũng sửa được ô "Nháp" và bấm "Chốt / Bỏ chốt"; danh tính người thao tác được ghi vào lịch sử.
5. **Lịch sử (`workScheduleChanges`)** chỉ được đọc và thêm mới, không sửa / xoá qua web.
6. **Chưa bao gồm:** phê duyệt đăng ký (nhân viên đề xuất → quản lý duyệt), lịch lặp (copy tuần trước), thông báo khi bị đổi ca.
