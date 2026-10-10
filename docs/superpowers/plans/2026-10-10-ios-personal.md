# Public 5 Personal iPhone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Install a free, personally signed Roadshow Driver app on Jacob's iPhone 17 Pro (iOS 27.2), using Public 5 and his real account/live data.

**Architecture:** Bundle the existing Vite UI in Capacitor; isolate native build configuration and adapters from the web release. Validate the production backend at build and native startup. Retain Supabase authorization and private storage.

**Tech Stack:** React 19, TypeScript, Vite 7, Supabase, Capacitor 8 with Swift Package Manager; Node 24 and npm 11.5.2; Xcode 27.2 beta 2 (27B5028f).

**Spec:** [Approved design](../specs/2026-10-10-ios-personal-design.md). Jacob approved this written Public 5 design on October 10, 2026.

## Global constraints

- Work only in this isolated checkout on `feat/ios-personal-public`, based on verified main `950a2628a517ce067b0167382e5aafe4fd02b9ea`.
- Display name `Roadshow Driver`; bundle ID `com.jacobabbott.roadshowdriver`, subject to Personal Team availability.
- Native build: Public 5, exact backend `https://myraoovepjwhkafzdppq.supabase.co`, browser-safe client key only.
- No push, merge, deployment, database/schema/configuration mutations or production test records. Beta/PR12/unpublished QA work is excluded.
- No paid services, TestFlight, offline sync, APNs or background remote notifications.
- User controls Apple sign-in, agreements, signing/certificate creation and device trust. Never silently enable automatic signing.
- Run repository checks; preserve three-warning lint baseline. Native tests must mock live services.
- Keep generated web assets, environment files, native build output, signing identities and user-specific Xcode state out of Git.

## Review focus

1. Stale assets: native sync must not copy an earlier web build targeting another backend (Task 1).
2. Malformed configuration: deceptive host suffixes, embedded URL credentials and elevated keys must be rejected before network access (Task 1).
3. Lost session: cold launch, process termination and background/resume must respect remember-me and active-account checks (Task 2).
4. External navigation: recovery and downloads must not replace the WKWebView with an external page or imply shared Safari sessions (Tasks 2–3).
5. Phone-specific content: HEIC photos, expired PDF links and keyboard/notch overlap must fail recoverably or display correctly (Task 3).

### Task 1: Guarded native package

**Files:** Create `capacitor.config.ts`, `scripts/build-ios.mjs`, `src/lib/nativeConfig.ts`, `src/lib/nativeConfig.test.ts`, `src/components/NativeConfigurationGate.tsx`, `src/components/NativeConfigurationGate.test.tsx`, generated `ios/`; modify `package.json`, `package-lock.json`, `.gitignore`, `vite.config.ts`, `src/main.tsx`, `src/lib/supabase.ts`, `src/vite-env.d.ts` (verify declaration path first).

**Interfaces:** `validateNativeConfig(config: { url: string; key: string; channel: string; version: string }): string | null` returns a sanitized error or null. `isNativeApp(): boolean` in `src/lib/nativePlatform.ts` uses Capacitor platform detection. `npm run ios:sync` validates, builds fresh assets to `dist-ios`, then syncs the generated iOS project; ordinary `npm run build` retains its existing output/behavior.

- [x] Align npm locally, verify exact compatible Capacitor 8 package versions against official docs, and install pinned dependencies/lockfile. Prefer the current 8.x patch with Xcode 27 support and SPM; no global npm modification.
- [x] Run existing unit/UI tests, build and lint to establish the Public 5 baseline. Diagnose failures before implementation; report preexisting failures separately.
- [x] Add failing guard tests: exact public origin/channel/version with browser-safe key succeeds; missing values, beta origin, suffix spoof, embedded credentials, `sb_secret_` and legacy service-role JWT fail without including keys in errors. Malformed legacy tokens fail closed. Include stale-output/sync failure coverage using temporary fixtures and mocked child commands, with no real keys.
- [x] Run focused tests and confirm intended failures; implement shared validation and a native build entrypoint that validates resolved Vite environment, creates fresh `dist-ios` and invokes sync only after success. Exclude generated assets and never set `server.url`.
- [x] Add a startup gate that shows a readable configuration error before AuthProvider mounts; invalid native configuration must not instantiate a production-connected Supabase client. Test zero client/network calls on invalid startup and unchanged ordinary web startup.
- [x] Generate the iOS SPM project using the verified Capacitor CLI. Use a native minimum deployment target supported by Capacitor 8 (iOS 15). Leave development team/signing credentials unconfigured. Generate the icon from existing repository artwork without changing web branding.
- [x] Run unit/UI tests, ordinary web build, native negative configuration tests and a native fixture build using a clearly nonfunctional browser-safe test key. Inspect bundled origin/release metadata without printing any real key. Fixture output is never installed for live use.
- [x] Commit the independently verified package/configuration changes locally.

### Task 2: Native behavior adapters

