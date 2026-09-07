# EPIC: Quản lý dự án & tài liệu

> Tính năng #2 của dashboard quản lý đội sale.
> Phân hệ: module `features/projects` (mới), tái dùng `features/tasks` và `features/documents`.
> Trạng thái: Draft — chờ duyệt Sprint Planning.

## Đối tượng sử dụng (Persona)

| Persona | Mô tả |
| :-- | :-- |
| **Quản lý** | Hoàng — tạo & quản lý dự án, giao việc, bình luận, theo dõi tiến độ toàn đội |
| **Nhân viên sale** | Duy / Hà / Quyến / Thương — nhận việc, cập nhật trạng thái, đính kèm tài liệu, phản hồi bình luận |

## Bảng mã tính năng

| Mã | Nhóm |
| :-- | :-- |
| PRJ | Vòng đời dự án |
| TSK | Công việc trong dự án |
| KAN | Bảng Kanban kéo-thả |
| DOC | Tài liệu & đồng bộ Drive |
| CMT | Bình luận công việc |

## Danh sách User Story (vòng đầu)

| Mã | Tiêu đề | Persona chính |
| :-- | :-- | :-- |
| US-PRJ-01 | Tạo dự án kèm thư mục tài liệu riêng | Quản lý |
| US-PRJ-02 | Xem danh sách dự án và tiến độ | Quản lý |
| US-TSK-01 | Thêm công việc vào dự án | Quản lý |
| US-TSK-02 | Bảng công việc dự án: lọc, đếm ngày còn lại, cảnh báo quá hạn | Quản lý |
| US-KAN-01 | Kéo-thả thẻ công việc để cập nhật trạng thái | Nhân viên sale |
| US-DOC-01 | Đính kèm tài liệu cho dự án từ web (đồng bộ lên Drive) | Thành viên dự án |
| US-DOC-02 | Tự nhận tài liệu thêm mới từ Drive (gần realtime qua webhook) | Thành viên dự án |
| US-CMT-01 | Trao đổi bình luận trên công việc | Quản lý |

---

## US-PRJ-01 — Tạo dự án kèm thư mục tài liệu riêng

**As a** quản lý đội sale đã đăng nhập
**I want to** tạo một dự án mới với tên, mô tả, ngày bắt đầu — kết thúc và người phụ trách
**So that** mọi công việc và tài liệu của cùng một mục tiêu được gom về một nơi, tách biệt với dự án khác

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ✅ | Không phụ thuộc story khác; là story nền |
| Negotiable | ✅ | Cơ chế tạo thư mục Drive có thể bàn (tạo ngay / tạo khi cần) |
| Valuable | ✅ | Là điều kiện để phân tách dữ liệu theo dự án |
| Estimable | ✅ | Tái dùng mẫu tạo thư mục Drive đã có của thư viện tài liệu |
| Small | ✅ | 1 form + 1 lần gọi tạo thư mục Drive |
| Testable | ✅ | Kiểm tra được bản ghi dự án + thư mục Drive tương ứng |

### Tiêu chí nghiệm thu

**AC-1: Tạo dự án thành công (luồng thường)**
- **Given** quản lý đang ở màn hình danh sách dự án
- **When** quản lý nhập tên dự án, mô tả, ngày bắt đầu, ngày kết thúc, chọn người phụ trách và xác nhận tạo
- **Then** hệ thống lưu dự án ở trạng thái "Đang chạy" và hiển thị nó trong danh sách
- **And** hệ thống tạo cho dự án một thư mục tài liệu riêng và liên kết thư mục đó với dự án

**AC-2: Bắt buộc nhập trường tối thiểu (luồng biên)**
- **Given** quản lý đang mở form tạo dự án
- **When** quản lý xác nhận tạo mà chưa nhập tên dự án
- **Then** hệ thống không tạo dự án và báo rõ trường "Tên dự án" là bắt buộc

**AC-3: Ngày kết thúc trước ngày bắt đầu (xác thực nghiệp vụ)**
- **Given** quản lý đã nhập ngày bắt đầu là 10/09 và ngày kết thúc là 05/09
- **When** quản lý xác nhận tạo
- **Then** hệ thống không tạo dự án và báo "Ngày kết thúc phải sau ngày bắt đầu"

