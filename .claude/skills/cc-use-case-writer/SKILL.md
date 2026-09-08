---
name: cc-use-case-writer
description: Sinh đặc tả Use Case (Use Case) theo template 13 trường chuẩn Karl Wiegers / IIBA. Kích hoạt khi: "write a use case", "viết use case", "Use Case specification", "split into Use Cases", "review Use Case", dán BRD/PRD yêu cầu chuyển thành Use Case. Tuân thủ Cockburn's guidelines (coffee-break test, goal levels) + checklist 20 điểm. Output: English Markdown 13 trường. KHÔNG dùng cho Agile User Story, PRD/SRS, hay UML diagram.
---

# Use Case Writer

Giúp IT Business Analyst phân tích và viết Use Case (Use Case) theo template 13 trường chuẩn
**Karl Wiegers / IIBA**, tham chiếu Alistair Cockburn's "Writing Effective Use Cases".

---

## Khi nào dùng

- Viết Use Case mới từ feature description, BRD, PRD
- Review / refine Use Case có sẵn
- Tách feature lớn thành danh sách Use Case
- Viết một phần cụ thể: Normal Course, Alternative Course, Exceptions

## Nguyên tắc output

1. **Định dạng**: Markdown, bố cục bảng 2 cột.
2. **Chế độ**: Tuần tự — viết **từng nhóm 1**, **dừng và hỏi người dùng xác nhận** trước khi tiếp. Không dump full Use Case cùng lúc trừ khi người dùng yêu cầu.
3. **Viết 100% Tiếng Việt**, chỉ giữ lại thuật ngữ Tiếng Anh
4. Tránh viết tắt.
5. Tham chiếu đến @

---

## Quy trình 4 bước

```text
Bước 1: CLASSIFY → xác định chế độ (A/B/C/D)
Bước 2: SCOPE    → áp dụng 4 rule + coffee-break test
Bước 3: WRITE    → điền 13 trường, theo nhóm
Bước 4: VALIDATE → chạy checklist 20 điểm
```

---

## Bước 1 — Classify và xác định chế độ

| Chế độ | Dấu hiệu nhận biết | Hành động |
|---------|---------------------|-----------|
| **A: Viết mới** | Dán feature/BRD/PRD, "write Use Case for X" | → Bước 2 → Bước 3 |
| **B: Tách feature** | "split into Use Case list", "how many Use Cases", PRD lớn | → Bước 2 kỹ hơn → output **danh sách Use Case** → hỏi viết Use Case nào trước |
| **C: Review Use Case** | Dán Use Case có sẵn, "review this", "what's missing" | → Bước 4 (validate checklist) |
| **D: Viết 1 phần** | "write Normal Course", "add Exceptions" | → Đọc context → nhảy đến phần liên quan trong Bước 3 |

**Nguyên tắc quan trọng**: Đầu vào mơ hồ (1 dòng) → **HỎI trước**. Tối đa 3 câu hỏi:

1. Primary actor là ai? (role cụ thể)
2. Actor muốn đạt được gì?
3. Use Case thuộc system/module nào?

---

## Bước 2 — Xác định phạm vi Use Case

**Đây là bước quan trọng nhất, dễ sai nhất.**

### 4 nguyên tắc xác định phạm vi

### Rule 1 — Coffee-break test (Cockburn)

Sau khi hoàn thành Use Case, actor có thể nghỉ giải lao mà không cảm thấy việc còn dở? NO → Use Case quá chi tiết (sub-function), gộp lại. YES → phạm vi vừa đúng (user-goal level).

### Rule 2 — Goal Level (3 cấp độ)

| Cấp độ | Mô tả | Nên viết? |
|---------|-------|-----------|
| Summary (cloud) | Use Case trải nhiều session | ❌ Gộp nhiều Use Case |
| **User-goal (sea)** ✅ | 1 actor, 1 session, 1 business goal | ✅ Đúng |
| Sub-function (fish) | 1 bước nhỏ trong Use Case khác | ❌ Gộp vào Use Case cha hoặc làm Includes |

### Rule 3 — 1 Actor, 1 Goal, 1 Session

Mỗi Use Case đúng: 1 primary actor + 1 business goal + hoàn thành trong 1 continuous session. Thấy 2 goal → tách 2 Use Case.

### Rule 4 — System Boundary

Use Case mô tả **tương tác** giữa actor và system, KHÔNG phải nội bộ system. Mỗi step phải là:

- Actor → System (đầu vào)
- System → Actor (đầu ra)

