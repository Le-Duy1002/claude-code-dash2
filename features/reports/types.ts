/**
 * Báo cáo xuất thành Google Sheets vào thư mục Drive của một dự án (thường
 * là một dự án con). Domain types + pure helpers. No React, no Firebase.
 *
 * Mỗi loại báo cáo là một mẫu cố định: người dùng chỉ chọn khoảng ngày và
 * dự án để lưu, máy chủ tự lấy số liệu, dựng file và đặt vào Drive.
 */

export type ReportKind = "pancake-weekly"

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
]

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  "pancake-weekly": "Báo cáo tuần Pancake",
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

/** What the export route answers with. */
export type ReportExportResult = {
  projectId: string
  fileId: string
  name: string
  webViewLink: string
  /** parts of the data that may be incomplete — also written into the file */
  warnings: string[]
}
