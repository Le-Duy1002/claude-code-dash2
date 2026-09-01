# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Next.js dev server (http://localhost:3000)
npm run build          # production build — run before committing non-trivial changes
npm run lint           # eslint (next/core-web-vitals + next/typescript)
npx tsc --noEmit       # type-check only
npx prettier --write . # format (config in .prettierrc)
```

There is **no test framework** configured in this repo — do not assume `npm test` exists.

`npm run build` runs type-checking and lint as part of the build, so it is the
most complete pre-commit check.

## Stack

- **Next.js 15.5 App Router** + **React 19**. `AGENTS.md` warns that this Next.js
  may deviate from older training data; heed deprecation notices in build output.
- **Tailwind CSS v4** (CSS-first config; tokens live in `app/globals.css`, no
  `tailwind.config.js`).
- **`@base-ui/react`** is the headless primitive layer — **not Radix**. See the
  base-ui conventions section below.
- **Firebase** (`firebase` v12 modular SDK): auth, Firestore, Storage, Analytics.
- **sonner** for toasts (`<Toaster />` mounted in the root layout).
- **`@tanstack/react-table`**, **recharts**, **`@dnd-kit`** are available (used by
  the dashboard starter); feature tables so far are hand-rolled.
- **lucide-react** for icons.

Path alias: `@/*` → repo root (no `src/` directory).

Prettier: no semicolons, double quotes, 80-column, `trailingComma: es5`. The
tailwind plugin sorts class lists and is told about `cn` and `cva`.

## `@base-ui/react` conventions

Component wrappers in `components/ui/*` follow these patterns — match them when
adding primitives:

- Import namespaced: `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"`.
- **Polymorphism uses `render`, not `asChild`**: `<DialogTrigger render={<Button />}>Label</DialogTrigger>`
  (children still pass through into the rendered element).
- State for styling comes from `data-*` attributes: `data-open`, `data-closed`,
  `data-[side=...]`, `data-placeholder`, etc. (tw-animate-css supplies
  `animate-in` / `fade-in-0` / `zoom-in-95`).
- Change handlers are `(value, eventDetails) => void` / `(open, eventDetails) => void`.
- Dialog/Select/Menu compose as `Portal > Backdrop + Positioner/Popup`.
- Every wrapper sets a `data-slot` attribute and merges classes with `cn()`;
  variants use `cva` (see `components/ui/button.tsx`).

The `shadcn` CLI is a dependency, but registry components target Radix — anything
pulled from it must be ported to the base-ui API by hand.

## Architecture

### Route structure

- `app/layout.tsx` — root: fonts, `ThemeProvider` (next-themes; press **d** to
  toggle dark mode outside inputs), `AuthProvider`, `<Toaster />`, `FirebaseAnalytics`.
- `app/(app)/` — authenticated area. `(app)/layout.tsx` wraps children in
  `AuthGuard` + the sidebar/header shell (`AppSidebar`, `SiteHeader`).
  `SiteHeader` derives its title from the pathname.
- `app/login/` — public sign-in page (`LoginForm`).

### Auth flow

- `lib/firebase.ts` — Firebase singletons (`auth`, `db`, `storage`,
  `googleProvider`) initialized from `NEXT_PUBLIC_FIREBASE_*` env vars. Those are
  public config and are committed in `.env.production`. Analytics is loaded lazily
  and only in the browser via `getFirebaseAnalytics()`.
- `lib/auth.ts` — thin wrappers over Firebase auth calls plus
  `getAuthErrorMessage()` (maps error codes to Vietnamese copy).
- `lib/user.ts` — `ensureUserProfile(user)` upserts `users/{uid}` on every
  sign-in (call it after any successful auth in new flows).
- `components/auth-provider.tsx` — `useAuth()` → `{ user, loading }`, backed by
  `onAuthStateChanged`. This is the single source of the current user client-side.
- `components/auth-guard.tsx` — client redirect to `/login?redirect=<path>` when
  unauthenticated; shows a spinner while `loading`.

There is **no server-side auth / middleware** — gating is entirely client-side.

### Feature-folder convention (`features/<name>/`)

New product features live here, not scattered across `app/` and `components/`.
`features/tasks/` is the reference implementation:

```
features/tasks/
  types.ts                 # domain types + pure helpers + label/option/order constants
  services/*.ts            # ALL Firestore access for the feature
  components/*.tsx          # feature UI, every file "use client"
  index.ts                 # barrel — pages import from "@/features/tasks"
```

Rules that apply across features:

- **`types.ts`** holds the interfaces, the label maps
  (`TASK_STATUS_LABELS`), the `<Select>` option arrays, sort-order maps, and pure
  functions (`daysUntil`, `describeRemaining`, `buildCommentTree`,
  `formatDateTime`). No React, no Firebase.
- **`services/*.ts`** own Firestore. `subscribeToX(...)` takes callbacks and
  returns the `Unsubscribe` function; `create/update/deleteX` are async and use
  `serverTimestamp()`. Timestamps are read back through a `toMillis()` helper
  (`value instanceof Timestamp ? value.toMillis() : 0`). **Filtering and sorting
  are done client-side** (single-field `where` only) so no composite Firestore
  indexes are required.
- **Pages stay thin.** The route component (`app/(app)/dashboard/task/page.tsx`)
  subscribes in a `useEffect` keyed on `user`, holds filter + dialog state, runs
  the pure filter/sort helpers in `useMemo`, and passes data + callbacks down.
  Dialogs are controlled from the page (`open` / `onOpenChange` / the target
  entity), except the "add" dialog which owns its own trigger and open state.
- Forms share one presentational component (`task-form.tsx`) between the add and
  update dialogs; the dialog supplies an async `onSubmit` that persists, toasts,
  and closes.

### Firestore data model

- `tasks/{taskId}` — scoped per user by an `ownerUid` field; queries filter on it.
- `tasks/{taskId}/comments/{commentId}` — threaded comments. `parentId` is `null`
  for a root comment or the parent's id for a reply; `buildCommentTree()` turns
  the flat list into a tree and orphaned replies are promoted to roots. Deleting
  a comment cascades to its descendants in a single `writeBatch`.
- `documents/{driveFileId}` — a mirror of a shared Google Drive folder, one doc
  per Drive file (the Drive file id is the doc id), with a `source` field
  (`"drive"` = added straight to Drive, `"web"` = uploaded through the app).
  Clients only subscribe; all writes go through server routes on the Node
  runtime:
  - `POST /api/drive/sync` — reads the folder with a **service account**
    (`lib/google-drive.ts` `listFolderFiles`) and upserts/deletes via the Admin
    SDK. Triggered by the client on page open, a manual button, an upload, and
    `.github/workflows/drive-sync.yml` on a cron. Accepts `CRON_SECRET` or a
    Firebase ID token.
  - `POST /api/documents` / `PATCH|DELETE /api/documents/[id]` — upload, rename,
    delete. These use **OAuth as the folder owner** (`GOOGLE_OAUTH_*`, scope
    `drive.file`) because a service account has no storage quota and cannot own
    files in a non-Workspace Drive. The `drive.file` scope only permits writing
    into a folder the app itself created, so the library folder is created by
    `scripts/create-drive-folder.mjs` (not a pre-existing folder) and then
    shared with the service account for the read side. Rename/delete only touch
    Drive for `source === "web"` docs; `source === "drive"` docs are
    edit-description-only. Upload is capped at ~4 MB (Vercel request-body limit).

**Firestore and Storage security rules are not in this repo** — both are managed
in the Firebase console. `documents` should be client-read-only
(`allow write: if false`); the server writes with Admin credentials. When you
add a collection or a Storage path, the matching rules must be added there
separately or requests fail with `permission-denied`.

### Server env

API routes under `app/api/` run on the Node runtime and read secrets from env
(see `.env.example`): `FIREBASE_ADMIN_*` (Admin SDK key), `GOOGLE_DRIVE_FOLDER_ID`
(+ optional `GOOGLE_DRIVE_*` to use a separate service account for reads),
`GOOGLE_OAUTH_*` (folder-owner OAuth for Drive writes — get the refresh token
with `scripts/get-refresh-token.mjs`), and `CRON_SECRET` (bearer token the sync
route also accepts in place of a Firebase ID token). `next.config.ts` lists
`firebase-admin` and `googleapis` in `serverExternalPackages`. The Firebase
Admin singleton is lazy (`adminAuth()` / `adminDb()` are functions) so importing
it never throws at build time.

### Dashboard starter (not product code)

`app/(app)/dashboard/page.tsx` with `data.json`, plus `components/data-table.tsx`,
`section-cards.tsx`, `chart-area-interactive.tsx`, and the `nav-*.tsx` files are
the shadcn dashboard template. Treat them as pattern references, not as
maintained features.

## Language

User-facing copy is **Vietnamese** (toasts, labels, error messages, nav). Match
that when adding UI. Code, comments, and identifiers are English.
