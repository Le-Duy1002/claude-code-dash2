import "server-only"

import ExcelJS from "exceljs"

import {
  DEMO_CLOSED_TAG_BY_STAFF,
  DEMO_VIEWED_TAG_BY_STAFF,
  TAG_NAMES,
  vnDayRange,
} from "@/features/pancake/types"
import {
  datesBetween,
  formatDmy,
  reportPeriods,
  type ReportPeriod,
} from "@/features/reports/types"
import {
  fetchConversation,
  fetchConversationsSince,
  fetchOrdersSince,
  fetchPageTags,
  fetchWebPageStatistics,
  fetchWebTagStatistics,
  pancakeShops,
  type PancakeOrder,
  type PancakeShop,
} from "@/lib/pancake"

/**
 * "Báo cáo tuần Pancake" — the manager's weekly report (first sent as an
 * .xlsx on 17–18/10/2026), per POS page and combined, read live:
 *  - Mes thu về / Đơn chốt = Pancake's own `new_inbox_count` / `order_count`
 *    (Thống kê › Trang). Before `ORDER_COUNT_FLOOR` Pancake has no order
 *    figure, so the day falls back to the POS closed-order count.
 *  - Đơn đủ 3 thẻ = closed POS orders created that day whose conversation
 *    CURRENTLY carries Thủ công + Tiềm năng + Đã chốt. Pancake keeps no tag
 *    history, so the day is the order's day and the tags are as of export.
 *  - Đơn chốt demo / Demo đã xem / Demo đã gửi = Pancake's Thẻ hội thoại
 *    counts of the staff "… Chốt" / "…Demo" tags and "demo", the same source
 *    as the dashboard's demo section.
 */

const MANUAL_TAG = "thủ công"
const TRIPLE_TAGS = [MANUAL_TAG, TAG_NAMES.tiemNang, TAG_NAMES.daChot]
/** Conversations fetched one by one when the walk didn't reach them. */
const MAX_DIRECT_FETCH = 300

export type WeeklyDayRow = {
  date: string
  page: string
  mes: number
  orders: number
  triple: number
  demoClosed: number
  demoViewed: number
  demoSent: number
}

export type WeeklyMetric = Exclude<keyof WeeklyDayRow, "date" | "page">

export type PancakeWeeklyReport = {
  from: string
  to: string
  pages: string[]
  daily: WeeklyDayRow[]
  periods: ReportPeriod[]
  fetchedAtMs: number
  warnings: string[]
}

const norm = (text: string) => text.normalize("NFC").trim().toLowerCase()
const vnDate = (ms: number) =>
  new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10)

/** Closed = not new, not cancelled — Pancake's order_count matched these (status 1) day for day. */
function isClosedOrder(order: PancakeOrder): boolean {
  return (
    order.status !== 0 &&
    order.status !== 6 &&
    !(order.status >= 11 && order.status <= 16)
  )
}

