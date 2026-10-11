# Personal iOS offline verification

October 10, 2026 local Mac run. Branch `feat/ios-personal-public`; no push, deployment, migration, or test writes to live records.

## Delivered

Assigned contract details and checklist status hydrate from a private saved copy before network completion. Verified successful reads update the same pages; failed refreshes retain the saved copy and its timestamp. Saved views are read-only, require the existing account and a verification no older than seven days, and are cleared on sign-out/inactivity/account replacement. Broader authorized administrator results remain live-only.

Drivers select Red Folder handbook text/PDF/images and contract documents/photos to download, open saved files, remove selections, or clear downloads in Profile. Metadata saves automatically; file bytes are opt-in. Files are limited to 20 MiB each and 250 MiB actual total disk storage, including base64-envelope overhead. Native membership checks prune revoked files and reject late downloads. Foreground refresh re-downloads selected files where no reliable object validator is available; failure preserves the previous copy.

Best-effort iOS background refresh requests an opportunity no earlier than 30 minutes. It uses only an existing unexpired access token in private device-only Keychain, checks active profile and complete assignment membership, and never refreshes authentication or performs business writes. iOS scheduling is not a fixed interval or guaranteed delivery mechanism.

## Local evidence

Node 24.19.0 / npm 11.5.2 (npm invoked through the existing `work/toolchain` installation):

| Check | Result |
| --- | --- |
| `npm test` | 76 passed, 0 failed |
| `npm run test:ui` | 96 passed across 37 files |
| `npm run test:native` | 2 pipeline tests passed |
| `npm run build` | Passed |
| `npm run lint` | 0 errors; same 3 known warnings |
| `node scripts/test-offline-native.mjs` | Store, file, and background-reader harnesses passed |
| `npm run ios:sync` | Fresh native build and Capacitor sync passed |
| Unsigned generic iOS Debug `xcodebuild` | BUILD SUCCEEDED with Xcode 27.2 beta |
| `git diff --check` | Passed |

The saved/live fixture holds its network promise until saved content is rendered. One focused run measured saved content at 427.1 ms and updated live content at 479.8 ms in jsdom. These are harness observations, not iPhone launch benchmarks. It asserts saved-first ordering, no submit control while unverified, and preservation of the selected Checklist tab after live replacement. A separate temporary-session regression includes a valid saved snapshot and proves the protected route goes to Login after local sign-out.

Native fixture coverage includes lease/clock rejection, stale-generation rejection, shared valid/invalid schema fixtures, revoked-file rejection, malformed MIME bytes, 20 MiB acceptance/oversize rejection, and quota failure preserving the old file. Background fixtures cover expired-token zero calls, missing/inactive profile, incomplete responses, and idempotent completion. Native OS expiration/cancellation and all SDK/device lifecycle combinations are not established by these portable harnesses.

## Independent review and fix pass

One fresh read-only review identified eight material findings. One fix pass added regression coverage and corrected: cross-account resource-loop contamination; discarded temporary-session owner restoration; concurrent selection loss and removed-selection restoration; native revoked-file access/late writes; clock-watermark rollback; empty-cache error recovery and storage-full live-data loss; malformed snapshot structures; and loss of administrators' broader authorized live results. There were no deferred minor findings. No second review was performed.

## Implementation decisions and review limits

- Retained Jacob's selected checkout and existing feature branch, preserving signing/icon/config edits. A future PR needs an explicit transfer/release decision.
- Reused existing page presentation inside a native route allowlist. Online mutations require fresh verified reads; navigation adjustments remain confined to that native frame.
- Selected files re-download without dependable object version validators; this uses additional bandwidth.
- Early hydration reads only the existing persisted session owner, never synthesizing a Session/Profile. A future SDK storage-format change can disable this fast path and fail closed.
- Physical file protection, airplane-mode behavior, cold starts after reboot, device timing, and actual OS-scheduled refresh require device acceptance. Portable tests and compilation do not prove them.
- Effective live RLS/storage permissions were not re-tested; no policies/backend changes were made. Preexisting signing/icon/config edits were excluded from review and commits. Public deployment, migrations and push remain outside scope.

## Installation and remaining device acceptance

The existing Xcode Run workflow built the signed app, but launch is currently waiting at “Unlock Hoid to Continue.” Installation/launch is not yet confirmed by “Running App on Hoid.”

After unlocking and confirmed launch: open a legitimate assigned contract online, reopen in airplane mode and confirm saved read-only content, reconnect and confirm live replacement without losing the selected tab. Select a resource download online, open it offline, then remove it. Do not create fake assignments, upload test photos, or modify real checklist answers. Leave normal Background App Refresh enabled if desired and observe actual scheduling over time; force-quit/disabled refresh/expired token are supported skip cases.
