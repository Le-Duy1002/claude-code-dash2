/**
 * Báo cáo xuất thành Google Sheets vào thư mục Drive của một dự án (thường
 * là một dự án con). Domain types + pure helpers. No React, no Firebase.
 *
 * Mỗi loại báo cáo là một mẫu cố định: người dùng chỉ chọn khoảng ngày (hai
 * khoảng, với mẫu so sánh) và dự án để lưu, máy chủ tự lấy số liệu, dựng
 * file và đặt vào Drive.
 */

export type ReportKind = "pancake-weekly" | "pancake-compare"

export const REPORT_KINDS: {
  value: ReportKind
  label: string
  description: string
}[] = [
  {
    value: "pancake-weekly",
    label: "Báo cáo tuần Pancake",
    description:
      "Mes thu về, đơn chốt, đơn đủ 3 thẻ (Thủ công + Tiềm năng + Đã chốt), đơn chốt demo, tỉ lệ chốt demo và tỉ lệ chốt tổng — từng page và chung, chia theo từng tuần 7 ngày tính từ ngày bắt đầu.",
  },
  {
    value: "pancake-compare",
    label: "So sánh 2 khoảng thời gian (Pancake)",
    description:
      "Cùng các chỉ số của báo cáo tuần, đặt cạnh nhau cho 2 khoảng ngày tự chọn (ví dụ 17–23/10 với 24–30/10): số của từng khoảng, chênh lệch và % thay đổi — từng page và chung.",
  },
]

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  "pancake-weekly": "Báo cáo tuần Pancake",
  "pancake-compare": "So sánh Pancake",
}

export function isReportKind(value: unknown): value is ReportKind {
  return REPORT_KINDS.some((k) => k.value === value)
}

/**
 * Longest range one export may cover: each export reads Pancake live, and
 * two weeks took ~1 minute (20/10/2026), so a month stays inside the
 * route's 300 s.
 */
export const REPORT_MAX_DAYS = 31

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number)
  return { y, m, d }
}

/** `iso` moved by `n` calendar days. */
export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Days in `[from, to]`, both ends included. */
export function daysInclusive(from: string, to: string): number {
  const a = parts(from)
  const b = parts(to)
  return (
    Math.round(
      (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000
    ) + 1
  )
}

/** Every day in `[from, to]`, oldest first. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day)
  return out
}

/** `"2026-10-04"` → `"04/10"`. */
export function formatDm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** `"2026-10-04"` → `"04/10/2026"`. */
export function formatDmy(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

export type ReportPeriod = { title: string; from: string; to: string }

/**
 * `[from, to]` cut into 7-day weeks starting at `from` (the last one may be
 * shorter), then the whole range as "Cả kỳ" when there is more than one week
 * — the same blocks as the weekly report sent on 18/10/2026 (04–10/10,
 * 11–17/10, both).
 */
export function reportPeriods(from: string, to: string): ReportPeriod[] {
  const weeks: ReportPeriod[] = []
  for (let start = from, n = 1; start <= to; start = addDays(start, 7), n++) {
    const end = addDays(start, 6) < to ? addDays(start, 6) : to
    weeks.push({
      title: `Tuần ${n} (${formatDm(start)} – ${formatDm(end)})`,
      from: start,
      to: end,
    })
  }
  return weeks.length > 1
    ? [
        ...weeks,
        { title: `Cả kỳ (${formatDm(from)} – ${formatDm(to)})`, from, to },
      ]
    : weeks
}

/** The two whole 7-day weeks ending yesterday. */
export function defaultReportRange(todayIso: string): {
  from: string
  to: string
} {
  const to = addDays(todayIso, -1)
  return { from: addDays(to, -13), to }
}

/**
 * `[from, to]` made exportable: not past today, and at most the last
 * `REPORT_MAX_DAYS` of it — so a page's "Tháng này" / "30 ngày" filter can
 * prefill the export. Falls back to `defaultReportRange` when nothing is left.
 */
export function clampReportRange(
  from: string,
  to: string,
  todayIso: string
): { from: string; to: string } {
  const end = to < todayIso ? to : todayIso
  const earliest = addDays(end, -(REPORT_MAX_DAYS - 1))
  const start = from > earliest ? from : earliest
  return ISO_DATE.test(start) && start <= end
    ? { from: start, to: end }
    : defaultReportRange(todayIso)
}

/** Why `[from, to]` can't be exported, or null when it can. */
export function reportRangeError(
  from: string,
  to: string,
  todayIso: string
): string | null {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return "Chọn ngày bắt đầu và kết thúc."
  if (to < from) return "Ngày kết thúc phải sau ngày bắt đầu."
  if (to > todayIso) return "Ngày kết thúc không được sau hôm nay."
  if (daysInclusive(from, to) > REPORT_MAX_DAYS) {
    return `Mỗi lần xuất tối đa ${REPORT_MAX_DAYS} ngày.`
  }
  return null
}

/** File name in Drive, e.g. "Báo cáo tuần Pancake 04/10 – 17/10/2026". */
export function reportFileName(kind: ReportKind, from: string, to: string): string {
  const start = from.slice(0, 4) === to.slice(0, 4) ? formatDm(from) : formatDmy(from)
  return `${REPORT_KIND_LABELS[kind]} ${start} – ${formatDmy(to)}`
}

// ------------------------------------------------- so sánh 2 khoảng ngày

export type DateRange = { from: string; to: string }

/**
 * Longest stretch, first day of the earlier range to last day of the later
 * one, a comparison may cover — the export reads Pancake back to the earliest
 * day in one pass, so two whole months (e.g. tháng 9 với tháng 10) is the cap.
 */
export const COMPARE_MAX_SPAN_DAYS = 62

/** The same number of days right before `range`. */
export function previousRange(range: DateRange): DateRange {
  const length = daysInclusive(range.from, range.to)
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) }
}