**AC-4: Không tạo được thư mục tài liệu (luồng lỗi)**
- **Given** quản lý xác nhận tạo dự án hợp lệ nhưng dịch vụ lưu trữ tài liệu tạm thời không phản hồi
- **When** hệ thống lưu dự án nhưng không tạo được thư mục tài liệu
- **Then** hệ thống vẫn lưu dự án, đánh dấu "chưa có thư mục tài liệu" và cho phép quản lý bấm tạo lại thư mục sau

### Ghi chú

- Do phạm vi quyền Drive (`drive.file`), thư mục dự án **phải do ứng dụng tự tạo** (không gắn thư mục có sẵn) — giống thư mục thư viện hiện tại.
- **Đã chốt (07/09/2026):** một dự án có 1 hoặc nhiều người phụ trách.
- **Đã chốt (07/09/2026):** xoá / đóng dự án **không** xoá thư mục Drive của dự án.

---

## US-PRJ-02 — Xem danh sách dự án và tiến độ

**As a** quản lý đội sale
**I want to** xem tất cả dự án cùng số công việc đã xong / tổng số và trạng thái quá hạn
**So that** tôi nắm nhanh dự án nào đang trễ mà không phải mở từng dự án

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-PRJ-01 để có dữ liệu; vẫn phát triển song song được với dữ liệu mẫu |
| Negotiable | ✅ | Cách hiển thị tiến độ có thể bàn (%, x/y, thanh) |
| Valuable | ✅ | Tầm nhìn tổng thể cho quản lý |
| Estimable | ✅ | Đọc và tổng hợp phía client |
| Small | ✅ | 1 màn hình danh sách |
| Testable | ✅ | Đối chiếu số liệu tổng hợp với dữ liệu công việc |

### Tiêu chí nghiệm thu

**AC-1: Hiển thị danh sách kèm tiến độ (luồng thường)**
- **Given** có 3 dự án, trong đó dự án A có 4/10 công việc ở trạng thái "Hoàn thành"
- **When** quản lý mở màn hình danh sách dự án
- **Then** hệ thống hiển thị 3 dự án, dự án A ghi tiến độ "4/10 công việc hoàn thành"

**AC-2: Đánh dấu dự án quá hạn (xác thực nghiệp vụ)**
- **Given** dự án B có ngày kết thúc là hôm qua và còn công việc chưa hoàn thành
- **When** quản lý mở màn hình danh sách dự án
- **Then** hệ thống đánh dấu dự án B là "Quá hạn"

**AC-3: Chưa có dự án nào (luồng biên)**
- **Given** chưa có dự án nào được tạo
- **When** quản lý mở màn hình danh sách dự án
- **Then** hệ thống hiển thị thông báo trống và nút tạo dự án đầu tiên

**AC-4: Lọc theo thời gian (luồng thường)**
- **Given** quản lý đang xem danh sách dự án
- **When** quản lý chọn khoảng thời gian "Tháng này"
- **Then** hệ thống chỉ hiển thị dự án có thời gian hoạt động giao với tháng hiện tại

---

## US-TSK-01 — Thêm công việc vào dự án

**As a** quản lý đội sale
**I want to** thêm một công việc vào dự án với tiêu đề, người đảm nhiệm, độ ưu tiên, ngày bắt đầu — kết thúc và trạng thái ban đầu
**So that** nhân viên biết chính xác việc cần làm, thuộc dự án nào và hạn chót khi nào

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần dự án tồn tại (US-PRJ-01) |
| Negotiable | ✅ | Tập trường có thể mở rộng sau |
| Valuable | ✅ | Đơn vị giao việc cơ bản |
| Estimable | ✅ | Mở rộng `features/tasks` sẵn có, thêm liên kết `projectId` |
| Small | ✅ | 1 form thêm |
| Testable | ✅ | Bản ghi công việc gắn đúng dự án |

### Tiêu chí nghiệm thu

**AC-1: Thêm công việc thành công (luồng thường)**
- **Given** quản lý đang xem dự án A
- **When** quản lý nhập tiêu đề, chọn người đảm nhiệm là Hà, độ ưu tiên "Cao", ngày kết thúc 20/09 và xác nhận
- **Then** hệ thống thêm công việc vào dự án A ở trạng thái "Chưa bắt đầu" với người đảm nhiệm là Hà

