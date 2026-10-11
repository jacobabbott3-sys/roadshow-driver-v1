# Saved-first contracts and selected resources implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for implementation in this session; retain this session as the sole coding owner, as requested. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the signed-in driver's saved contract data immediately, refresh the same screens to live data quietly, and allow selected resource/attachment downloads.

**Architecture:** A private native store owns versioned snapshots/files and a bounded offline lease. One account-scoped coordinator provides saved/live read models to ordinary routes and synchronizes approved data. A native background reader uses only the mirrored unexpired access token; Supabase JS remains the sole session-refresh owner.

**Tech Stack:** Existing React 19/TypeScript/Vite, Capacitor 8.5.3, Swift/Foundation/Security/BackgroundTasks, existing Supabase JS. No new package dependency planned.

**Spec:** `docs/superpowers/specs/2026-10-10-ios-offline-design.md`

## Global Constraints

- Local personal Public 5 app only. No backend or website changes.
- All offline data is read-only in this phase.
- Offline reads require an existing signed-in account plus an active-account check successfully performed within the previous **7 days**.
- Initial storage cap: **250 MiB total**, with existing **20 MiB per-file** limits.
- Supabase JS remains the sole session-refresh owner; foreground auth events replace/clear the mirror.
- It must never store a refresh token, password, service key, or mint a new credential.
- No manual offline-area switch and no offline admin privileges.
- Preserve local signing/icon/config changes, current feature branch, free signing, private storage and RLS. No push, public deployment, migrations or live-write fixtures.
- Node 24; npm 11.5.2. Existing dependencies are installed with `npm ci` when installation is needed.

## Review Focus

- Slow online launch: a saved copy must paint before network completion without activating stale checklist/signing controls. Task 3 pins this.
- Account switch/sign-out during download: late work must not recreate the old cache or leak into the new account. Tasks 1, 2 and 4 pin this.
- Incomplete membership reads: retain prior complete membership on transient failure; remove unassigned copies only after an authoritative full result. Task 2 pins this.
- File replacement at the same storage path: downloaded resources must not silently remain stale. Task 4 pins metadata/revalidation and replacement.
- iOS expiration/expired access token/clock rollback: preserve good data without inventing freshness or extending offline authorization. Tasks 1 and 5 pin this.

## Shared file and interface map

New TypeScript files under `src/native/offline/`:
- `model.ts`: JSON schema types, lease/freshness decisions and validation.
- `plugin.ts`: typed native bridge only; no tokens in snapshot types.
- `data.ts`: authorized foreground reads, explicit owner filtering and redaction.
- `coordinator.ts`: generation-aware hydration/refresh/download orchestration.
- `context.ts`, `OfflineBridge.tsx`: one owner mounted inside BrowserRouter, outside routed Suspense and the protected gate.
- `useSavedRead.ts`: subscription hook exposing one read model to pages.
- `SavedContentGate.tsx`, `FreshnessNotice.tsx`, `DownloadControl.tsx`, `DownloadSettings.tsx`: UI boundaries and controls.
- `views/`: read-only contract list/details and selected-resource presentation extracted from existing pages where needed; no cloned mutation handlers.

New Swift files under `ios/App/App/Offline/`:
- `OfflineModels.swift`, `OfflineStore.swift`, `OfflineFileStore.swift`, `RoadshowOfflinePlugin.swift`.
- `OfflineCredentialStore.swift`, `OfflineBackgroundReader.swift`, `OfflineBackgroundScheduler.swift`.

