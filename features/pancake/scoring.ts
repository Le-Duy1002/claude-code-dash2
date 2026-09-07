/**
 * The evaluation model from the "Bảng đánh giá hiệu suất nhân sự Sale" sheet.
 * Pure — no React, no Firebase, no server-only imports.
 *
 * Each criterion turns a raw metric into a 1 / 3 / 5 score against fixed public
 * thresholds; scores are weighted into a total out of 100.
 *
 *   1 = Kém   3 = Đạt   5 = Vượt
 *
 * Criterion 3 (nộp báo cáo tháng) is entered by hand and is not computed here.
 * Criteria 1 & 2 need each person's shift schedule (integrated later) and 6
 * needs the standard tag list, so those report `pending` until configured.
 */

export type Score = 1 | 3 | 5

export const SCORE_LABEL: Record<Score, string> = {
  1: "Kém",
  3: "Đạt",
  5: "Vượt",
}

export type CriterionId =
  | "hours"
  | "attendance"
  | "report"
  | "replyOnTime"
  | "missed"
  | "tagging"
  | "closeRate"
  | "demoCloseRate"

export type CriterionGroup = "shift" | "inbox" | "tagging" | "sales"

export const GROUP_LABEL: Record<CriterionGroup, string> = {
  shift: "I. Thời gian ca làm",
  inbox: "II. Xử lý inbox",
  tagging: "III. Quy trình gán tag",
  sales: "IV. Hiệu quả chốt đơn",
}

export type CriterionDef = {
  id: CriterionId
  /** the number in the sheet (1, 2, 3, 4, 5, 6, 7, 8) */
  sheetNo: number
  group: CriterionGroup
  /** full name */
  label: string
  /** 1-2 word column header */
  shortLabel: string
  /** short unit shown next to the raw value */
  unit: string
  /** weight in percent — sums to 100 across all 8 */
  weight: number
  /** human text for Kém / Đạt / Vượt */
  bands: { kem: string; dat: string; vuot: string }
  /** null when this criterion can't be computed yet (see module doc) */
  score: ((value: number) => Score) | null
  /** why it's not computed yet, when `score` is null */
  pendingReason?: string
}

/** bigger raw value is better (rates) */
function higherBetter(datMin: number, vuotMin: number) {
  return (value: number): Score =>
    value >= vuotMin ? 5 : value >= datMin ? 3 : 1
}

/** smaller raw value is better (counts of problems) */
function lowerBetter(vuotMax: number, datMax: number) {
  return (value: number): Score =>
    value <= vuotMax ? 5 : value <= datMax ? 3 : 1
}

export const CRITERIA: CriterionDef[] = [
  {
    id: "hours",
    sheetNo: 1,
    group: "shift",
    label: "Đảm bảo đủ giờ theo ca",
    shortLabel: "Đủ giờ ca",
    unit: "giờ thiếu",
    weight: 10,
    bands: {
      kem: "Thiếu > 2 giờ",
      dat: "Thiếu ≤ 2 giờ",
      vuot: "Không thiếu giờ nào",
    },
    score: (value: number): Score => (value > 2 ? 1 : value > 0 ? 3 : 5),
    pendingReason: "Chưa có lịch đăng ký cho kỳ này",
  },
  {
    id: "attendance",
    sheetNo: 2,
    group: "shift",
    label: "Không bỏ ca / không đến muộn",
    shortLabel: "Vào ca",
    unit: "lần vi phạm",
    weight: 10,
    bands: {
      kem: "Bỏ ca (≥ 1 lần)",
      dat: "Đi muộn 1–2 lần",
      vuot: "Không vi phạm lần nào",
    },
    // value = số lần muộn + 3 × số lần bỏ ca, nên 1 lần bỏ ca đã là Kém
    score: lowerBetter(0, 2),
    pendingReason: "Chưa có lịch đăng ký cho kỳ này",
  },
  {
    id: "report",
    sheetNo: 3,
    group: "shift",
    label: "Nộp báo cáo tháng đúng hạn",
    shortLabel: "Báo cáo",
    unit: "lần trễ",
    weight: 5,
    bands: { kem: "Trễ > 2 lần", dat: "Trễ 1–2 lần", vuot: "Không trễ lần nào" },
    score: lowerBetter(0, 2),
    pendingReason: "Nhập tay",
  },
  {
    id: "replyOnTime",
    sheetNo: 4,
    group: "inbox",
    label: "Phản hồi đúng hạn ≤ 3 phút",
    shortLabel: "Rep ≤ 3′",
    unit: "%",
    weight: 20,
    bands: { kem: "< 80%", dat: "80% – < 95%", vuot: "≥ 95%" },
    score: higherBetter(80, 95),
  },
  {
    id: "missed",
    sheetNo: 5,
    group: "inbox",
    label: "Số hội thoại bỏ sót (> 15 phút / không rep)",
    shortLabel: "Bỏ sót",
    unit: "hội thoại",
    weight: 10,
    bands: { kem: "≥ 3 lần", dat: "1 – 2 lần", vuot: "0 lần" },
    score: lowerBetter(0, 2),
  },
  {
    id: "tagging",
    sheetNo: 6,
    group: "tagging",
    label: "Gán tag đúng & đầy đủ theo danh sách chuẩn",
    shortLabel: "Gán tag",
    unit: "%",
    weight: 10,
    bands: { kem: "< 70%", dat: "70% – < 95%", vuot: "≥ 95%" },
    score: higherBetter(70, 95),
    pendingReason: "Chưa có hội thoại đơn chốt nào để xét tag Đã chốt",
  },
  {
    id: "closeRate",
    sheetNo: 7,
    group: "sales",
    label: "Tỷ lệ chốt đơn tổng",
    shortLabel: "Tỷ lệ chốt",
    unit: "%",
    weight: 15,
    bands: { kem: "< 15%", dat: "15% – 22%", vuot: "> 22%" },
    score: (value: number): Score => (value > 22 ? 5 : value >= 15 ? 3 : 1),
  },
  {
    id: "demoCloseRate",
    sheetNo: 8,
    group: "sales",
    label: "Tỷ lệ chốt qua demo",
    shortLabel: "Chốt demo",
    unit: "%",
    weight: 20,
    bands: { kem: "< 10%", dat: "10% – 30%", vuot: "> 30%" },
    score: (value: number): Score => (value > 30 ? 5 : value >= 10 ? 3 : 1),
  },
]

