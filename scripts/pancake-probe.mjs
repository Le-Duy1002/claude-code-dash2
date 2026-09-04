// Probe the Pancake APIs to learn the data shapes before building the
// integration. Read-only. Run:
//   node --env-file=.env.local scripts/pancake-probe.mjs
//
// It hits a handful of endpoints on the POS API (per shop) and the pages.fm
// inbox API (per page) and prints a trimmed sample of each response.
// Paste the output back to continue the build.

const POS_BASE = process.env.PANCAKE_POS_API_BASE ?? "https://pos.pages.fm/api/v1"
const INBOX_BASE =
  process.env.PANCAKE_INBOX_API_BASE ?? "https://pages.fm/api/v1"
const INBOX_TOKEN = process.env.PANCAKE_INBOX_ACCESS_TOKEN

const shops = [1, 2, 3]
  .map((n) => ({
    name: process.env[`PANCAKE_POS_${n}_NAME`],
    apiKey: process.env[`PANCAKE_POS_${n}_API_KEY`],
    shopId: process.env[`PANCAKE_POS_${n}_SHOP_ID`],
    fbPageId: process.env[`PANCAKE_POS_${n}_FB_PAGE_ID`],
  }))
  .filter((s) => s.apiKey)

if (!shops.length) {
  console.error("No PANCAKE_POS_*_API_KEY found in env. Fill .env.local first.")
  process.exit(1)
}

// Recursively shorten a value so the console stays readable.
function trim(v) {
  if (typeof v === "string") return v.length > 160 ? v.slice(0, 160) + "…" : v
  if (Array.isArray(v)) {
    const head = v.slice(0, 2).map(trim)
    return v.length > 2 ? [...head, `…(+${v.length - 2} more)`] : head
  }
  if (v && typeof v === "object") {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = trim(val)
    return out
  }
  return v
}

const SECRET = /token|key|secret/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function hit(label, base, path, params = {}) {
  await sleep(500)
  const url = new URL(base.replace(/\/$/, "") + path)
  for (const [k, val] of Object.entries(params)) {
    if (val == null || val === "") continue
    url.searchParams.set(k, val)
  }
  let shown = url.toString()
  for (const [k, val] of Object.entries(params)) {
    if (SECRET.test(k) && val) shown = shown.replace(encodeURIComponent(val), "***")
  }
  process.stdout.write(`\n▶ ${label}\n  ${shown}\n`)
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = text.slice(0, 300)
    }
    console.log(`  ${res.status} ${res.statusText}`)
    console.log("  " + JSON.stringify(trim(body), null, 2).split("\n").join("\n  "))
    return body
  } catch (e) {
    console.log(`  NETWORK ERROR: ${e.message}`)
    return null
  }
}

// ---------------------------------------------------------------- POS
for (const s of shops) {
  console.log("\n" + "=".repeat(70))
  console.log(`POS SHOP: ${s.name}  shop_id=${s.shopId}  fb_page_id=${s.fbPageId}`)
  console.log("=".repeat(70))
  const key = { api_key: s.apiKey }

  await hit("shop users / staff", POS_BASE, `/shops/${s.shopId}/users`, key)
  await hit("orders (2)", POS_BASE, `/shops/${s.shopId}/orders`, {
    ...key,
    page_number: "1",
    page_size: "2",
  })
  // does orders accept a date window + tag filter?
  await hit("orders since yesterday", POS_BASE, `/shops/${s.shopId}/orders`, {
    ...key,
    page_number: "1",
    page_size: "1",
    startDateTime: new Date(Date.now() - 864e5).toISOString(),
    endDateTime: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------- INBOX
if (!INBOX_TOKEN) {
  console.log("\n(no PANCAKE_INBOX_ACCESS_TOKEN — skipping pages.fm inbox probe)")
} else {
  console.log("\n" + "#".repeat(70))
  console.log("PAGES.FM INBOX API")
  console.log("#".repeat(70))

  const pagesResp = await hit("list pages", INBOX_BASE, "/pages", {
    access_token: INBOX_TOKEN,
  })
  const cat = pagesResp?.categorized ?? {}
  const allPages = [
    ...(cat.activated ?? []),
    ...(cat.hidden ?? []),
    ...(cat.inactivated ?? []),
    ...(cat.nopermission ?? []),
    ...(Array.isArray(pagesResp?.pages) ? pagesResp.pages : []),
  ]
  console.log("\n--- ALL PAGES this token can see ---")
  for (const p of allPages) {
    console.log(
      `  id=${p.id}  platform=${p.platform}  shop_id=${p.shop_id}  role=${p.role_in_page}  name=${p.name}`
    )
  }
  // full dump of the target page object to spot tags / page_access_token fields
  const sample = allPages.find((p) => String(p.id) === String(shops[0]?.fbPageId))
  if (sample) {
    console.log("\n--- FULL page object keys ---")
    console.log("  " + Object.keys(sample).sort().join(", "))
    console.log("  tags field: " + JSON.stringify(trim(sample.tags)))
  }

  // Try each target FB page id, whether or not it showed in the list.
  const targets = shops
    .filter((s) => s.fbPageId)
    .map((s) => ({ id: s.fbPageId, name: s.name }))
  // also try any page from the list whose name contains our brand words
  for (const p of allPages) {
    if (/tarot|huyền học|tận/i.test(p.name ?? "") && !targets.some((t) => t.id === String(p.id))) {
      targets.push({ id: String(p.id), name: p.name + " (from list)" })
    }
  }

  for (const t of targets) {
    console.log("\n" + "-".repeat(60))
    console.log(`INBOX PAGE: ${t.name}  id=${t.id}`)
    console.log("-".repeat(60))

    const tok = { access_token: INBOX_TOKEN }

    // 1. page_access_token via GET generate endpoint
    const genR = await hit(
      "generate_page_access_token (GET)",
      INBOX_BASE,
      `/pages/${t.id}/generate_page_access_token`,
      tok
    )
    const pat =
      genR?.page_access_token ?? genR?.data?.page_access_token ?? null

    const auth = pat ? { page_access_token: pat } : tok

    // 2. tags — try a few shapes
    await hit("tags A", INBOX_BASE, `/pages/${t.id}/tags`, auth)
    await hit("tags B", INBOX_BASE, `/pages/${t.id}/tags/count`, auth)
    await hit("settings (has tags?)", INBOX_BASE, `/pages/${t.id}/settings`, auth)

    // 3. conversations — grab one with a non-empty tag + one that is assigned
    const convs = await hit(
      "conversations",
      INBOX_BASE,
      `/pages/${t.id}/conversations`,
      { ...auth, page_number: "1" }
    )
    const rows = convs?.conversations ?? convs?.data ?? []
    const first = rows.find((c) => c?.tags?.length) ?? rows[0] ?? null
    if (first) {
      const convId = first.id
      const psid = first.from_psid ?? first.from?.id
      const custUuid = first.customers?.[0]?.id
      // messages: try customer_id = uuid, then psid, then none
      await hit("messages (customer_id=uuid)", INBOX_BASE, `/pages/${t.id}/conversations/${convId}/messages`, { ...auth, customer_id: custUuid })
      await hit("messages (customer_id=psid)", INBOX_BASE, `/pages/${t.id}/conversations/${convId}/messages`, { ...auth, customer_id: psid })
      await hit("messages (no customer_id)", INBOX_BASE, `/pages/${t.id}/conversations/${convId}/messages`, auth)
    }
  }
}

console.log("\nDone.\n")