Central interfaces (Task 1 defines, later tasks consume):
- `SavedChecklist = { id: string | null; sections: ChecklistSection[] }`.
- `SavedContract = { contract: Contract; checklist: SavedChecklist; fetchedAt: number }` with validated UUIDs, explicit JSON fields and no signed URLs.
- `FileRef = { kind: 'resource' | 'contract-document' | 'contract-photo'; recordId: string; contractId?: string }`; resolve bucket/path from verified records, never caller-supplied URL/path.
- `SavedResource = { resource: Resource; fetchedAt: number }` for user-selected handbook items only.
- `OfflineSnapshot = { version: 1; owner: string; verifiedAt: number; lastSeenAt: number; contracts: Record<string,SavedContract>; links: ShowLink[]; resources: Record<string,SavedResource> }`.
- `ReadState<T> = { data: T | null; source: 'saved' | 'live' | 'none'; refreshing: boolean; fetchedAt: number | null; error: string | null; canMutate: boolean }`.
- Validation `validateSnapshot(raw: unknown): OfflineSnapshot | null` and `canReadSaved(snapshot: OfflineSnapshot, sessionOwner: string | null, now: number): boolean`.
- Store `configure(owner: string, generation: string): Promise<void>`, `read(owner: string): Promise<OfflineSnapshot | null>`, `replace(snapshot: OfflineSnapshot, generation: string): Promise<void>`, `clear(owner: string): Promise<void>`, `usage(owner: string): Promise<{bytes:number;limit:number}>`.
- File store `download(ref: FileRef, generation: string): Promise<void>`, `remove(ref: FileRef): Promise<void>`, `readFile(ref: FileRef): Promise<{mime:string;base64:string}>`; bounded one-file-at-a-time transport, no public file paths.
- `OfflineCoordinator` exposes `activate(owner: string)`, `verify(owner: string, verifiedAt: number)`, `refresh(reason: 'launch'|'resume'|'route'|'manual'|'mutation'|'periodic', contractId?: string): Promise<void>`, `deactivate(reason: 'signout'|'switch'|'inactive'|'session-removed'): Promise<void>`, `subscribe(listener: () => void): () => void`, and `getState(): OfflineState`. `OfflineState = { owner: string | null; generation: string; snapshot: OfflineSnapshot | null; contracts: ReadState<SavedContract[]>; details: Record<string, ReadState<SavedContract>>; resources: ReadState<SavedResource[]>; files: SavedFile[]; usage: {bytes: number; limit: number} }`. `SavedFile = { ref: FileRef; mime: string; bytes: number; fetchedAt: number; validator: string | null }`.
- All times use Unix milliseconds. Native generation tokens change on account invalidation; stale bridge requests are rejected, not merely ignored in React.

### Task 1: Private store, schema and lease

**Files:** Create `model.ts`, `plugin.ts`, four store/plugin Swift files above, `src/native/offline/model.test.ts`, `ios/App/AppTests/OfflineStoreTests.swift`, `ios/App/AppTests/OfflineFileStoreTests.swift`, and sanitized JSON fixtures under `tests/fixtures/offline/`. Add `src/native/offline/*.test.ts` to the existing `package.json` test command. Create `scripts/test-offline-native.mjs` to compile/run standalone Swift `@main` assertion harnesses using the existing AppTests convention. Register plugin in `ios/App/App/NativeShell/RoadshowBridgeViewController.swift`; add native file/test references to `ios/App/App.xcodeproj/project.pbxproj` without resetting existing settings.

**Interfaces:** Produces all central data/store types above. Native reads are scoped to one validated owner/generation and return no content until lease/owner validation succeeds.

- [ ] Write failing lease/schema tests: a matching existing session within `7*24*60*60*1000` ms reads saved content; wrong/missing owner, unknown version, expired lease, backward clock, signed URL fields and corrupt JSON are rejected. Swift fixtures match TypeScript decisions.
- [ ] Write failing storage tests: atomic replacement preserves the old snapshot on interrupted write; inactive/sign-out clearing invalidates a racing generation; disk-full/quota failure preserves good data. A 20 MiB file is accepted and 20 MiB + 1 byte is rejected; total cap is 250 MiB.
- [ ] Run unit tests and native tests to confirm the failures before implementation. Run `node --experimental-strip-types --test src/native/offline/model.test.ts` and `node scripts/test-offline-native.mjs`. The script uses `xcrun swiftc` with `DEVELOPER_DIR=/Users/jacoba/Downloads/Xcode-beta.app/Contents/Developer`, compiles each Foundation-only test harness separately into a temporary directory, runs it, and propagates any failure. Keep iOS file-protection application in an iOS adapter compiled by the app target; test portable policy/storage without assuming a simulator or XCTest scheme.
- [ ] Implement private Application Support storage with backup exclusion and complete-until-first-user-authentication file protection. Persist no credential in snapshots. Validate read/write boundaries, use atomic rename and reject path traversal/symlink escapes. Keep downloaded files invisible to shared widget storage.
- [ ] Run these tests green, inspect the scoped diff, commit only Task 1 files. A compiling app with an unused bridge is the deliverable; no cache read authorization is enabled yet.