**AC-2: Người đảm nhiệm phải thuộc đội (xác thực nghiệp vụ)**
- **Given** quản lý đang thêm công việc
- **When** quản lý xác nhận mà chưa chọn người đảm nhiệm
- **Then** hệ thống không thêm công việc và báo "Phải chọn người đảm nhiệm"

**AC-3: Hạn công việc vượt ngày kết thúc dự án (luồng biên)**
- **Given** dự án A kết thúc ngày 30/09
- **When** quản lý đặt ngày kết thúc công việc là 15/10 và xác nhận
- **Then** hệ thống vẫn thêm công việc nhưng cảnh báo "Hạn công việc trễ hơn hạn dự án"

**AC-4: Mất kết nối khi lưu (luồng lỗi)**
- **Given** quản lý đã điền hợp lệ form thêm công việc
- **When** kết nối tới cơ sở dữ liệu thất bại lúc lưu
- **Then** hệ thống giữ nguyên nội dung đã nhập và báo lỗi để quản lý thử lại

---

## US-TSK-02 — Bảng công việc dự án: lọc theo tiêu chí, đếm ngày còn lại, cảnh báo quá hạn

**As a** quản lý đội sale
**I want to** xem toàn bộ công việc của một dự án trong một bảng lọc được theo trạng thái, độ ưu tiên, người đảm nhiệm và khoảng thời gian, có cột "còn lại" và cảnh báo quá hạn
**So that** tôi tìm nhanh việc trễ hạn hoặc việc của một người cụ thể mà không phải đọc từng thẻ

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần US-TSK-01 để có dữ liệu |
| Negotiable | ✅ | Cách trình bày "còn lại" / cảnh báo có thể bàn |
| Valuable | ✅ | Công cụ giám sát chính của quản lý |
| Estimable | ✅ | Tái dùng bảng + bộ lọc kiểu `features/tasks`, thêm cột thời hạn |
| Small | ⚠️ | Hơi lớn nếu gộp cả nhóm theo cột — có thể tách phần "nhóm theo trạng thái" |
| Testable | ✅ | Kiểm tra kết quả lọc và giá trị cột "còn lại" |

### Tiêu chí nghiệm thu

**AC-1: Lọc theo người đảm nhiệm và trạng thái (luồng thường)**
- **Given** dự án A có 12 công việc, 3 việc của Quyến đang ở trạng thái "Đang thực hiện"
- **When** quản lý lọc người đảm nhiệm = Quyến và trạng thái = "Đang thực hiện"
- **Then** hệ thống chỉ hiển thị đúng 3 công việc đó

**AC-2: Cột "còn lại" và cảnh báo quá hạn (xác thực nghiệp vụ)**
- **Given** hôm nay là 07/09, công việc X có hạn 10/09 chưa hoàn thành, công việc Y có hạn 05/09 chưa hoàn thành
- **When** quản lý mở bảng công việc
- **Then** công việc X hiển thị "Còn 3 ngày" và công việc Y hiển thị "Quá hạn 2 ngày" kèm dấu hiệu cảnh báo

**AC-3: Việc đã hoàn thành không cảnh báo (luồng biên)**
- **Given** công việc Z có hạn 05/09 và đã ở trạng thái "Hoàn thành"
- **When** quản lý mở bảng công việc
- **Then** công việc Z hiển thị "Đã hoàn thành" và không có cảnh báo quá hạn

**AC-4: Bộ lọc không có kết quả (luồng biên)**
- **Given** không có công việc nào của Thương ở độ ưu tiên "Cao"
- **When** quản lý lọc người đảm nhiệm = Thương, độ ưu tiên = "Cao"
- **Then** hệ thống hiển thị bảng trống với thông báo "Không có công việc khớp bộ lọc"

---

## US-KAN-01 — Kéo-thả thẻ công việc để cập nhật trạng thái

