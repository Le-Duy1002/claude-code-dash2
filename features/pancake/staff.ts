/**
 * The CS staff being evaluated, mapped to their Pancake identities.
 *
 * Every attribution keys off these:
 *   - orders   -> POS `assigning_seller_id`  (UUID)
 *   - messages -> `from.uid`                  (UUID)
 *   - "seen" activity -> `recent_seen_users[].fb_id`  (Facebook id)
 *
 * Confirmed 04/09/2026:
 *   Hà      = eb469d27… (ha218433@gmail.com) — a regular CS staff member
 *   Thương  = d3ba491c… (nguyenthithuongcx@…) + 2c4a7cee… (…qh1@…, old account)
 * "Hoàng" (hoangthang0m@gmail.com) is the manager and is NOT evaluated.
 */

export type StaffMember = {
  /** stable key used in the UI and API */
  key: string
  name: string
  /** every Pancake user UUID this person has used (old + current accounts) */
  uids: string[]
  /** Facebook ids of those accounts (for `recent_seen_users` activity) */
  fbIds: string[]
  /**
   * True for the account whose API token this app uses. Its "seen" markers are
   * unreliable (API access can register as a view), so `recent_seen_users` is
   * ignored for this person — only messages and orders count as their activity.
   */
  tokenOwner?: boolean
  unconfirmed?: boolean
}

export const STAFF: StaffMember[] = [
  {
    key: "duy",
    name: "Duy",
    uids: ["5b89af60-e368-4d28-a67e-ba2e825263b2"],
    fbIds: ["482725535624654"],
    tokenOwner: true, // PANCAKE_INBOX_ACCESS_TOKEN belongs to this account
  },
  {
    key: "quyen",
    name: "Quyến",
    uids: ["c8a2ea27-2c6e-4439-8cad-0fad57e46dbf"],
    fbIds: ["1523372689796559"],
  },
  {
    key: "thuong",
    name: "Thương",
    uids: [
      "d3ba491c-6fe0-4185-9d2d-528f0da9dfa2", // active — nguyenthithuongcx@gmail.com
      "2c4a7cee-cfad-4fe4-a216-b72cd9775310", // old account (deactivated)
    ],
    fbIds: ["112909336082532"],
  },
  {
    key: "ha",
    name: "Hà",
    uids: ["eb469d27-c16d-4902-bfa0-e418120fe82c"], // ha218433@gmail.com
    fbIds: ["132443751418983"],
  },
]

const BY_UID = new Map<string, StaffMember>()
const BY_FBID = new Map<string, StaffMember>()
for (const member of STAFF) {
  for (const uid of member.uids) BY_UID.set(uid, member)
  for (const fbId of member.fbIds) BY_FBID.set(fbId, member)
}

export function staffByUid(uid: string | null | undefined): StaffMember | null {
  if (!uid) return null
  return BY_UID.get(uid) ?? null
}

export function staffByFbId(
  fbId: string | null | undefined
): StaffMember | null {
  if (!fbId) return null
  return BY_FBID.get(fbId) ?? null
}

/** Like {@link staffByFbId} but excludes the token-owner account (its "seen"
 * markers are noise). */
export function seenStaffByFbId(
  fbId: string | null | undefined
): StaffMember | null {
  const member = staffByFbId(fbId)
  return member && !member.tokenOwner ? member : null
}

export function isTrackedStaff(uid: string | null | undefined): boolean {
  return Boolean(uid && BY_UID.has(uid))
}
