---
name: cc-user-story-acceptance-criteria-writer
description: |
  Sinh câu chuyện người dùng (User Story) chuẩn 06 tiêu chí INVEST và tiêu chí nghiệm thu (Acceptance Criteria) dạng Given-When-Then (Gherkin) cho chuyên viên phân tích nghiệp vụ (Business Analyst) và chủ sở hữu sản phẩm (Product Owner).
  Hỗ trợ 3 chế độ: Viết mới, Tinh chỉnh (Refine) và Bổ sung tiêu chí nghiệm thu (Acceptance Criteria).

  KÍCH HOẠT khi người dùng yêu cầu: viết, tạo, đánh giá (review), tối ưu hoặc chia nhỏ câu chuyện người dùng (User Story) hoặc tiêu chí nghiệm thu (Acceptance Criteria).
  Kể cả khi người dùng dán mô tả tính năng hoặc tải tài liệu yêu cầu sản phẩm (Product Requirements Document - PRD) để yêu cầu sinh danh sách câu chuyện người dùng (User Story).

  KHÔNG DÙNG ĐỂ: viết toàn bộ tài liệu yêu cầu sản phẩm (Product Requirements Document - PRD) hay tài liệu đặc tả yêu cầu phần mềm (Software Requirement Specification - SRS) (dùng các công cụ prd-writer, srs-writer), viết kịch bản kiểm thử (test case) kỹ thuật chi tiết, viết trường hợp sử dụng chuẩn tắc (Use Case formal) (dùng po-usecase-refiner), hay thiết kế quy luật nghiệp vụ (Business Rules) (dùng business-rule-generator).
---

# User Story & Acceptance Criteria Writer

## Mục đích

Hỗ trợ chuyên viên phân tích nghiệp vụ (Business Analyst) và chủ sở hữu sản phẩm (Product Owner) soạn thảo câu chuyện người dùng (User Story) chuẩn 06 tiêu chí INVEST và tiêu chí nghiệm thu (Acceptance Criteria) dạng Gherkin chất lượng cao, sẵn sàng cho lập trình viên (Developer) ước lượng thời gian triển khai (estimate) và kiểm thử viên (Tester) viết kịch bản kiểm thử (test case).

## Quy trình thực hiện (Workflow)

### Bước 1: Xác định chế độ (Mode)

Hỏi người dùng hoặc tự suy luận từ nội dung cung cấp (sau đó xác nhận lại):

- **Chế độ A (Viết mới)**: Người dùng cung cấp mô tả tính năng -> Sinh mới câu chuyện người dùng (User Story) và tiêu chí nghiệm thu (Acceptance Criteria).
- **Chế độ B (Tinh chỉnh - Refine)**: Đã có sẵn câu chuyện người dùng (User Story) hoặc tiêu chí nghiệm thu (Acceptance Criteria) -> Đánh giá và đề xuất cải tiến.
- **Chế độ C (Bổ sung tiêu chí nghiệm thu)**: Đã có sẵn câu chuyện người dùng (User Story) -> Sinh thêm tiêu chí nghiệm thu (Acceptance Criteria) chi tiết.

### Bước 2: Thu thập thông tin đầu vào

Đảm bảo thu thập đủ 4 thông tin sau trước khi thực hiện (tuyệt đối không tự suy diễn nếu thiếu):

1. **Persona/User type (Đối tượng sử dụng)**: Ai sử dụng tính năng? (Quản lý dự án (Project Manager), Thành viên nhóm (Team Member), Người giám sát (Supervisor), Khách hàng (Client), Quản trị viên (Admin)...)
2. **Goal (Mục tiêu)**: Người dùng muốn thực hiện hành động gì?
3. **Business value (Giá trị nghiệp vụ)**: Tại sao cần tính năng này? (Giá trị mang lại cho sản phẩm hoặc doanh nghiệp)
4. **Context/Scope (Ngữ cảnh/Phạm vi)**: Tính năng nằm trong phân hệ hoặc module nào?

### Bước 3: Sinh câu chuyện người dùng theo mẫu

Áp dụng định dạng 3 thành phần chuẩn:

```markdown
**Câu chuyện người dùng US-[Mã số]**: [Tiêu đề ngắn gọn]

**As a** [Đối tượng sử dụng cụ thể, không dùng từ chung chung như "user"]
**I want to** [Hành động cụ thể, có thể đo lường được]
**So that** [Giá trị thực tế mang lại, không lặp lại phần I want]
```

### Bước 4: Kiểm tra theo chuẩn 06 tiêu chí INVEST

Tự đánh giá câu chuyện người dùng (User Story) trước khi phản hồi dựa trên bảng sau:

| Tiêu chí | Câu hỏi tự kiểm tra | Cách xử lý nếu không đạt |
| :--- | :--- | :--- |
| **I**ndependent (Độc lập) | Câu chuyện người dùng có phụ thuộc vào câu chuyện khác không? | Tách sự phụ thuộc hoặc gộp các câu chuyện |
| **N**egotiable (Thương lượng) | Có chỗ cho việc thảo luận và thương lượng không? | Lược bỏ các chi tiết kỹ thuật cứng nhắc |
| **V**aluable (Giá trị) | Mang lại giá trị thực tế gì cho người dùng hoặc doanh nghiệp? | Viết lại phần **So that** rõ ràng hơn |
| **E**stimable (Ước lượng) | Đội ngũ phát triển có ước lượng được nỗ lực triển khai không? | Bổ sung ngữ cảnh và các ràng buộc |
| **S**mall (Nhỏ gọn) | Có thể hoàn thành trong một chu kỳ phát triển (Sprint) không? | Chia nhỏ thành các câu chuyện độc lập khác |
| **T**estable (Kiểm thử được) | Kiểm thử viên có thể viết kịch bản kiểm thử tương ứng không? | Bổ sung tiêu chí nghiệm thu cụ thể, đo lường được |

*(Chi tiết xem tại [invest-criteria.md](./references/invest-criteria.md))*

### Bước 5: Sinh tiêu chí nghiệm thu (Acceptance Criteria)

Đảm bảo **tối thiểu 3 tiêu chí nghiệm thu** định dạng Gherkin (Given-When-Then) bao quát: Kịch bản thông thường (tiêu chí nghiệm thu 1), Trường hợp biên hoặc xác thực nghiệp vụ (tiêu chí nghiệm thu 2), và Luồng xử lý lỗi (tiêu chí nghiệm thu 3).

```markdown
**Tiêu chí nghiệm thu [số thứ tự]: [Tên kịch bản (Scenario)]**
- **Given** [Tiền điều kiện cụ thể]
- **When** [Hành động kích hoạt của người dùng]
- **Then** [Kết quả mong đợi hoặc đầu ra đo lường được]
- **And** [Kết quả phụ đi kèm (nếu có)]
```

**Nguyên tắc viết tiêu chí nghiệm thu:**

- **Đo lường được:** Tránh từ ngữ mơ hồ như "nhanh", "đẹp", "hợp lý", "thân thiện với người dùng" (user-friendly).
- **Tập trung nghiệp vụ:** Không đưa chi tiết kỹ thuật hoặc giao diện người dùng (User Interface) vào tiêu chí nghiệm thu (đó là việc của lập trình viên).
- **Đơn nhất:** Mỗi tiêu chí nghiệm thu chỉ giải quyết duy nhất một kịch bản, không gộp nhiều luồng xử lý phức tạp.

### Bổ sung: Definition of Done (DoD)

**DoD vs Tiêu chí nghiệm thu (AC) — khác nhau thế nào?**

| | Tiêu chí nghiệm thu (AC) | Definition of Done (DoD) |
| :--- | :--- | :--- |
| **Mục đích** | Story đạt yêu cầu nghiệp vụ? | Story sẵn sàng bàn giao? |
| **Viết cho** | BA / PO | Dev / QA |
| **Nội dung** | Nghiệp vụ, business outcome | Kỹ thuật, code quality, testing |
| **Ví dụ** | "Then hệ thống hiển thị xác nhận" | "Code passed unit test" |

DoD là danh sách checklist kỹ thuật mà developer tự đánh dấu khi story hoàn thành. Khác với tiêu chí nghiệm thu (cho BA/PO xác nhận nghiệp vụ), DoD (cho Dev/QA xác nhận chất lượng kỹ thuật).

**Ví dụ DoD cho story Kéo-thả Kanban:**

```text
**Definition of Done:**
- [ ] Code passed unit test
- [ ] Tested trên Chrome, Safari, Firefox
- [ ] Realtime sync hoạt động với 3+ user đồng thời
- [ ] Có animation mượt khi kéo-thả
```

### Bước 6: Định dạng kết quả đầu ra (Output)

Trình bày theo thứ tự sau:

1. **Câu chuyện người dùng (User Story)**: Gồm 3 dòng (As a / I want / So that).
2. **Tự đánh giá theo chuẩn 06 tiêu chí INVEST (INVEST Self-check)**: Bảng tự đánh giá với trạng thái Đạt (✅) hoặc Cần cải thiện (⚠️) cho 6 tiêu chí.
3. **Tiêu chí nghiệm thu (Acceptance Criteria)**: Danh sách được đánh số thứ tự cụ thể.
4. **Ghi chú (Notes)**: Các sự phụ thuộc, giả định hoặc câu hỏi làm rõ.
5. **Xác nhận bàn giao**: Đề xuất người dùng kiểm tra lại toàn bộ nội dung và hỏi định dạng mong muốn trước khi xuất tài liệu.

## Các mẫu chống lại thiết kế chuẩn (Anti-patterns) cần tránh

