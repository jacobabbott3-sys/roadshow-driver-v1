# Architecture and security boundaries

## Frontend

React 19/TypeScript/Vite serves a browser client. `src/App.tsx` lazily loads app
routes; public Auth screens and protected driver/admin routes share existing
recovery boundaries. `AppShell` owns desktop/mobile navigation. `AuthContext`
loads Supabase session/profile state and appearance; protected routes check role
and activity. Route guards improve UX but do not replace database authorization.

`src/lib/driverData.ts`, `adminData.ts`, `availabilityData.ts`, and communication
helpers implement data access. RPCs handle multi-table writes, publication,
availability ordering, assignments, and atomic show/signing saves. Mutation hooks
and page states surface failures; the top-level error boundary prevents blank
screens. `calendarDate.ts` handles local calendar keys/date-only parsing.

## Supabase

`src/lib/supabase.ts` creates the client from `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. These values are browser-visible; they are not elevated
credentials. Sessions/passwords are owned by Supabase Auth. Never put a service
role, database password, or private notification secret in a `VITE_` variable.

The schema includes profiles, shows/signings, contracts, driver assignments,
checklist templates/progress/review history, publication batches/items/responses,
external-assignee display names, resources, chats, notifications, and toolbags.
Migrations are additive history, not a script to replay against an existing DB.

`is_active_user()`, `is_admin()`, `is_contract_driver()`, and `is_chat_member()`
support RLS/RPC authorization. Beta 5A reliability enforces activity and protects
the final admin. Security-definer RPCs require careful review of role checks,
input validation, grants, and search paths; do not treat the definer flag as
permission to expose privileged data. Inspect the effective current policies,
including later replacements, before changing security behavior.

Publication/assignment writes validate active roles and preserve atomic state.
Response timestamps are server-generated. Draft-work privacy is enforced by
backend reads/policies, not just React filtering. External names have no Auth or
profile relationship. Legacy availability remains intentionally retained.

## Private storage and uploads

Buckets `contract-files`, `roadshow-photos`, and `resources` stay private.
Contract photo keys use `<user-id>/<contract-id>/<unique-file>`. The October 1
migration permits active assigned users/admins to insert metadata/upload, verifies
`uploaded_by = auth.uid()`, permits assigned teammates/admins to read stored
photos, and permits active uploaders/admins to delete stored objects. Read the SQL
for exact checks; uploader deletion is not the same as team-wide deletion.

`imageUpload.ts` validates/prepares supported files, normalizes missing MIME
metadata, scales large images, and removes an object if its metadata save fails.
Resource `file_type` is `image` or `pdf`; older rows get a path-based type backfill.
Red Folder signs view/download links with a one-hour expiry. Signed links are
temporary bearer URLs: do not log/store them in durable context or weaken bucket
policies to make them work. URL/row access tests require real beta accounts; SQL
regex assertions alone do not prove RLS behavior.

`PdfViewer.tsx` is dynamically imported only when a user opens a PDF. React-PDF
10.5.0/PDF.js 5.4.296 render one page at a time with a worker bundled by Vite;
documents are not sent to a third-party viewer/CDN. The reader signs fresh
private URLs on open/retry, supports selectable text, page navigation, and zoom,
and restores focus/scrolling when closed. No schema or RLS changes are required
for this viewer; the October 1 resource migration is still a prerequisite.
`npm ci` runs `scripts/copy-pdf-assets.mjs` after install to generate ignored
`public/pdfjs-assets/` from the locked dependency. Vite serves/copies those CMaps,
fonts, and WebAssembly image decoders locally, including JPEG2000 scan support.

## Notifications

In-app rows and badges work separately from browser push. The `web-push` Edge
Function receives notification INSERT webhooks authenticated by `WEBHOOK_SECRET`.
Supabase stores VAPID private/public keys and subject; only the VAPID public key
may enter the client. Cron creates due-work notifications. Setup is environment
specific and remains a deliberate dashboard/deployment action; CI does not
deploy the function, set secrets, or apply SQL.

## Hosting and development

Vercel stays connected to GitHub: feature/PR previews, shared `beta`, public
`main`. `vercel.json` rewrites routes to the SPA. `vite.config.ts` derives labels
from explicit release variables or branch fallbacks. Feature branches need
explicit beta labels; Public 4 remains until approved promotion.

Codespaces is the private hands-on environment; Codex cloud has a separate
toolchain/setup lifecycle and proposes PRs. CI checks tests/build/lint with no
live Supabase or deployment credentials. Initial migrations run through the
intended Supabase dashboard after backup, actual-state verification, and review.
No local Supabase stack or automatic database deployment is introduced. The web
client has no offline synchronization subsystem; the personal iPhone build adds
the bounded read-only cache described below. See [workflow](development-workflow.md).

Sources: source modules above, `supabase/migrations/`, `supabase/functions/web-push/index.ts`,
`supabase/tests/`, `vite.config.ts`, and `vercel.json`.

## Local personal iPhone package

`capacitor.config.ts` bundles `dist-ios` for the personal Public 5 app. The native
build/runtime origin guard selects the existing public Supabase project and
rejects beta/missing configuration. Startup gates Auth before it mounts. Native
recovery uses the public website in the default browser, scene pause/resume
controls token refresh, and device push is unavailable. Native profile verification
blocks protected content while pending or failed; a previously inactive account
remains blocked on network failure. Private photo/PDF
services retain their authorization; ordinary web builds are unchanged.
See [personal build instructions](ios-personal-build.md) for signing and pending
physical-device acceptance. This is not a public deployment or backend change.

### Personal iPhone native presentation

The isolated personal build retains one Capacitor bridge/web view under
`NativeShellContainer`. React remains authoritative for auth, role, route and
unread counts. `RoadshowShell` accepts only versioned state with a connection ID
and increasing sequence; native actions map to fixed routes in React. No account
identifiers, credentials or business content enter presentation messages.
Scene deactivation clears native state. React's existing profile refresh signals
a new connection only after verification completes after foreground or active-scene recovery; failed connections retain
web navigation. Dialog owners share a modal set, and the native container reports
measured insets. `useUnreadBadges` is the single polling/realtime owner.
Device appearance/haptics persist in UserDefaults with a web first-paint cache;
account appearance application is skipped only inside the native app.

Native document-navigation/process-termination callbacks invalidate chrome before
forwarding to Capacitor; all other optional delegate selectors forward unchanged.
React native Back traverses actual owned history entries, preserving query/hash/
state and handling POP/REPLACE, with a parent fallback for cold routes.

### Personal widgets and checklist Live Activity

`WidgetBridge` is mounted inside the existing shell provider and outside routed
Suspense. Verified auth plus native readiness gates `WidgetController`; its
generation checks discard stale reads across account/lifecycle changes. A separate
plugin handles snapshots and ActivityKit, leaving navigation protocol content-free.
Minimal snapshots use App Group atomic file storage with expiry; no credentials
are shared. Owner identity is kept only in the app's private preferences to clear
prior-account content. The extension does not make network requests. Explicit
assignment ownership includes primary and linked drivers; admin read visibility
alone never qualifies. Deep links accept only a contract UUID and optional
checklist tab, and route only after profile verification. Existing RLS and
checklist RPC permissions remain authoritative and unchanged.

### Personal iPhone read-only offline storage

`src/native/offline/` owns account-scoped hydration and coalesced live reads. A
strict route whitelist may render saved presentations without mounting the general
protected Outlet; existing pages share their presentation with these reads. A local
persisted-session owner is used only to identify saved copies before SDK token
refresh completes, never to construct an online Session/Profile or grant a role.

`ios/App/App/Offline/` stores versioned snapshots and optional file envelopes in
private Application Support, excluded from backups and protected until first
unlock. File contents are bounded, MIME checked and atomically replaced. Signed
URLs are not persisted. Generation checks reject stale account work. Supabase JS
continues to own session refresh; only its existing short-lived access token and
public client key are mirrored into app-private, this-device-only Keychain storage.
The native background reader uses a fixed Public 5 origin, GET requests, active
profile verification and paginated explicit ownership reads. It never refreshes a
token or writes to Supabase. Expiry/cancellation keeps the last complete snapshot.

Offline lease: seven days after a successful active-profile check, with clock
rollback requiring online verification. Offline access cannot observe immediate
server-side revocation. Optional resources refresh in foreground; without a reliable
object validator they re-download while preserving an existing file on failure.
Quota counts actual disk usage, including envelope overhead. No schema, RLS,
storage bucket, auth setting or production website changes are involved.

### Native saved-read startup recovery

The saved-data coordinator coalesces same-owner hydration calls until the private
native read completes. A native scene-activation event retries a failed hydration
without awaiting online profile verification. This covers a bridge call rejected
while UIApplication is not active. Successful empty reads remain empty; retries
do not invent data, renew the lease, or grant mutation access. Owner/generation,
seven-day lease, and verified-live mutation checks remain in place.

### Native foreground refresh presentation

Tab navigation does not restart the full owned snapshot download. Launch/foreground
verification, the five-minute foreground timer, saved-change events, and Settings
Status's manual action remain refresh triggers. Administrator contract query results
may survive page remounts in the coordinator's memory only, keyed by query and
parameters. They are exposed only for a matching owner with a freshly verified
active administrator profile, remain read-only during a new query, and are discarded
on owner changes, signout, and known inactivity. Generation checks reject late
old-account writes. These broader results never enter the private disk snapshot;
unverified/offline access remains limited to the existing owned-data allowlist.

### Native edge-back gesture

A UIKit screen-edge recognizer on the retained bridge view sends `swipeBack` through
the existing shell connection. React advertises an optional `canSwipeBack` flag
(default-denied by older messages), excluding tab roots and active modal/draft
blockers. The gesture captures connection/sequence at start and rechecks both at
completion; React also checks the current sequence before traversing its existing
route history. Cancelled, reversed and predominantly vertical drags do nothing.
PhotoCapture registers an owner-scoped blocker while an unsent photo exists;
discard, successful upload or unmount removes it. No screenshots or extra WebViews
are retained, and the existing account/role gate remains authoritative.

### Personal Watch snapshot transport

`WatchPhone` activates WatchConnectivity at phone startup and observes native
offline-store configure/replace/clear notifications (including the native background
reader's replacement). It projects only the explicit owner's saved assignments into
`WatchSnapshot`: next nonfinal work by service/setup date, title, venue, formatted
date, checklist counts and original fetched time. No Supabase token, credential,
private URL, photo, checklist note, pay or full contract crosses this boundary.
Authentication and source validation remain on iPhone. Invalid/expired sources
produce a clearing envelope.

Application context retains only the latest envelope; an immediate message also
delivers it when reachable. Each phone update has a persisted monotonic revision.
The Watch rejects older/equal revisions, including after account-switch/clear
envelopes and restart. A separate persisted revision watermark prevents an old disk
copy being reloaded after a failed newer write. The Watch's private snapshot file
is protected until first unlock and its directory excluded from backup. Original
fetched time is preserved across resends, stale at 30 minutes and expired by six
hours (also bounded by the phone's account lease). Expired data is hidden on the
Watch's periodic timeline. No backend access or new capability entitlement is added.

The `RoadshowWatch` target is embedded in the personal iPhone app, requires watchOS
11+, and depends on the iPhone. Personal team selection remains local to each
checkout. Run `node scripts/test-watch-native.mjs` with the selected Xcode developer
directory for synthetic transport/model checks.

### Isolated driver agreement compatibility candidate (October 14, 2026)

The driver review port uses only `get_contract_agreement(target_contract)` and
`accept_contract_agreement(target_contract, expected_version, acceptance_role,
legal_name)`. Source contracts were inspected at beta commit
`a02f5521b703931b3dfa6747e6bd1d79af3d5772`, in the agreement storage and signing
migration definitions. Those definitions are evidence for the client interface,
not proof of the hosted database's effective state.

The review getter can issue an agreement and is mounted only from verified live
Contract review, never a native saved/offline presentation or background reader.
The port introduces no acceptance-gate/revision RPC, archived-checklist query,
current-agreement column query, schema change or permission change. It replaces
the driver's old signing RPC rather than falling back to it on error. Existing
admin signature mutations and checklist submission remain outside this candidate.