async function pageDays(
  shop: PancakeShop,
  from: string,
  to: string,
  deadlineMs: number
): Promise<{ rows: WeeklyDayRow[]; warnings: string[] }> {
  const warnings: string[] = []
  const dates = datesBetween(from, to)
  const fromMs = vnDayRange(from).fromMs
  const toMs = vnDayRange(to).toMs

  const [pageStats, tagStats, catalog, orderWalk, convWalk] = await Promise.all([
    fetchWebPageStatistics(shop.fbPageId, from, to),
    fetchWebTagStatistics(shop.fbPageId, from, to),
    fetchPageTags(shop.fbPageId),
    fetchOrdersSince(shop, [fromMs], { pageSize: 100, maxPages: 100, deadlineMs }),
    fetchConversationsSince(shop.fbPageId, [fromMs], {
      maxBatches: 600,
      deadlineMs,
    }),
  ])
  if (orderWalk.truncated) {
    warnings.push(`${shop.name}: chưa đọc hết đơn hàng trong kỳ — số đơn đủ 3 thẻ có thể thiếu.`)
  }

  // ---- 3 thẻ: closed orders whose conversation carries all three tags
  const idsOf = new Map<string, Set<number>>()
  for (const tag of catalog.values()) {
    const key = norm(tag.text)
    idsOf.set(key, (idsOf.get(key) ?? new Set()).add(tag.id))
  }
  const tripleIds = TRIPLE_TAGS.map((t) => idsOf.get(t))
  const missingTags = TRIPLE_TAGS.filter((_, i) => !tripleIds[i])
  if (missingTags.length) {
    warnings.push(`${shop.name}: page không có thẻ ${missingTags.join(", ")} — đơn đủ 3 thẻ tính là 0.`)
  }

  const orders = orderWalk.orders.filter(
    (o) => o.insertedAtMs >= fromMs && o.insertedAtMs < toMs && isClosedOrder(o)
  )
  const tagsOf = new Map(convWalk.conversations.map((c) => [c.id, c.tagIds]))
  const missing = [
    ...new Set(
      orders
        .map((o) => o.conversationId)
        .filter((id): id is string => Boolean(id) && !tagsOf.has(id!))
    ),
  ]
  for (const id of missing.slice(0, MAX_DIRECT_FETCH)) {
    const conv = await fetchConversation(shop.fbPageId, id)
    if (conv) tagsOf.set(conv.id, conv.tagIds)
  }
  if (missing.length > MAX_DIRECT_FETCH) {
    warnings.push(`${shop.name}: ${missing.length - MAX_DIRECT_FETCH} đơn chưa đọc được thẻ hội thoại — số đơn đủ 3 thẻ có thể thiếu.`)
  }
  const hasTriple = (conversationId: string | null) => {
    if (missingTags.length || !conversationId) return false
    const tags = tagsOf.get(conversationId) ?? []
    return tripleIds.every((ids) => tags.some((id) => ids!.has(id)))
  }

  const closedByDay = new Map<string, number>()
  const tripleByDay = new Map<string, number>()
  for (const o of orders) {
    const day = vnDate(o.insertedAtMs)
    closedByDay.set(day, (closedByDay.get(day) ?? 0) + 1)
    if (hasTriple(o.conversationId)) {
      tripleByDay.set(day, (tripleByDay.get(day) ?? 0) + 1)
    }
  }

  // ---- Pancake's own day figures
  const statOf = new Map(pageStats.map((s) => [s.date, s]))
  const tagIdsWhere = (texts: string[]) =>
    Object.keys(tagStats.tagText).filter((id) =>
      texts.includes(norm(tagStats.tagText[id]))
    )
  const viewedIds = tagIdsWhere(Object.values(DEMO_VIEWED_TAG_BY_STAFF))
  const closedIds = tagIdsWhere(Object.values(DEMO_CLOSED_TAG_BY_STAFF))
  const sentIds = tagIdsWhere([TAG_NAMES.demo])
  const tagIndex = new Map(tagStats.dates.map((d, i) => [d, i]))
  const tagSum = (ids: string[], date: string) => {
    const i = tagIndex.get(date)
    if (i == null) return 0
    return ids.reduce((sum, id) => sum + (tagStats.totalsByTagId[id]?.[i] ?? 0), 0)
  }

  const rows = dates.map((date) => {
    const stat = statOf.get(date)
    return {
      date,
      page: shop.name,
      mes: stat?.newInboxCount ?? 0,
      orders: stat?.orderCount ?? closedByDay.get(date) ?? 0,
      triple: tripleByDay.get(date) ?? 0,
      demoClosed: tagSum(closedIds, date),
      demoViewed: tagSum(viewedIds, date),
      demoSent: tagSum(sentIds, date),
    }
  })
  return { rows, warnings }
}

/** Reads every POS page for `[from, to]` (Vietnam days, inclusive). */
export async function buildPancakeWeeklyReport(
  from: string,
  to: string,
  deadlineMs: number
): Promise<PancakeWeeklyReport> {
  const shops = pancakeShops().filter((s) => s.fbPageId)
  if (shops.length === 0) throw new Error("Chưa cấu hình page Pancake nào (PANCAKE_POS_*).")
  const results = await Promise.all(
    shops.map((shop) => pageDays(shop, from, to, deadlineMs))
  )
  return {
    from,
    to,
    pages: shops.map((s) => s.name),
    daily: results.flatMap((r) => r.rows),
    periods: reportPeriods(from, to),
    fetchedAtMs: Date.now(),
    warnings: results.flatMap((r) => r.warnings),
  }
}