/**
 * Khoảng 2 = `second` (or the last 7 whole days ending yesterday), khoảng 1 =
 * the same number of days right before it.
 */
export function defaultCompareRanges(
  todayIso: string,
  second?: DateRange
): { first: DateRange; second: DateRange } {
  const to = addDays(todayIso, -1)
  const b = second ?? { from: addDays(to, -6), to }
  return { first: previousRange(b), second: b }
}

/** Why the two ranges can't be compared, or null when they can. */
export function compareRangeError(
  first: DateRange,
  second: DateRange,
  todayIso: string
): string | null {
  const firstError = reportRangeError(first.from, first.to, todayIso)
  if (firstError) return `Khoảng 1: ${firstError}`
  const secondError = reportRangeError(second.from, second.to, todayIso)
  if (secondError) return `Khoảng 2: ${secondError}`
  const start = first.from < second.from ? first.from : second.from
  const end = first.to > second.to ? first.to : second.to
  if (daysInclusive(start, end) > COMPARE_MAX_SPAN_DAYS) {
    return `Hai khoảng phải nằm trong ${COMPARE_MAX_SPAN_DAYS} ngày, tính từ ngày đầu của khoảng sớm hơn đến ngày cuối của khoảng muộn hơn.`
  }
  return null
}

/** The blocks of a comparison: "Khoảng 1 (17/10 – 23/10)", "Khoảng 2 (…)". */
export function comparePeriods(first: DateRange, second: DateRange): ReportPeriod[] {
  return [first, second].map((r, i) => ({
    title: `Khoảng ${i + 1} (${formatDm(r.from)} – ${formatDm(r.to)})`,
    ...r,
  }))
}

/** e.g. "So sánh Pancake 17/10 – 23/10 với 24/10 – 30/10/2026". */
export function compareFileName(first: DateRange, second: DateRange): string {
  const oneYear = first.from.slice(0, 4) === second.to.slice(0, 4)
  const dm = (iso: string) => (oneYear ? formatDm(iso) : formatDmy(iso))
  return `${REPORT_KIND_LABELS["pancake-compare"]} ${dm(first.from)} – ${dm(
    first.to
  )} với ${dm(second.from)} – ${formatDmy(second.to)}`
}

/** What the client asks the export route for. */
export type ReportRequest =
  | { kind: "pancake-weekly"; from: string; to: string }
  | { kind: "pancake-compare"; first: DateRange; second: DateRange }

/** What the export route answers with. */
export type ReportExportResult = {
  projectId: string
  fileId: string
  name: string
  webViewLink: string
  /** parts of the data that may be incomplete — also written into the file */
  warnings: string[]
}
