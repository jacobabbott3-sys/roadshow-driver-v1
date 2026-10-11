# Personal iPhone offline contracts and selected resources

Status: written design approved October 10, 2026, with Jacob’s clarification
that saved copies provide immediate loading and refresh into the live view.
Implementation plan approved; implemented locally. Verification and device acceptance are recorded in `docs/releases/2026-10-10-ios-offline-verification.md`. Local personal Public 5 app only. No backend or website changes.

## Intent and approved scope

This is one integrated saved-first, live-refreshed experience, not a separately
selected offline area. Assigned contract details and checklist status save
automatically. Refresh when
opening/returning to the app and opportunistically in the background. Photos and
contract attachments download only on request. Drivers pick Red Folder resources
to download. All offline data is read-only in this phase. Preserve existing
contracts screens, signing, linked-signing semantics, and admin assignment rules.

## User experience

- Show a valid account-scoped saved copy immediately on normal Home/Contracts,
  contract detail and selected Red Folder routes. Do not wait for a network timeout
  or require the user to enter a separate offline screen.
- Verify the account and refresh in the background of the visible screen. Replace
  the saved data with the fresh live result in place, retaining selected tab,
  search, scroll and reading position where the content still exists. If the
  selected record is removed/revoked, show that result rather than stale controls.
- Contracts show a small Updating / Up to date / Offline — saved copy / Could not
  refresh indicator and Last updated time. Do not call a saved copy live merely
  because the device reports connectivity. If no usable copy exists, retain
  normal loading/retry behavior. A network failure keeps the valid saved copy.
- While account/data verification is pending, saved content is read-only. Enable
  existing mutations only after both current account verification and a fresh
  authorized load of the displayed data succeed. No saved administrator role
  enables offline admin actions.
- Automatically save every currently assigned contract, including linked-driver
  assignments; never use an admin's broader read visibility as ownership proof.
  Completed contracts remain saved while they remain assigned. A complete fresh
  ownership result removes unassigned contracts and their downloaded attachments.
- Save contract/show details already returned under existing visibility rules,
  checklist labels/instructions, responses and review status. Do not manufacture
  unlocked details using device time. If data was restricted when saved, it stays
  restricted offline until a successful authorized refresh supplies it.
- Photos and document attachments show Download for offline / Remove download.
  A downloaded attachment remains associated with its contract and account.
- Red Folder items have Download / Remove download, progress, failure/retry and
  last-updated indicators. Text plus the selected image/PDF is saved. Remote links
  remain online-only; linked websites are not crawled or archived.
- Offline mode is clearly labeled; signing, checklist changes, submission, uploads,
  availability, chat, and administration still require verified online access.
  There is no queued-write system or silent upload retry.
- Profile includes download usage and Clear downloads; automatically saved contract
  details can be regenerated at the next successful refresh. Manual resource and
  attachment choices are removed by Clear downloads.

## Private storage and account policy — approved defaults

Use private native Application Support storage, file protection, and backup
exclusion. No shared widget container, public bucket, localStorage business-data
cache, or public file URLs. Persist versioned, validated records and file bytes;
never persist signed download URLs as the offline attachment.

Offline reads require an existing signed-in account plus an active-account check
successfully performed within the previous **7 days**. This offline lease is
separate from online authorization: it only grants read access to that account's
previously saved copies. It does not claim that assignment or active-account state
is current while disconnected. Expiry shows Connect to refresh offline access.
First-time login cannot work offline. Detect backward clock changes and require
online verification rather than extending the lease.

Only native saved-copy presentation on the ordinary routes may use this policy.
Keep the verified online gate for live content/mutations; the narrowly scoped
saved-content branch may render read-only data while verification is pending or
connectivity is unavailable. Do not expose the general protected Outlet through
that branch. The web gate and backend authorization remain unchanged. A server response explicitly reporting an
inactive account clears its data immediately. Sign-out, account switching, local
session removal, and invalid/unknown cache owner invalidate access immediately and
clear that account's copies. Late results from the old account must never recreate
its cache or appear under another account. Ordinary network errors retain the last
complete copies within the lease; a failure must not look like an empty assignment
list. Authoritative permission revocations remove affected copies.

Initial storage cap: **250 MiB total**, with existing **20 MiB per-file** limits.
Contract metadata gets priority. Refuse additional optional files with a clear
message when full; do not silently delete manually selected resources. Partial or
failed downloads never replace a good copy. A user-removed optional file is not
re-downloaded unless selected again. Automatic refresh updates only selected files
whose identity/version has changed and that remain authorized.