// ------------------------------------------------------------ workbook

const HEAD_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" },
}
const BLOCK_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E2F3" },
}
const RATE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
}
const THIN: ExcelJS.Border = { style: "thin", color: { argb: "FFBFBFBF" } }
const BORDER: Partial<ExcelJS.Borders> = {
  top: THIN,
  left: THIN,
  bottom: THIN,
  right: THIN,
}

const METRICS: (
  | { label: string; field: WeeklyMetric }
  | { label: string; rate: [WeeklyMetric, WeeklyMetric] }
)[] = [
  { label: "Số mes thu về", field: "mes" },
  { label: "Số đơn chốt", field: "orders" },
  {
    label: "Số đơn có đủ 3 thẻ Thủ công + Tiềm năng + Đã chốt",
    field: "triple",
  },
  { label: "Số đơn chốt demo", field: "demoClosed" },
  { label: "Demo đã xem (mẫu số của tỉ lệ chốt demo)", field: "demoViewed" },
  {
    label: "Tỉ lệ chốt demo tổng team (đơn chốt demo / demo đã xem)",
    rate: ["demoClosed", "demoViewed"],
  },
  { label: "Tỉ lệ chốt tổng (đơn chốt / mes thu về)", rate: ["orders", "mes"] },
]

const DAILY_COLUMNS: { header: string; key: keyof WeeklyDayRow; width: number }[] = [
  { header: "Ngày", key: "date", width: 12 },
  { header: "Page", key: "page", width: 18 },
  { header: "Mes thu về", key: "mes", width: 12 },
  { header: "Đơn chốt", key: "orders", width: 11 },
  { header: "Đơn đủ 3 thẻ", key: "triple", width: 13 },
  { header: "Đơn chốt demo", key: "demoClosed", width: 14 },
  { header: "Demo đã xem", key: "demoViewed", width: 13 },
  { header: "Demo đã gửi", key: "demoSent", width: 12 },
]

function sumOf(
  report: PancakeWeeklyReport,
  field: WeeklyMetric,
  pages: string[],
  period: ReportPeriod
): number {
  return report.daily
    .filter(
      (r) => pages.includes(r.page) && r.date >= period.from && r.date <= period.to
    )
    .reduce((sum, r) => sum + r[field], 0)
}