export const CRITERION_BY_ID = new Map(CRITERIA.map((c) => [c.id, c]))

// ---------------------------------------------------------------- rating bands

export type Rating =
  | "Chưa đạt"
  | "Đạt"
  | "Khá"
  | "Tốt"
  | "Xuất sắc"
  | "Chưa đủ dữ liệu"

export const RATING_ORDER: Rating[] = [
  "Chưa đủ dữ liệu",
  "Chưa đạt",
  "Đạt",
  "Khá",
  "Tốt",
  "Xuất sắc",
]

export function ratingFor(total: number | null): Rating {
  if (total == null) return "Chưa đủ dữ liệu"
  if (total >= 90) return "Xuất sắc"
  if (total >= 75) return "Tốt"
  if (total >= 60) return "Khá"
  if (total >= 50) return "Đạt"
  return "Chưa đạt"
}

// ---------------------------------------------------------------- one result

export type CriterionResult = {
  id: CriterionId
  sheetNo: number
  /** the computed raw metric, or null when pending */
  value: number | null
  /** 1 / 3 / 5, or null when pending */
  score: Score | null
  /** (score / 5) × weight — the points this criterion adds to the total */
  points: number
  pending: boolean
  pendingReason?: string
  /** timestamps + descriptions of the events that dragged the score down */
  offenders: ScoreEvent[]
}

export type ScoreEvent = {
  atMs: number
  /** customer name */
  label: string
  /** e.g. "sau 8′", "chưa trả lời" */
  detail?: string
  /** Pancake customer uuid */
  customerId?: string
  /** fb page id the conversation belongs to */
  pageId?: string
  /** Pancake conversation id (`{pageId}_{psid}`) */
  conversationId?: string
}

export function evaluateCriterion(
  id: CriterionId,
  value: number | null,
  offenders: ScoreEvent[] = []
): CriterionResult {
  const def = CRITERION_BY_ID.get(id)!
  const canScore = def.score != null && value != null
  const score = canScore ? def.score!(value) : null
  return {
    id,
    sheetNo: def.sheetNo,
    value,
    score,
    points: score == null ? 0 : (score / 5) * def.weight,
    pending: !canScore,
    pendingReason: canScore ? undefined : def.pendingReason,
    offenders: offenders
      .slice()
      .sort((a, b) => a.atMs - b.atMs),
  }
}

/**
 * Weighted total over the criteria that could be scored. `outOf` is the sum of
 * weights that contributed, so the UI can show "78 / 95" honestly while the
 * pending criteria are still dark.
 */
export function totalScore(results: CriterionResult[]): {
  total: number | null
  outOf: number
  rating: Rating
} {
  let total = 0
  let outOf = 0
  for (const result of results) {
    if (result.score == null) continue
    total += result.points
    outOf += CRITERION_BY_ID.get(result.id)!.weight
  }
  if (outOf === 0) {
    return { total: null, outOf: 0, rating: "Chưa đủ dữ liệu" }
  }
  const rounded = Math.round(total * 10) / 10
  // rating uses the /100 scale, so scale the partial total up
  const scaledForRating = (rounded / outOf) * 100
  return { total: rounded, outOf, rating: ratingFor(scaledForRating) }
}