**As a** nhân viên sale được giao việc
**I want to** kéo thẻ công việc từ cột trạng thái này sang cột khác trên bảng Kanban
**So that** tôi cập nhật tiến độ tức thì mà không phải mở form chỉnh sửa

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần công việc tồn tại (US-TSK-01) |
| Negotiable | ✅ | Số cột / nhãn cột có thể bàn |
| Valuable | ✅ | Giảm ma sát khi cập nhật, dữ liệu tiến độ sát thực tế hơn |
| Estimable | ✅ | Có sẵn `@dnd-kit` trong dự án |
| Small | ✅ | 1 tương tác kéo-thả + 1 lần ghi trạng thái |
| Testable | ✅ | Kiểm tra trạng thái công việc sau khi thả |

### Tiêu chí nghiệm thu

**AC-1: Kéo thẻ đổi trạng thái (luồng thường)**
- **Given** công việc X đang ở cột "Chưa bắt đầu"
- **When** nhân viên kéo thẻ X sang cột "Đang thực hiện" và thả
- **Then** trạng thái công việc X được cập nhật thành "Đang thực hiện" ngay và không mở form nào

**AC-2: Thả lại đúng cột cũ (luồng biên)**
- **Given** nhân viên đang kéo thẻ X ra khỏi cột "Đang thực hiện"
- **When** nhân viên thả thẻ X trở lại cột "Đang thực hiện"
- **Then** trạng thái công việc X không đổi và không phát sinh bản ghi cập nhật

**AC-3: Cập nhật thất bại (luồng lỗi)**
- **Given** nhân viên vừa thả thẻ X sang cột "Hoàn thành"
- **When** việc ghi trạng thái xuống cơ sở dữ liệu thất bại
- **Then** hệ thống đưa thẻ X về lại cột cũ và báo "Không cập nhật được trạng thái, thử lại"

**AC-4: Hai người cùng thao tác (đồng thời)**
- **Given** quản lý và nhân viên cùng mở bảng Kanban của dự án A
- **When** nhân viên kéo thẻ X sang "Hoàn thành"
- **Then** trong vòng vài giây bảng của quản lý cũng hiển thị thẻ X ở cột "Hoàn thành"

### Definition of Done

- [ ] Code qua unit test
- [ ] Kiểm thử trên Chrome, Firefox, Safari
- [ ] Đồng bộ realtime hoạt động với 3+ người xem cùng lúc
- [ ] Có phản hồi hình ảnh khi kéo và khi thả (không giật)
- [ ] Hoàn tác được về trạng thái cũ khi ghi thất bại

---

## US-DOC-01 — Đính kèm tài liệu cho dự án từ web (đồng bộ lên Drive)

**As a** thành viên dự án (quản lý hoặc nhân viên)
**I want to** tải tài liệu lên ngay trong dự án trên web
**So that** tài liệu xuất hiện đồng thời trong thư mục Drive của dự án đó để cả đội truy cập từ Drive

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần thư mục dự án (US-PRJ-01) |
| Negotiable | ✅ | Giới hạn dung lượng / loại file có thể bàn |
| Valuable | ✅ | Tài liệu tập trung, không lạc chỗ |
| Estimable | ✅ | Tái dùng luồng upload OAuth của `features/documents`, đổi thư mục đích theo dự án |
| Small | ✅ | 1 hành động upload |
| Testable | ✅ | File hiện trong dự án trên web và trong thư mục Drive dự án |

### Tiêu chí nghiệm thu

**AC-1: Tải tài liệu lên thành công (luồng thường)**
- **Given** nhân viên đang xem dự án A đã có thư mục tài liệu
- **When** nhân viên tải lên tệp "bao-gia.pdf"
- **Then** hệ thống hiển thị "bao-gia.pdf" trong danh sách tài liệu của dự án A
- **And** tệp được đưa vào thư mục Drive của dự án A

**AC-2: Vượt giới hạn dung lượng (xác thực nghiệp vụ)**
- **Given** nhân viên chọn tệp lớn hơn giới hạn cho phép (khoảng 4 MB)
- **When** nhân viên xác nhận tải lên
- **Then** hệ thống từ chối và báo "Tệp vượt giới hạn, vui lòng tải trực tiếp lên thư mục Drive của dự án"

