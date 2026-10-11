# Personal iOS Settings and saved-load follow-up

October 11, 2026. Existing `feat/ios-personal-public` checkout, based on `94e5b3f`.
Local personal Public 5 package only; no backend, credentials, deployment, push,
policy, or live test-data changes. Existing signing/icon/config edits preserved.

## Changes

- Native Profile tab/page becomes Settings, including native and fallback navigation.
  The route and bridge identifier stay `/profile` and `profile` for compatibility.
- Profile/account controls precede Appearance and Downloads. Status and Refresh sit
  at the bottom. Existing notification and account controls remain available.
  Web Profile naming and appearance position remain unchanged.
- A failed private saved read can retry on scene activation, even while session
  resolution/account verification is pending. Concurrent same-owner activation
  awaits the existing hydration rather than skipping directly to network refresh.
  Saved data remains account-scoped, lease-checked and read-only until verified.

## Diagnosis limits

Two coordinator tests failed before the fix: a failed native configure/read could
never be retried for the same owner, and a second activation completed before the
first saved read. Both pass after the change. The native bridge explicitly rejects
calls while UIApplication is not active; a lifecycle integration fixture proves
activation now recovers saved reads before network/session resolution.

These are reproduced code defects, not a confirmed measurement of Jacob's reported
minute-long wait. Hoid was connected and had Roadshow Driver 5.0 build 1 installed;
the reused version does not identify the installed source revision. The prior Xcode
Run was no longer waiting for unlock, but reported Finished running App on Hoid.
No claim is made that the prior offline commit had been installed successfully.
Uncached assignments and expired/unavailable saved copies still require network
reads. No instant first network fetch is promised.

## Verification

- Node 24.19.0 / npm 11.5.2 from the existing toolchain.
- Unit: 78 passed; native pipeline: 2 passed.
- UI: final full run passed 98 tests across 38 files, including the new scene
  activation integration regression.
- Web build passed; lint 0 errors, the same 3 baseline warnings.
- Offline Swift store/file/background harnesses passed.
- Fresh guarded ios:sync passed; unsigned generic iOS Debug build passed using
  Xcode 27.2 (27B5028f) at its existing Downloads path.
- Saved/live UI fixture held network until saved content rendered; observed
  445 ms saved / 544 ms live in the final jsdom run. These are not iPhone timing measurements.
- Synthetic Settings DOM ordering/controls were inspected through UI tests. A
  local-file browser preview was blocked by browser policy; no workaround used.
  Visual device acceptance remains unverified.

## Installation

Xcode Run remained at Copy public; Stop was requested without confirmed UI
completion. A separate command-line signed build using the same project signing
and a fresh `/tmp/roadshow-settings-signed` derived-data directory succeeded.
No provisioning-update flag or account/security change was used.

`devicectl device install app` explicitly confirmed the new signed App.app was
installed on Hoid as `com.jacobabbott.roadshowdriver`. A subsequent launch request
failed with CoreDevice 10002 / FBSOpenApplicationErrorDomain 7, reason Locked:
the phone could not be unlocked. Stopped at that boundary as instructed. The
updated installation is confirmed; launch, visual acceptance and actual cold-start
saved-contract timing are not. Unlock Hoid before resuming device launch checks.

The Xcode/sync flow added another untracked config copy (`config 10.xml`); it was
left alongside the user's existing copies, unstaged. Existing project signing and
icon edits also remain unstaged. No changes were pushed or published.
