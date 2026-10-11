# Native Settings submenu refinement

October 11, 2026 follow-up to `a38f45b`, requested after the stacked Settings layout
was rejected. Same local personal Public 5 checkout and existing signing.

## Result

Settings is a compact navigation list. Profile, Appearance, Downloads,
Notifications, and Status open distinct routes under `/profile/*`. Profile retains
contact details, availability access and Sign out. Appearance retains the existing
iPhone appearance sheet and confetti preference. Downloads retains private saved
file controls. Notifications retains alert preferences. Only Status opts into the
manual Refresh control. Saved contract/resource notices remain passive and still
identify read-only copies; automatic launch, route, mutation and periodic refresh
remain unchanged. Native assignment dialogs also omit Refresh responses while
retaining automatic opening/conflict recovery loads.

Back uses the existing native history/parent behavior, with Back to settings only
when the native shell is unavailable. Routes remain under the existing protected
account gate, never the saved-content allowlist. Keying Settings by account ID
resets form state and prevents late old-account notification reads from populating
the replacement account's form. No auth, lease, ownership, or storage policy was
relaxed. No live backend writes or remote publication were performed.

## Local verification

- Before implementation, all four initial navigation regression tests failed on
  the old stacked screen. After implementation, the expanded six-test suite passed.
- Two repeated passes through every submenu using fallback Back and native Back;
  no duplicate web Back link when native shell is ready; cold submenu parent Back.
- Profile drafts reset on leaving/reopening and account replacement. Every submenu
  remains navigable after account replacement. A late prior-account notification
  response does not alter the replacement account's switches.
- Saved-contract UI asserts no Refresh button while its read-only notice remains.
  Status refresh verifies the account when needed and otherwise refreshes data.
- Full suite: 78 unit tests, 109 UI tests across 40 files, 2 native pipeline tests.
- Web build passed. Lint: 0 errors and the existing 3 warnings. The first lint
  approval review timed out; the single permitted retry succeeded.
- Fresh native sync and signed Xcode 27.2 build passed with the existing personal
  signing. No provisioning-update flag or new signing configuration was used.

## Device evidence and limits

Device Hub initially showed Hoid's lock screen. Later, `devicectl device install
app` confirmed installation of the newly signed app, and `device process launch`
confirmed successful launch. Device Hub then showed the running Roadshow app.
No unlock/security prompt was bypassed.

Read-only on-device inspection opened Profile, Appearance, Downloads, Notifications,
and Status and returned from each with native Back. No duplicate web Back links
were visible. The existing native Appearance sheet opened and was dismissed without
changing preferences. Status displayed Refresh; Home and Contracts displayed only
passive freshness text. Contracts rendered after its initial route-loading screen;
no cold-launch/network latency benchmark is claimed. The phone was left on the
Settings menu. No profile/preferences were saved, downloads cleared, assignments
changed, or test uploads performed.

Repeated navigation (two passes per submenu with both native and fallback Back),
account replacement on every submenu, and late old-account notification responses
were verified using automated fixtures. A physical sign-out/account-switch was not
performed on Jacob's live session. Wider offline/airplane-mode acceptance remains
outside this layout refinement.

Signing, icon and existing config copies remain outside this change. No credentials,
private user data, device screenshots or raw transcripts are committed.
