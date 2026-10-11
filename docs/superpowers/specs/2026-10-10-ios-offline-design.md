# Personal iPhone offline contracts and selected resources

Status: proposed written design; scope approved in conversation, implementation
not yet approved. Local personal Public 5 app only. No backend or website changes.

## Intent and approved scope

Assigned contract details and checklist status save automatically. Refresh when
opening/returning to the app and opportunistically in the background. Photos and
contract attachments download only on request. Drivers pick Red Folder resources
to download. All offline data is read-only in this phase. Preserve existing
contracts screens, signing, linked-signing semantics, and admin assignment rules.

## User experience

- Contracts show a small Saved offline / Updating / Unable to update status and
  Last updated time. Opening a saved contract works without connectivity.
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

## Private storage and account policy — proposed defaults for review

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

Only native saved-copy routes may use this policy. Existing online ProtectedRoute
and mutation guards remain unchanged. A server response explicitly reporting an
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

Foreground refresh occurs after verified sign-in, on return to the app when stale,
on explicit refresh, and after relevant successful in-app operations. Coalesce
concurrent requests per account; no more than one automatic foreground refresh
per five minutes, except an explicit refresh or mutation-driven update.

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
   reconciliation, selectable-file manifest and pure read-only offline views.
3. Separate offline entry path during connectivity failure; never replace verified
   online auth with an unconditional cache fallback. Support saved-contract deep
   links after local ownership/lease checks. No offline admin privileges.
4. Native background reader and scheduler using the bounded credential mirror.
   Share record validation and semantic rules through fixtures across Swift/TS.

Contract and resource data services continue to own online behavior. No migrations,
new paid services, push capability, Apple account changes or public deployment.
Native background-mode configuration is part of the reviewed implementation;
preserve existing personal signing and consult the user for any new Apple prompt.

## Acceptance and testing

Use fixtures, never write test content to Public 5 assignments. Verify full
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

Jacob should review the proposed 7-day offline access window, 250 MiB cap and
short-lived-token background limitation before implementation. This design extends
the current online-only account policy only for saved-copy reads. It cannot provide
immediate remote revocation while the phone is offline. After written-design
approval, create and review the implementation plan before building this subsystem.