Nếu step không có actor lẫn UI → đó là design detail, không thuộc Use Case.

### 3 kỹ thuật tách Use Case (cho chế độ B)

1. **Goal-driven (top-down)**: Mỗi goal của mỗi actor = 1 Use Case
2. **Event-driven**: External (click, submit, cron) + Internal (batch process) → mỗi event = 1 Use Case
3. **CRUD-driven**: Mỗi business entity (Project, Task, Team Member…) → kiểm tra Create/Read/Update/Delete → mỗi thao tác = 1 Use Case

### Kết quả đầu ra của Bước 2

- **Chế độ A**: Xác nhận phạm vi bằng 1 câu, hỏi người dùng xác nhận trước Bước 3
  > "Scope confirmed: user-goal level. Primary actor: [X]. Goal: [Y]. System boundary: [Z]. Confirm to proceed?"
- **Chế độ B**: Bảng danh sách Use Case:

```text
| Use Case ID | Use Case Name            | Primary Actor      | Priority |
|-------------|-------------------------|--------------------|----------|
| UC-01       | Create new project      | Project Manager    | High     |
| UC-02       | Assign task to member   | Project Manager    | High     |
```

→ Hỏi: "Which Use Case to write in detail first?"

---

## Bước 3 — Viết Use Case (13 trường, theo nhóm)

Template:

```markdown
| **Use Case ID:**           | UC-XX-YY                              |
| **Use Case Name:**         | [Verb + Object]                       |
| **Created By:**            |              | **Last Updated By:** |        |
| **Date Created:**          |              | **Date Last Updated:** |        |

| **Actor:**                 | Primary / Secondary                   |
| **Description:**           | [WHY + WHAT + OUTCOME]                |
| **Preconditions:**         | 1. ... 2. ...                         |
| **Postconditions:**        | 1. ... 2. ...                         |
| **Priority:**              | High / Medium / Low                   |
| **Frequency of Use:**      | [X times / unit time]                 |
| **Normal Course of Events:** | 1. Actor... 2. System...           |
| **Alternative Courses:**   | UC-XX-YY.AC.1: [name]                |
| **Exceptions:**           | UC-XX-YY.EX.1: [name]                |
| **Includes:**              | UC-AA-BB                              |
| **Special Requirements:**   | [NFR: perf, security…]                |
| **Assumptions:**           | 1. ...                                |
| **Notes and Issues:**      | TBD-1: [open] / Owner / Due           |
```

Template copy tại `assets/uc-template.md`.

### 5 nhóm — viết tuần tự, dừng sau mỗi nhóm

| Nhóm | Nội dung | Xác nhận |
|------|----------|----------|
| **Nhóm 1** | ID, Name, History, Actor, Description | "Nhóm 1 done. Confirm preconditions + priority?" |
| **Nhóm 2** | Preconditions, Postconditions, Priority, Frequency | "Nhóm 2 done. Confirm Normal Course?" |
| **Nhóm 3** | Normal Course of Events (happy path) | "Nhóm 3 done. Confirm Alternative + Exceptions?" |
| **Nhóm 4** | Alternative Courses + Exceptions | "Nhóm 4 done. Confirm final group?" |
| **Nhóm 5** | Includes, Special Requirements, Assumptions, Notes | "All done. Run 20-point validation?" |

### Cách điền từng trường

**Use Case Name**: `Verb + Object`, active voice. ✅ "Create new project" | ❌ "Enrollment", "Manage projects"

**Actor**:

- *Primary*: khởi tạo Use Case, được lợi từ kết quả
- *Secondary*: hỗ trợ (payment gateway, OTP service…)
- KHÔNG viết "User" — phải cụ thể (Project Manager, Team Member, Admin…)

**Preconditions**: Điều kiện **phải đúng** trước khi Use Case bắt đầu. Có thể verify được.

- ✅ "Project Manager has logged in and has permission to create projects in the workspace"
- ❌ "Project Manager is motivated to work" (không verify được)

**Postconditions**: Trạng thái system **SAU KHI** Use Case hoàn thành thành công. Verify được.

- ✅ "Project record is created with status='Active' and project members are notified"
- ❌ "Project Manager is satisfied"

**Normal Course of Events**:

- Danh sách đánh số, 1 action mỗi step
- Xen kẽ Actor / System, chủ ngữ rõ ràng
- **KHÔNG** nhúng if/else, loop trong Normal Course → chuyển sang Alternative/Exception
- ✅ "1. Project Manager clicks 'Create Project'. 2. System displays the project creation form. 3. Project Manager fills in project details and clicks 'Save'."
- ❌ "1. If Project Manager has admin role, show all options; otherwise show limited options…" (branching nhúng)