- ❌ **Đối tượng sử dụng chung chung**: *"As a user"*
  👉 ✅ **Chi tiết**: *"As a quản lý dự án đã được phân công quản lý dự án và xác thực địa chỉ thư điện tử (email)"*
- ❌ **Hành động mơ hồ**: *"I want to manage profile"*
  👉 ✅ **Cụ thể**: *"I want to update my email address"*
- ❌ **Giá trị trùng lặp mục tiêu**: *"So that I can manage profile"*
  👉 ✅ **Ý nghĩa**: *"So that I receive notifications at correct address"*
- ❌ **Tiêu chí nghiệm thu mô tả giao diện**: *"Then button turns blue"*
  👉 ✅ **Mô tả hành vi**: *"Then system displays confirmation message"*
- ❌ **Tiêu chí nghiệm thu chứa logic kỹ thuật**: *"Then call API /v1/users/update"*
  👉 ✅ **Mô tả nghiệp vụ**: *"Then user data is updated and persisted"*
- ❌ **Tiêu chí nghiệm thu thiếu sót**: Chỉ có 1 kịch bản thông thường
  👉 ✅ **Đa dạng**: Tối thiểu 3 tiêu chí nghiệm thu bao quát các nhánh (luồng thông thường, luồng biên, luồng lỗi).
- ❌ **Câu chuyện người dùng quá lớn**: 1 câu chuyện chứa toàn bộ cụm hành động Tạo, Đọc, Cập nhật, Xóa (CRUD)
  👉 ✅ **Phân tách**: Tách riêng biệt thành các câu chuyện nhỏ hơn (Tạo mới, Hiển thị, Cập nhật, Xóa).

### Bảng đối chiếu nhanh

| ❌ Sai | ✅ Đúng |
| :--- | :--- |
| "Làm trang login" (kỹ thuật) | "Là user, tôi muốn đăng nhập để..." |
| Story quá lớn (epic) | Chia nhỏ thành nhiều story |
| Không có "so that" | Luôn nêu rõ giá trị |
| Viết từ góc nhìn dev | Viết từ góc nhìn end-user |
| AC mơ hồ ("phải nhanh") | AC đo lường được ("load <2s") |

## Tiêu chí và Hướng dẫn Phân rã câu chuyện người dùng (User Story)

**Dấu hiệu cần phân rã:**

- Tiêu đề chứa liên từ kết hợp "AND" (ví dụ: "Đăng nhập VÀ đăng ký").
- Chứa nhiều hơn 1 đối tượng sử dụng hoặc xử lý nhiều hành động Tạo, Đọc, Cập nhật, Xóa (CRUD) đồng thời.
- Số lượng kịch bản của tiêu chí nghiệm thu vượt quá 7-8 kịch bản.
- Ước lượng thời gian triển khai (effort) của lập trình viên vượt quá 5 ngày làm việc.

**Quy tắc phân rã phổ biến:**

- **Theo thao tác cơ bản (CRUD):** Tách biệt các hành vi Tạo mới (Create), Hiển thị (Read), Cập nhật (Update), Xóa (Delete).
- **Theo đối tượng sử dụng (Persona):** Tách riêng luồng nghiệp vụ của từng nhóm người dùng (Quản lý dự án, Thành viên nhóm, Khách hàng, Quản trị viên...).
- **Theo quy tắc hoặc luồng nghiệp vụ (Rule/Flow):** Tách luồng thành công (Happy path) khỏi các luồng xác thực điều kiện hoặc kiểm tra quyền truy cập (Permission).
- **Theo dữ liệu xử lý:** Chia nhỏ theo từng loại dữ liệu cụ thể cần xử lý.

---

## Tài liệu tham khảo liên quan

- [user-story-template-example.md](./templates/user-story-template-example.md) - Ví dụ minh họa hoàn chỉnh US "Tạo dự án" với AC Happy + Edge + Negative. Phần 1 là worked example (dữ liệu minh họa đã điền), kèm hướng dẫn viết Given-When-Then chi tiết. Dùng để học cấu trúc và tham khảo.
- [user-story-template-blank.md](./templates/user-story-template-blank.md) - Biểu mẫu trống để điền US thực tế. Có sẵn bảng mã tính năng, trường Status/Approval, và DoD tách kỹ thuật/nghiệp vụ. Dùng khi cần bàn giao cho Sprint Planning.
- [invest-criteria.md](./references/invest-criteria.md) - Tài liệu phân tích sâu về 06 tiêu chí INVEST.
- [examples.md](./references/examples.md) - 4 ví dụ mẫu thực tế thuộc lĩnh vực Quản lý dự án (ProjectOS).
- [quality-checklist.md](./checklists/quality-checklist.md) - Danh mục tự kiểm tra chất lượng trước khi bàn giao.

**Tham chiếu chéo skills:**

- [prd-template.md](../cc-prd-writer/references/prd-template.md) - PRD template — FR trong PRD là input chính khi viết User Story theo từng FR.