## Refresh and iOS background execution

Refresh after verified sign-in, on each app launch/return, when opening a saved
contract/resource view, on explicit refresh, and after relevant successful in-app
operations. These reads happen behind usable saved content, not a blocking
full-screen loader. Coalesce overlapping requests per account/record. A periodic
foreground freshness check may run every five minutes; it must not suppress
launch/return, route-open, explicit or mutation-driven refreshes.

“Background refresh” has two meanings: quiet asynchronous refresh while the app
is visible is the default freshness path; OS-scheduled refresh while closed is an
additional best-effort optimization. Cached data is a fast initial render and
backup, never the preferred source once a fresh authorized response is available.

Register a native BGAppRefreshTask and request its next opportunity no earlier
than 30 minutes after the prior attempt. iOS decides when or whether to execute;
force-quitting, battery policy, Background App Refresh settings and scheduling
can prevent it. Never promise an exact schedule or closed-app freshness.

Background networking must not run in a hidden WebView. A narrowly scoped native
reader may use a mirror of the existing session's **short-lived access token** in
app-private, this-device-only Keychain storage after first unlock. It must never
store a refresh token, password, service key, or mint a new credential. Supabase JS
remains the sole session-refresh owner; foreground auth events replace/clear the
mirror. An expired/missing token skips background work until the app is opened.
This limits unattended refresh duration and avoids competing token refreshers.

The native reader uses only the existing project's authenticated read endpoints,
verifies the current active profile and complete assigned-contract membership,
and obeys existing RLS. It does not accept arbitrary bridge URLs or arbitrary
filesystem paths. Background task expiry cancels requests and preserves complete
prior snapshots. Large optional files are deferred to foreground refresh. A
successful background profile verification can renew the lease; a network failure
or mere timer firing cannot. Returned identity must match the cached owner.

## Architecture and sequencing

1. Versioned native store and a small typed bridge for scoped snapshot/file
   operations, quotas, atomic replacement, clearing and provenance timestamps.
2. Foreground coordinator with generation-based cancellation, full membership
   reconciliation, selectable-file manifest and shared saved/live read models.
3. Integrated ordinary-route saved-content presentation while the online gate
   verifies/fetches. Never replace verified online auth with an unconditional
   cache fallback. Support saved-contract deep links after local ownership/lease
   checks. No manual offline-area switch and no offline admin privileges.
4. Native background reader and scheduler using the bounded credential mirror.
   Share record validation and semantic rules through fixtures across Swift/TS.

Contract and resource data services continue to own online behavior. No migrations,
new paid services, push capability, Apple account changes or public deployment.
Native background-mode configuration is part of the reviewed implementation;
preserve existing personal signing and consult the user for any new Apple prompt.

## Acceptance and testing

Use fixtures, never write test content to Public 5 assignments. With delayed
network promises, prove saved content renders before the response, then updates
in place without lost tab/search/scroll state. Verify a cold offline restart can
show a valid saved copy, an online startup shows it without waiting for timeout,
and no-copy/expired-copy cases retain proper loading/recovery. Verify full
membership pagination, primary/linked ownership, unassignment, account switches,
sign-out, inactive status, stale results, lease expiry/clock rollback, wrong owner,
quota exhaustion, corrupt cache, partial download, optional-file removal and
expired auth. Confirm no protected writes occur from offline views and web behavior
remains unchanged. Test background expiration and token expiry without minting
credentials. Source/mocked checks do not prove live permissions.

Run repository unit/UI/native tests, web build/lint, native sync and unsigned iOS
compilation. After approval and existing signing, install and ask Jacob to verify
previously saved real contract/resources in airplane mode, reconnect/refresh,
download removal, account isolation and OS-scheduled refresh limitations. Do not
claim background scheduling is verified solely by manually triggering a task.

## References

- docs/architecture.md and docs/ios-personal-build.md
- src/context/AuthContext.tsx and src/components/ProtectedRoute.tsx
- src/lib/driverData.ts and src/native/widgetData.ts
- Apple: https://developer.apple.com/documentation/backgroundtasks/refreshing-and-maintaining-your-app-using-background-tasks
- Apple: https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly

## Review checkpoint

Jacob approved the 7-day offline access window, 250 MiB cap and short-lived-token
background limitation, then clarified the saved-first/live-refreshed experience. This design extends
the current online-only account policy only for saved-copy reads. It cannot provide
immediate remote revocation while the phone is offline. The written design is approved; review the saved implementation plan before building this subsystem.
