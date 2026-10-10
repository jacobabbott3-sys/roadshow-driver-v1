# Roadshow Driver: free personal iPhone build

## Intent and approval boundary

Jacob wants Roadshow Driver on his iPhone 17 Pro running iOS 27.2, at zero cost.
He approved the Capacitor approach and accepts rebuilding/reinstalling after
Personal Team provisioning expires after seven days. The initial scope reuses
existing screens, private photos, PDFs, and in-app notifications. No paid
membership, TestFlight, offline synchronization, or native remote push.

Jacob subsequently selected the public app with his real account and live data.
This replaces the earlier beta-only proposal. Package Public 5 and connect to
its existing production backend; this does not authorize backend administration
or synthetic production writes during development.

This written spec records the approved conversational design. Written-spec
review and then implementation-plan review remain required before product edits.
Apple sign-in, legal acceptance, signing and device trust are user-controlled.

## Isolation and baseline

The independent checkout is `roadshow-ios-personal`. It was initially based on
beta `c439a0fe43b202667436decd6b17861e5a5bd1e0`. The selected implementation base
is now Public 5, main `950a2628a517ce067b0167382e5aafe4fd02b9ea`, verified through
GitHub on October 10. Carry the design onto a new local feature branch from that
exact commit before implementation; do not merge beta into it. It was cloned locally
without shared hardlinks because the managed worktree tool is unavailable in
this execution context. No old checkout or worktree is modified.

The hosted Public 5 release and production schema/configuration remain unchanged.
The native app uses existing production project `myraoovepjwhkafzdppq` and normal
account permissions. Jacob's ordinary app actions will affect live records.
No push, merge, Vercel publication, agent-generated test records, invitations or
migrations are part of this implementation. Feature PR12 and QA fix `12cc178...`
belong to other tasks and are not dependencies of this public-version package.
Do not resume, copy or integrate them. Device readiness still requires testing.

## Architecture

Use Capacitor 8, with an exact supported patch version verified before install,
and Swift Package Manager. Generate an iOS target with bundled Vite `dist`
assets; do not point `server.url` at a hosted website. Keep React/TypeScript,
BrowserRouter, Supabase client, role guards and database authorization. Use a
separate native build command/output so ordinary web release builds retain their
current behavior. Proposed display name: Roadshow Driver; proposed bundle ID:
`com.jacobabbott.roadshowdriver`, subject only to Personal Team availability.

Native configuration must accept only the exact HTTPS production Supabase origin
`https://myraoovepjwhkafzdppq.supabase.co`. Reject missing configuration, other
origins, non-public release channel, and elevated keys before bundling/syncing.
Repeat the origin check at native runtime before constructing the Supabase
client; render an actionable configuration error before making backend requests.
Use only the production browser-safe client key supplied through an ignored local
environment or environment variables; never collect or embed privileged keys.
Native sync must use freshly validated native assets, not a stale web `dist`.

## Authentication and navigation

Retain email/password login and the existing remember-me choice. Test session
persistence across cold starts and background/resume, refresh after suspension,
sign-out and inactive-profile enforcement. Add a native lifecycle adapter only
as needed for foreground refresh; keep browser behavior unchanged.

For this first build, password recovery and invitations use the stable HTTPS
public website in the system browser. The native recovery action opens
`https://www.roadshowdriver.com/forgot-password`; users return to native login
after completing recovery. Never construct email callbacks from
`capacitor://localhost`. Do not imply that Safari and WKWebView share sessions.
Native custom-scheme/universal-link Auth callbacks are deferred. Verify the
existing public recovery flow without changing Supabase Auth settings or sending
recovery emails without user authorization. External links open outside the app; internal routes remain in the
bundled app. Test initial load, nested route reload and route guard behavior.

## Photos, PDFs and notifications

Retain private storage buckets, metadata cleanup, upload limits, signed URLs and
the existing file picker. Test photo-library and camera choices on the device,
including HEIC conversion/support, cancellation and denied permissions. Add
native permission descriptions only for actual capabilities used. Do not weaken
storage policies or make buckets public to resolve native behavior.

Bundle the existing PDF.js worker, CMaps, fonts and WASM assets. Verify private
PDF fetches, page/zoom controls, scanned documents and fresh signed links. If
WKWebView cannot preserve the existing download behavior, use a small native
file/share adapter, temporary storage and cleanup; do not expose signed URLs in
logs or leave sensitive exported files in indefinite app caches.

Retain in-app notification rows/badges. Explicitly disable the browser device-push
action in native mode with clear explanatory text. No APNs entitlement, token
registration, push backend changes or promises of alerts while the app is closed.

## Layout and connectivity

Scope native adjustments to native mode. Verify status bar/notch, home indicator,
keyboard resize, focused form fields, bottom navigation, modals, orientation and
PDF scrolling. Reuse existing branding for the app icon. Network-backed work
continues to require connectivity; bundled screens are not offline support.
Connection failures must stay recoverable and must not imply successful writes.

## Toolchain and installation

Inspection: macOS 27.2 (26B5101f), arm64, 218 GiB available; Node 24.19.0 and npm
11.17.0. Repository requires Node 24 and npm 11.5.2. Align npm locally rather than
changing unrelated global tools. No full Xcode or simulator tool is available.

Apple's official system-requirements page lists Xcode 27.2 beta 2 with the iOS
27.2 SDK and macOS 26.6-or-later support. Use that official matching release,
subject to verification on the signed-in download page, rather than assuming
Capacitor's minimum Xcode 26 supports this phone. Download is currently blocked
by Apple sign-in. The user handles sign-in and any agreement prompts. Install
only necessary iOS support. Do not silently enable automatic signing, create
certificates or enroll in paid programs.

Once the user completes signing prerequisites, use Personal Team device builds.
Keep the same bundle identifier for reinstalls and document the seven-day
rebuild/reinstall procedure; do not instruct deleting the app as a normal step.

## Verification and completion evidence

Run repository unit/UI tests, build and lint with no new warnings. Add meaningful
tests for native environment rejection, browser recovery routing and native push
gating. Verify both native assets and unchanged ordinary web build behavior.
Build the generated iOS target for simulator without signing before user-assisted
device signing where tooling permits. A generated project or successful web
build is not evidence of a working native app.

Record separately: source checks; unsigned iOS compilation; simulator launch;
physical-device installation; live public-app acceptance. Live acceptance requires
verified Public 5 assets, matching production client configuration and the user's
account interaction. Use mocks/fixtures for mutation tests; do not write test data
to production. Report all
unperformed device, Auth/storage and workflow tests as pending.

## Sources

- Repository AGENTS.md, package.json, architecture/development workflow/current
  state/decisions; App.tsx, AuthContext.tsx, supabase.ts, pushNotifications.ts,
  PdfViewer.tsx, imageUpload.ts and styles.css.
- https://developer.apple.com/xcode/system-requirements
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://capacitorjs.com/docs/getting-started/environment-setup

Spec self-review: scope is limited to personal-device packaging and adapters;
no backend administration/release changes or native push are introduced. The
public code and live-data selection supersedes the original beta proposal.
Toolchain, signing and acceptance dependencies are explicitly separated.