**AC-3: Dự án chưa có thư mục tài liệu (luồng biên)**
- **Given** dự án B tạo lỗi thư mục tài liệu (theo US-PRJ-01 AC-4)
- **When** nhân viên mở khu vực tài liệu của dự án B
- **Then** hệ thống ẩn nút tải lên và hiển thị nút "Tạo thư mục tài liệu cho dự án"

**AC-4: Tải lên thất bại giữa chừng (luồng lỗi)**
- **Given** nhân viên đang tải "hop-dong.docx" lên dự án A
- **When** kết nối tới dịch vụ lưu trữ bị gián đoạn
- **Then** hệ thống không tạo bản ghi tài liệu treo và báo "Tải lên thất bại, thử lại"

---

## US-DOC-02 — Tự nhận tài liệu thêm mới từ Drive (gần realtime qua webhook)

**As a** thành viên dự án
**I want to** thấy trên web trong vài giây mọi tệp mà ai đó thêm, đổi tên hoặc xoá thẳng trong thư mục Drive của dự án
**So that** danh sách tài liệu trên web luôn khớp với Drive dù người thao tác không dùng web

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần thư mục dự án (US-PRJ-01) |
| Negotiable | ✅ | Chu kỳ gia hạn kênh webhook, tần suất cron dự phòng có thể bàn |
| Valuable | ✅ | Web là nguồn tin cậy, không bỏ sót tài liệu, độ trễ thấp |
| Estimable | ⚠️ | Cần đăng ký Drive push notification cho từng thư mục dự án + endpoint nhận + job gia hạn kênh (kênh sống tối đa ~7 ngày). Nhiều dự án = nhiều kênh cần theo dõi. |
| Small | ⚠️ | Có phần hạ tầng (đăng ký / gia hạn / nhận webhook) — cân nhắc tách "US-DOC-02a: hạ tầng webhook" khỏi "US-DOC-02b: phản ánh thay đổi" khi ước lượng |
| Testable | ✅ | Thêm/xoá file trên Drive → web đổi trong vài giây; kênh hết hạn được gia hạn |

### Tiêu chí nghiệm thu

**AC-1: Đồng bộ file mới gần realtime (luồng thường)**
- **Given** dự án A đang được theo dõi thay đổi thư mục Drive
- **When** một thành viên thêm tệp "ke-hoach.xlsx" thẳng vào thư mục Drive của dự án A
- **Then** trong vòng vài giây "ke-hoach.xlsx" xuất hiện trong danh sách tài liệu của dự án A trên web, đánh dấu nguồn "từ Drive"

**AC-2: File bị xoá khỏi Drive (xác thực nghiệp vụ)**
- **Given** tệp "ban-nhap.docx" đang hiển thị trên web và bị xoá khỏi thư mục Drive dự án A
- **When** Drive gửi thông báo thay đổi
- **Then** hệ thống gỡ "ban-nhap.docx" khỏi danh sách tài liệu của dự án A trên web

**AC-3: File tải lên từ web không bị nhân đôi (luồng biên)**
- **Given** nhân viên vừa tải "bao-gia.pdf" lên qua web (US-DOC-01) và tệp đã nằm trong thư mục Drive dự án A
- **When** Drive gửi thông báo thay đổi cho tệp đó
- **Then** "bao-gia.pdf" vẫn chỉ có một mục trong danh sách, không tạo bản trùng

**AC-4: Kênh webhook hết hạn (xác thực nghiệp vụ)**
- **Given** kênh theo dõi thay đổi của dự án A sắp hết hạn
- **When** job gia hạn định kỳ chạy
- **Then** hệ thống đăng ký lại kênh mới trước khi kênh cũ hết hạn, việc theo dõi không bị gián đoạn

**AC-5: Không nhận được thông báo (luồng lỗi / dự phòng)**
- **Given** trong 1 giờ qua không có thông báo thay đổi nào từ Drive cho dự án A
- **When** đợt quét dự phòng định kỳ chạy
- **Then** hệ thống đối chiếu toàn bộ thư mục Drive dự án A với danh sách trên web và bổ sung / gỡ cho khớp

### Ghi chú