Representative Task 1 assertions (`snapshot` is a sanitized valid fixture):
```ts
assert.equal(canReadSaved(snapshot, snapshot.owner, snapshot.verifiedAt + 7 * 86400000 - 1), true);
assert.equal(canReadSaved(snapshot, snapshot.owner, snapshot.verifiedAt + 7 * 86400000), false);
assert.equal(canReadSaved(snapshot, null, snapshot.verifiedAt), false);
assert.equal(canReadSaved(snapshot, snapshot.owner, snapshot.lastSeenAt - 1), false);
assert.equal(validateSnapshot({ ...snapshot, version: 2 }), null);
```

### Task 2: Foreground account-scoped hydration and refresh

**Files:** Create `data.ts`, `coordinator.ts`, `context.ts`, `OfflineBridge.tsx` plus matching tests. Modify `src/App.tsx`, `src/context/AuthContext.tsx` and its native-account tests only to expose precise local-session/verification lifecycle. Reuse ownership logic from `src/native/widgetData.ts` and `src/native/widgetModel.ts`; inspect relevant current migrations/tests as read-only evidence for existing read policies.

**Interfaces:** Consumes Task 1 store; produces `OfflineCoordinator`, `OfflineState` and context subscription. `data.ts` exports `loadOwnedSnapshot(owner: string): Promise<OfflineSnapshot>` and `loadOwnedContract(owner: string,id: string): Promise<SavedContract | null>`; a typed authoritative-revocation result is distinct from network failure.

- [ ] Write failing tests with deferred network promises: activation hydrates a valid snapshot immediately; account verification and live refresh remain pending; verified fresh results replace saved data; failures retain saved data with its original timestamp.
- [ ] Pin full-pagination ownership, linked drivers, test-show exclusion, admin-visible-but-not-owned exclusion, null/missing counts, unassignment and old-generation responses. No partial successful list may trigger deletion.
- [ ] Pin refresh coalescing and triggers: launch/resume/route/manual/mutation can refresh despite the five-minute periodic timer; duplicate concurrent reads coalesce. A failed refresh never renews the lease.
- [ ] Expose `sessionResolved: boolean` and `profileVerification: 'pending'|'verified'|'unavailable'|'inactive'` from AuthContext without changing current online enforcement. Local session removal/sign-out invalidates immediately; account switch creates a new generation before reading cached data. Do not rely on JWT user metadata for activity/ownership.
- [ ] Implement whitelisted data projection and coordinator. Fetch contract/checklist data only for explicitly owned IDs; preserve linked-signing grouping and visibility. Mount one bridge after native configuration validation. No business snapshots go into localStorage and no real data fixtures are created.
- [ ] Run new tests plus existing native-account/widget tests; commit Task 2. Live routes still retain the old gate until Task 3 is ready.

Representative Task 2 assertions after `activate(owner)` hydrates the fixture while network promises remain unresolved:
```ts
assert.equal(coordinator.getState().contracts.source, 'saved');
assert.equal(coordinator.getState().contracts.canMutate, false);
assert.deepEqual(coordinator.getState().contracts.data, Object.values(snapshot.contracts));
await coordinator.deactivate('signout');
assert.equal(coordinator.getState().snapshot, null);
assert.equal(coordinator.getState().owner, null);
```
Run: `node --experimental-strip-types --test src/native/offline/*.test.ts src/native/widget*.test.ts`; expected all pass, including deferred-response race cases.

### Task 3: One saved-first, live-refreshed route experience

**Files:** Create `useSavedRead.ts`, `SavedContentGate.tsx`, `FreshnessNotice.tsx`, focused read-only view components and tests. Modify `src/components/ProtectedRoute.tsx`, `src/pages/HomePage.tsx`, `ContractsPage.tsx`, `ContractDetailPage.tsx`, `SigningGroupPage.tsx`, `ResourcesPage.tsx`, `RedFolderPage.tsx` and `src/native/native.css` only as needed for shared data/presentation.

**Interfaces:** `useSavedRead(key: 'home'|'contracts'): ReadState<SavedContract[]>`, `useSavedRead(key: 'resources'): ReadState<SavedResource[]>`, and `useSavedRead(key: {contractId:string}): ReadState<SavedContract>` overloads consumes coordinator state. `SavedContentGate` renders only whitelisted read-only presentations for the matching route while verification/fetching is pending/unavailable; it never mounts the general protected Outlet from cached authorization.

