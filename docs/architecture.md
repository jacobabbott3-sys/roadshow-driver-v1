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
No local Supabase stack, offline synchronization subsystem, or automatic database
deployment is introduced. See [workflow](development-workflow.md).

Sources: source modules above, `supabase/migrations/`, `supabase/functions/web-push/index.ts`,
`supabase/tests/`, `vite.config.ts`, and `vercel.json`.
