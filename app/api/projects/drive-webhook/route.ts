import {
  isValidWebhookToken,
  markWebhookSync,
  reconcileAllProjectDocuments,
  webhookRecentlySynced,
} from "@/lib/project-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Google Drive push notification for the "Dự án" change feed (UC-DOC-02).
 * Fires on any change in the watched subtree; we debounce, then reconcile
 * every project's document mirror. Always answers fast with 200 so Drive
 * doesn't retry / disable the channel.
 */
export async function POST(request: Request) {
  const token = request.headers.get("x-goog-channel-token")
  if (!isValidWebhookToken(token)) {
    // unknown caller — acknowledge without doing anything
    return new Response(null, { status: 202 })
  }

  const state = request.headers.get("x-goog-resource-state")
  // the initial "sync" handshake carries no real change
  if (state === "sync") {
    return new Response(null, { status: 200 })
  }

  try {
    if (await webhookRecentlySynced()) {
      return new Response(null, { status: 200 })
    }
    await markWebhookSync()
    await reconcileAllProjectDocuments()
  } catch {
    // swallow — the fallback cron will catch up
  }
  return new Response(null, { status: 200 })
}