- [ ] Write failing UI tests proving saved content is visible before unresolved network promises finish, then the same selected tab/search state and reading position survive a successful live replacement. Include cold offline start and slow online start.
- [ ] Pin no-cache/expired-cache recovery, deep links, auth invite/recovery routes, inactive accounts, missing ownership and offline admin rejection. Cached rendering must call zero protected write functions even if a synthetic click is dispatched.
- [ ] Use a shared read-only presentation layer so cached and live views do not diverge. When only saved data is visible, mutation handlers/components are not mounted. Native live actions require verified account plus a fresh authorized load of that displayed data; existing web behavior remains unchanged.
- [ ] Keep route/tab/search state in router/current components and restore scroll only when switching saved/live render boundaries requires it. Refresh must not run full-screen PageState loading when usable data exists. Announce small status changes accessibly, not by repeatedly re-reading the page.
- [ ] Show Up to date only after an actual successful read, Offline — saved copy on confirmed network unavailability, and Could not refresh for other failures. A successful response removing a record replaces its saved view with unavailable state.
- [ ] Run route/UI/auth regressions and commit. This task delivers fast metadata loading and read-only fallback; optional files and closed-app refresh follow.

Representative Task 3 UI assertions in a fixture-backed saved route with a deferred live response:
```tsx
expect(screen.getByText('Offline fixture contract')).toBeVisible();
expect(screen.queryByRole('button', { name: 'Submit checklist' })).not.toBeInTheDocument();
expect(writeChecklistMock).not.toHaveBeenCalled();
```
Resolve the live response and assert the updated fixture title, unchanged selected tab/search value and captured scroll position. Run `npm run test:ui`; expected all UI tests pass without new warnings.

### Task 4: Selected resources and attachments

**Files:** Complete `OfflineFileStore.swift`; create `DownloadControl.tsx`, `DownloadSettings.tsx` and tests. Modify `RedFolderPage.tsx`, `ContractDetailPage.tsx`, `ProfilePage.tsx`, `src/components/PdfViewer.tsx` and relevant image presentation.

**Interfaces:** Consumes FileRef operations. PdfViewer gains an optional typed local source `{bytes: Uint8Array}` mutually exclusive with its existing remote `filePath`; remote callers retain current behavior. Object URLs for images/downloads are memory-only and revoked on close/account change.

- [ ] Write failing tests for explicit download/removal, 20 MiB/250 MiB limits, interrupted downloads, sign-out/account switch during download, malformed file type and retry preserving a previous good copy.
- [ ] Pin replacement at the same bucket/path using authenticated object metadata ETag/Last-Modified; when no reliable validator exists, re-download selected files during foreground refresh. Validate MIME/size and atomically replace; do not change the current saved copy on failure. Revoked/deleted records remove their local files.
- [ ] Download through fresh authorized storage access; do not persist signed URLs or accept arbitrary URLs/paths from the bridge. A file manifest records selection, logical ref, validator, MIME, byte size and fetchedAt. Clearing selection cancels outstanding work and prevents late completion from restoring it.
- [ ] Integrate download/remove/progress/failure controls for handbook text/PDF/images and contract documents/photos. No photos or attachments auto-download by default. Render local PDFs with existing bundled PDF.js assets; preserve close/focus/zoom behavior and web downloads.
- [ ] Add storage usage and Clear downloads. Clear selected resources/files, invalidate work, and permit automatic contract metadata to regenerate at the next successful refresh. Do not silently evict manually selected resources.
- [ ] Run viewer/download/account tests plus existing PDF regressions; commit Task 4.

Representative Task 4 assertions after downloading one fixture, then invalidating its account:
```ts
assert.equal(coordinator.getState().files.length, 1);
await coordinator.deactivate('switch');
assert.deepEqual(coordinator.getState().files, []);
await assert.rejects(store.readFile(ref));
```
Run `npm run test:ui`, `npm test`, and `node scripts/test-offline-native.mjs`; expected viewer regressions, quota boundaries and account-switch races pass.

### Task 5: Best-effort native background freshness