**Alternative Courses**: Đường đi khác nhưng **vẫn dẫn đến thành công**. Format: `UC-XX.AC.N: At step Y, if [condition], execute: …`

**Exceptions**: Trường hợp **thất bại** (lỗi, validation fail, timeout). Format: `UC-XX.EX.N`. Mỗi exception cần: trigger + system response + final state.

**Includes**: Use Case con được gọi bởi Use Case hiện tại. Ví dụ: Use Case "Enroll" includes Use Case "Process payment".

**Special Requirements**: Non-Functional Requirements riêng cho Use Case này — Performance ("catalog loads ≤ 2s"), Security ("TLS 1.3"), Usability, Compliance…

**Assumptions**: Giả định trong phân tích. Khác với Precondition — precondition là hard requirement; assumption là belief chưa verified.

**Notes and Issues**: Định dạng TBD `[TBD-N] | Owner | Due | Resolution]`

---

## Bước 4 — Validate (checklist 20 điểm)

**LUÔN chạy checklist TRƯỚC KHI bàn giao Use Case.** Chi tiết đầy đủ tại `references/quality-checklist.md`.

| # | Item | Mô tả |
|---|------|-------|
| C1 | Verb + Object | Use Case Name đúng format |
| C2 | Coffee-break test | Use Case ở user-goal level |
| C3 | Unique ID | Use Case ID nhất quán với naming convention |
| C4 | 1 Actor, 1 Goal | Đúng Rule 3 |
| C5 | System boundary | Không trộn lẫn với Use Case khác |
| C6 | Specific actor | Không phải "User" |
| C7 | WHY + WHAT + OUTCOME | Description đầy đủ |
| C8 | Frequency quantified | Không phải "sometimes" |
| C9 | Preconditions verifiable | Không phải disguised business rule |
| C10 | Postconditions cover success | Tất cả system state changes |
| C11 | Preconditions ≠ Assumptions | Phân biệt rõ hai trường này |
| C12 | One action per step | Normal Course không nhét nhiều action |
| C13 | Actor/System alternating | Subject rõ ràng ở mỗi step |
| C14 | No embedded if/else/loop | Không branching trong Normal Course |
| C15 | Flow complete | Trigger → postcondition, không dây chuyền |
| C16 | AC specifies step number | Mỗi Alternative Course ghi rõ "at step N" |
| C17 | Exception has 3 parts | Trigger + response + final state |
| C18 | Common failures covered | Timeout, invalid input, network, permission denied, concurrency |
| C19 | Includes existing | Không tự include Use Case chưa tồn tại |
| C20 | NFR ≠ functional | Special Requirements không trùng functional req |

**Đầu ra**: Bảng `Item | Status | Note` với ✅ ❌ ⚠️.

---

## Anti-patterns — Tránh tuyệt đối

1. **Use Case = UI flow**: Mô tả mọi button click → đó là wireframe spec, không phải Use Case
2. **Use Case = User Story**: User Story là one-liner "As a… I want… So that…" — Use Case là detailed interaction
3. **Use Case = Business Process**: Business Process cover cả process; Use Case cover 1 actor + 1 system
4. **Verb mơ hồ**: "Manage", "Handle", "Process" → dùng động từ cụ thể
5. **Nhét quá nhiều**: Create project + assign members + set permissions + send notifications trong 1 Use Case → dùng Includes để tách
6. **Chỉ happy path**: Không có exception → developer và QA không có gì để làm
7. **Precondition mơ hồ**: "System is ready" → phải verify được

---

## Tài liệu tham khảo

| File | Nội dung |
|------|----------|
| `references/template-guide.md` | Hướng dẫn chi tiết từng trường (ProjectOS examples) |
| `references/writing-style.md` | Conventions viết (active voice, numbering, anti-patterns) |
| `references/quality-checklist.md` | Checklist 20 điểm + ví dụ pass/fail |
| `references/examples.md` | 2 Use Case mẫu hoàn chỉnh (Create Project, Assign Task) |
| `templates/use-case-template.md` | Template sao chép sẵn dùng |
| `../cc-srs-writer/references/srs-template.md` | Tham chiếu SRS template — Use Case là đầu vào cho Mode B của cc-srs-writer |

---

## Quy ước đặt tên file

`<Use-Case-ID>_<use-case-name-kebab>.md` — ví dụ: `UC-PROJ-01_create-project.md`