**Files:** Create `src/lib/nativePlatform.ts`, `src/lib/nativePlatform.test.ts`, `src/components/NativeLifecycle.tsx`, `src/components/NativeLifecycle.test.tsx`, `src/pages/ForgotPasswordPage.test.tsx`; modify `src/pages/ForgotPasswordPage.tsx`, `src/lib/pushNotifications.ts`, `src/pages/ProfilePage.tsx`, `src/main.tsx`, `src/styles.css` and native permission configuration only as required.

**Interfaces:** `isNativeApp(): boolean`; `openExternalUrl(url: string): Promise<void>` uses a verified system-browser mechanism for supported HTTPS URLs. `NativeLifecycle` registers and cleans up native foreground/background listeners, controlling Supabase auto-refresh without altering web lifecycle. Native recovery opens exactly `https://www.roadshowdriver.com/forgot-password`.

- [x] Add failing UI tests that native recovery opens the exact public HTTPS page and never sends an email or builds a `capacitor://` callback; web recovery retains its existing flow. Exercise external-open failure with a recoverable message.
- [x] Add failing tests that native device-push support is false even when browser APIs are mocked present, enabling push never registers a subscription, and in-app notification preferences/rows remain available.
- [x] Add lifecycle tests for foreground/background refresh control and listener cleanup. Test remember-me on/off and logout with mocked sessions; do not introduce a new token store without evidence it is required.
- [x] Implement the smallest adapters satisfying those tests. Open external links outside WKWebView through the chosen official platform API. Gate native push with clear copy that in-app notifications remain available.
- [x] Apply a native-only root marker and CSS safe-area/keyboard layout adjustments. Keep web layout unchanged. Preserve role/active-account checks and existing recovery boundaries.
- [x] Run focused UI/unit tests, then repository suites/build/lint; commit locally.

### Task 3: iOS verification and handoff

**Files:** Create `docs/ios-personal-build.md`; update `docs/architecture.md`, `docs/development-workflow.md` and `docs/project-decisions.md` only for native workflow. If device evidence requires file export adaptation: create `src/lib/nativeFiles.ts` and tests; modify `src/components/PdfViewer.tsx` and `src/pages/RedFolderPage.tsx`.

**Interfaces:** Conditional `sharePrivatePdf(url: string, filename: string): Promise<void>` downloads only a validated HTTPS signed URL from the selected project, uses temporary app storage, invokes the native share sheet and performs cleanup. It must not log signed URLs or make private storage public. Add official Filesystem/Share dependencies only if needed.

- [x] Verify the completed official Apple archive/signature, extract/install Xcode without replacing another installation, then stop at new legal/security/signing prompts for Jacob. Use per-command `DEVELOPER_DIR` to avoid changing global tool selection unnecessarily. Verify Xcode build and available iOS SDK/runtime.
- [ ] Build for iOS Simulator with `CODE_SIGNING_ALLOWED=NO` using dedicated ignored DerivedData. Launch with mocked/disconnected fixtures to verify shell boot, asset loading, route navigation and native gates; do not authenticate production as an automated test.
- [ ] Verify PDF worker/CMaps/fonts/WASM on local fixtures, including multipage and scanned documents, zoom/close, retry and expired-link handling. If downloads fail on WKWebView, implement the conditional export adapter with failure/cancellation/cleanup tests before retesting.
- [ ] Verify upload UI with synthetic JPEG/PNG/WebP and HEIC inputs: supported conversion or clear rejection, cancel, denial and failures must not create metadata or claim success. Preserve all private-storage policies. Live upload acceptance remains a user-assisted action.
- [ ] Record portrait/landscape keyboard, notch, home indicator, modal, navigation and PDF scrolling checks. Add only adjustments required by observed failures.
- [ ] After user-assisted signing and device trust, install on iPhone 17 Pro. Let Jacob sign in and exercise normal live-account workflows. Do not independently create production records, send recovery messages or invitations; record any untested behavior as pending.
- [ ] Document exact commands, environment setup, seven-day rebuild/reinstall without deleting app data, lack of native remote push/offline sync, and a results table distinguishing source checks, simulator, device and live-account acceptance.
- [ ] Run final repository checks and native compile after final edits. Obtain one independent whole-change review if native execution is selected, resolve findings, then provide local commits/artifacts and exact remaining blockers. No push or publication.

## Self-review and execution choice

Spec coverage checked: isolation, configuration, Auth, navigation, media, notifications,
layout, free toolchain, signing and verification each map to tasks above. Interfaces
are shared explicitly; optional export work is evidence-driven and remains within
the approved scope. No beta integration is required.

Recommended execution: native in this session, followed by one independent review;
the three tasks share configuration/platform interfaces, and this avoids repeated
context setup. Alternative: fresh implementer/reviewer subagents per task.
Jacob approved inline execution with one independent final review. Tasks 1–2 are complete. Task 3 source checks and unsigned simulator/device compilation passed; device installation and acceptance are in progress. The independent review found one important issue, fixed with three RED→GREEN regression tests in 73a5600; one minor signing-metadata cleanup is deferred while user-owned signing is active. No second review was requested.