- Đã chốt hướng **webhook Drive (gần realtime)** thay cho đồng bộ theo cron thuần.
- Kênh Drive push notification sống tối đa ~7 ngày → **bắt buộc có job gia hạn**. Vẫn giữ một đợt quét dự phòng thưa (ví dụ mỗi giờ) làm lưới an toàn khi mất thông báo (AC-5).
- Endpoint nhận webhook phải chạy trên Node runtime và xác thực được nguồn thông báo từ Google.

---

## US-CMT-01 — Trao đổi bình luận trên công việc

**As a** quản lý đội sale
**I want to** để lại bình luận trên một công việc và để nhân viên đảm nhiệm phản hồi ngay dưới bình luận đó
**So that** trao đổi về công việc được lưu tại chỗ, không lạc trong tin nhắn riêng

### Tự đánh giá INVEST

| Tiêu chí | Trạng thái | Ghi chú |
| :-- | :-- | :-- |
| Independent | ⚠️ | Cần công việc tồn tại (US-TSK-01) |
| Negotiable | ✅ | Độ sâu phân luồng, thông báo có thể bàn |
| Valuable | ✅ | Giữ ngữ cảnh trao đổi gắn với công việc |
| Estimable | ✅ | Tái dùng bình luận phân luồng của `features/tasks` |
| Small | ✅ | Thêm + phản hồi trong một luồng |
| Testable | ✅ | Bình luận & phản hồi hiển thị đúng thứ tự, đúng người |

### Tiêu chí nghiệm thu

**AC-1: Quản lý bình luận, nhân viên phản hồi (luồng thường)**
- **Given** công việc X do Hà đảm nhiệm
- **When** quản lý thêm bình luận "Khách yêu cầu đổi màu bìa" và Hà phản hồi "Đã cập nhật, gửi lại chiều nay"
- **Then** hệ thống hiển thị phản hồi của Hà lồng dưới bình luận của quản lý, kèm tên người và thời điểm

**AC-2: Không cho gửi bình luận rỗng (xác thực nghiệp vụ)**
- **Given** quản lý đang mở ô bình luận của công việc X
- **When** quản lý bấm gửi khi nội dung trống hoặc chỉ có khoảng trắng
- **Then** hệ thống không tạo bình luận

**AC-3: Xoá bình luận gốc còn phản hồi (luồng biên)**
- **Given** bình luận của quản lý đã có 2 phản hồi
- **When** quản lý xoá bình luận gốc đó
- **Then** hệ thống vẫn giữ hiển thị 2 phản hồi và đánh dấu bình luận gốc đã bị xoá

**AC-4: Gửi bình luận khi mất mạng (luồng lỗi)**
- **Given** nhân viên vừa soạn phản hồi trên công việc X
- **When** việc lưu bình luận thất bại do mất kết nối
- **Then** hệ thống giữ lại nội dung đã soạn và báo để nhân viên gửi lại

---

## Ghi chú chung, giả định & câu hỏi làm rõ

1. **Quyền hạn:** hệ thống hiện gác quyền hoàn toàn phía client, không có phân quyền máy chủ. Các story giả định "quản lý" và "nhân viên" tự giác đúng vai; nếu cần chặn cứng (nhân viên không tạo/xoá được dự án) thì phải bổ sung lớp phân quyền — tách thành story riêng.
2. **Thư mục Drive mỗi dự án:** bắt buộc do ứng dụng tạo (giới hạn `drive.file`). Nhiều dự án → nhiều thư mục con trong thư mục gốc của ứng dụng.
3. **Giới hạn tải lên ~4 MB** (giới hạn thân request của nền tảng). File lớn hơn → hướng dẫn thả trực tiếp vào Drive rồi để đồng bộ ngược nhận về (US-DOC-02).
4. **"Dự án" là lớp bắt buộc:** các story giả định mọi công việc thuộc về một dự án. Nếu vẫn cần công việc lẻ không thuộc dự án nào thì cần story bổ sung.
5. **Đính kèm tài liệu ở cấp dự án:** các story để tài liệu ở cấp **dự án**. Nếu cần gắn tài liệu vào từng công việc cụ thể thì thêm story "US-DOC-03 — Gắn tài liệu của dự án vào một công việc".
6. **Chưa bao gồm (vòng sau):** sửa / đóng dự án, xoá công việc, thông báo khi được giao việc / khi có bình luận mới.