**Files:** Create `OfflineCredentialStore.swift`, `OfflineBackgroundReader.swift`, `OfflineBackgroundScheduler.swift` and unit tests. Modify `RoadshowOfflinePlugin.swift`, `OfflineBridge.tsx`, `ios/App/App/AppDelegate.swift`, `SceneDelegate.swift`, `Info.plist` and project background-mode settings while preserving signing.

**Interfaces:** Credential mirror `setAccess(owner: string, token: string, expiresAt: number, generation: string)` and `clearAccess()`; only an existing access token is accepted. Native reader `refresh(owner:generation:completion:)` shares Task 1 snapshot format and Task 2 semantic fixtures. Scheduler identifier is `com.jacobabbott.roadshowdriver.refresh`.

- [ ] Write failing native tests for expired/missing tokens (zero network calls), cancellation/expiration (prior snapshot intact), wrong returned profile ID, inactive account (clear), partial membership (no deletion), and a newer foreground generation winning over an older background response.
- [ ] Mirror current access tokens through app-private this-device-only Keychain, after first unlock. Clear on session removal/sign-out/inactivity. Never copy refresh tokens, alter session expiry, mint credentials or run an auth refresh in Swift. Async auth event handling must not deadlock Supabase callbacks.
- [ ] Implement only fixed-origin authenticated reads using existing API semantics; verify active profile and complete owner membership before replacing snapshots. Reuse parity fixtures for redaction, linked assignments and checklist structure. Keep optional large-file refresh in foreground.
- [ ] Register BGAppRefreshTask during startup, request the next opportunity no earlier than 30 minutes, cancel on invalidation, and call completion exactly once. Expiration cancels networking. Account generation is checked again before writes. No hidden WebView or arbitrary timer claims closed-app execution.
- [ ] Validate Info.plist and unsigned device compilation. Treat OS eligibility, Background App Refresh disabled, force-quit and missing token as supported skip outcomes, not freshly updated data. Do not accept new Apple/security prompts on Jacob's behalf.
- [ ] Run native reader/scheduler tests and commit Task 5.

Task 5 native harnesses assert `networkCallCount == 0` for expired credentials and `completionCount == 1` for both normal completion and expiration races. Inject a fake clock, transport and task completion into the Foundation policy/reader; the app adapter supplies BackgroundTasks at runtime. Extend `scripts/test-offline-native.mjs` to compile and run these harnesses. Expected all assertions pass; separately compile the iOS-only adapter with the device build.

### Task 6: Whole-flow verification, performance evidence and installation

**Files:** Update `docs/product.md`, `docs/architecture.md`, `docs/project-decisions.md`, `docs/ios-personal-build.md`; add integration fixtures/tests and a local verification record under `docs/releases/` without real account records.

**Interfaces:** Consumes all prior deliverables; produces verified behavior and a precise list of device-only limitations.

- [ ] Use a local fixture harness to record time-to-saved-content versus time-to-live-content with controlled delayed network responses. Assert order and read-only state transitions; avoid fragile absolute timing thresholds or fabricated speed claims.
- [ ] Run `npm test`, `npm run test:ui`, `npm run test:native`, `npm run build`, `npm run lint`, store/reader Swift tests, `npm run ios:sync` and unsigned device compilation. Use Node 24/npm 11.5.2, require zero new lint warnings, and report any unsupported native runtime tests honestly.
- [ ] Perform a fresh independent review of ownership, lifecycle, storage deletion, file transport and saved-to-live transitions. The selected execution method determines the reviewer workflow. Fix material findings and rerun affected verification before installation.
- [ ] Inspect diffs against preserved signing/icon changes; commit only intentional changes locally. Do not push, deploy, apply migrations, or manufacture live assignments/photos.
- [ ] Install through the existing Xcode Run workflow once checks pass. Stop for any new security/account prompt. Verify Xcode says Running App on Hoid; unsigned compilation is not installation evidence.
- [ ] Ask Jacob to open legitimate assigned data online, reopen with airplane mode, confirm fast saved display/read-only state, reconnect and see live replacement, then choose/remove a resource download. No test writes to live records. Document background scheduling as unverified until observed under real OS scheduling.

## Plan review

The design is approved; this plan awaits review. Preserve the requested sole coding
owner: implement here, followed by one independent review of the complete change.
Auth, storage and routing share lifecycle state, so implementation remains sequential.