function fetchedLabel(ms: number): string {
  const d = new Date(ms + 7 * 3_600_000)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}:${mm} ngày ${formatDmy(d.toISOString().slice(0, 10))}`
}

/** The report as an .xlsx (Drive converts it to a Google Sheet on upload). */
export async function pancakeWeeklyWorkbook(
  report: PancakeWeeklyReport
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Dashboard Hẻm"
  const { pages } = report
  const groups = pages.length > 1 ? [...pages, "Chung các page"] : pages
  const pagesOf = (i: number) => (i < pages.length ? [pages[i]] : pages)

  // ---- Tổng hợp
  const ss = wb.addWorksheet("Tổng hợp")
  ss.columns = [{ width: 58 }, ...groups.map(() => ({ width: 18 }))]
  ss.getCell("A1").value = `Báo cáo tuần Pancake — ${pages.join(" & ")}`
  ss.getCell("A1").font = { bold: true, size: 14 }
  ss.getCell("A2").value = `Từ ${formatDmy(report.from)} đến ${formatDmy(report.to)} · số liệu lấy lúc ${fetchedLabel(report.fetchedAtMs)}`
  ss.getCell("A2").font = { italic: true, color: { argb: "FF595959" } }

  let r = 4
  for (const period of report.periods) {
    const titleRow = ss.getRow(r)
    titleRow.getCell(1).value = period.title
    for (let c = 1; c <= groups.length + 1; c++) {
      titleRow.getCell(c).fill = BLOCK_FILL
      titleRow.getCell(c).font = { bold: true, size: 12 }
      titleRow.getCell(c).border = BORDER
    }
    r += 1

    const head = ss.getRow(r)
    ;["Chỉ số", ...groups].forEach((label, i) => {
      const cell = head.getCell(i + 1)
      cell.value = label
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = HEAD_FILL
      cell.border = BORDER
      cell.alignment = { horizontal: i === 0 ? "left" : "center" }
    })
    r += 1

    for (const metric of METRICS) {
      const row = ss.getRow(r)
      row.getCell(1).value = metric.label
      groups.forEach((_, i) => {
        const cell = row.getCell(i + 2)
        if ("field" in metric) {
          cell.value = sumOf(report, metric.field, pagesOf(i), period)
          cell.numFmt = "#,##0"
        } else {
          const [num, den] = metric.rate
          const d = sumOf(report, den, pagesOf(i), period)
          cell.value = d > 0 ? sumOf(report, num, pagesOf(i), period) / d : "-"
          cell.numFmt = "0.0%"
        }
        cell.alignment = { horizontal: "center" }
        if (i === groups.length - 1 && groups.length > 1) cell.font = { bold: true }
      })
      for (let c = 1; c <= groups.length + 1; c++) {
        row.getCell(c).border = BORDER
        if ("rate" in metric) row.getCell(c).fill = RATE_FILL
      }
      if ("rate" in metric) row.getCell(1).font = { bold: true }
      r += 1
    }
    r += 1
  }

  const notes = [
    "Ghi chú cách tính",
    "• Mes thu về = \"Hội thoại mới\" (new_inbox_count) trong Thống kê › Trang của Pancake.",
    "• Đơn chốt = \"Đơn chốt\" (order_count) của Pancake — khớp số đơn POS đã chốt trong ngày (không tính đơn hủy).",
    "• Đơn đủ 3 thẻ = đơn chốt tạo trong kỳ (theo ngày tạo đơn) mà hội thoại của đơn đang có ĐỒNG THỜI 3 thẻ Thủ công, Tiềm năng, Đã chốt.",
    "   Thẻ tính theo trạng thái lúc xuất báo cáo — Pancake không lưu ngày gắn thẻ của từng hội thoại.",
    "• Đơn chốt demo = tổng thẻ Hà Chốt + Duy Chốt + Thương Chốt + QChốt; Demo đã xem = tổng thẻ HDemo + DDemo + TDemo + QDemo.",
    "   Cả hai lấy từ thống kê \"Thẻ hội thoại\" của Pancake (số lần gắn − gỡ thẻ trong ngày), cùng nguồn với mục Demo trên dashboard.",
    "• Tỉ lệ chốt demo tổng team = đơn chốt demo / demo đã xem · Tỉ lệ chốt tổng = đơn chốt / mes thu về.",
    "• Mỗi tuần là 7 ngày liên tiếp tính từ ngày bắt đầu. Số từng ngày ở sheet \"Theo ngày\".",
    ...report.warnings.map((w) => `⚠ ${w}`),
  ]
  notes.forEach((text, i) => {
    const cell = ss.getCell(`A${r + i}`)
    cell.value = text
    cell.font = i === 0 ? { bold: true } : { color: { argb: "FF404040" } }
  })
  ss.views = [{ state: "normal", showGridLines: false }]

  // ---- Theo ngày
  const ds = wb.addWorksheet("Theo ngày")
  ds.columns = DAILY_COLUMNS.map(({ header, key, width }) => ({
    header,
    key,
    width,
  }))
  const sorted = [...report.daily].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || pages.indexOf(a.page) - pages.indexOf(b.page)
  )
  for (const row of sorted) {
    ds.addRow({ ...row, date: new Date(`${row.date}T00:00:00Z`) })
  }
  ds.getColumn("date").numFmt = "dd/mm/yyyy"
  for (const { key } of DAILY_COLUMNS.slice(2)) ds.getColumn(key).numFmt = "#,##0"
  ds.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = HEAD_FILL
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  })
  ds.views = [{ state: "frozen", ySplit: 1 }]
  ds.eachRow((row) => row.eachCell((cell) => (cell.border = BORDER)))

  return Buffer.from(await wb.xlsx.writeBuffer())
}
