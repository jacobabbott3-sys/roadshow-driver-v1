# Product behavior

Roadshow Driver helps drivers complete assigned roadshow work and helps admins
publish, assign, and review it. The app is responsive, with a desktop sidebar and
mobile bottom navigation. This document summarizes current repository behavior;
it does not claim that every committed feature has been deployed.

## Roles and navigation

New accounts default to `driver`. Admin promotion is an intentional Supabase
operation. Both roles use Home, Contracts, Resources, and Profile; admins also
have Admin. Availability, chat, notifications, and resource pages are reachable
through the existing app links. Inactive accounts cannot use operational routes
or protected data workflows. The final active admin cannot be demoted/deactivated.

## Publishing and assigning contracts

- Admins manage **Shows & Contracts**, **Signings**, templates, and **Publish
  Contracts**. Unassigned draft work stays hidden until published.
- Publishing creates a batch, even for one contract. Linked signings form one
  availability item and must be selected/responded to/assigned together.
- Availability shows published open work and eligible assigned work, including
  legacy assignments. Cards include pay, potential bonus, dates, and location.
- Active app users respond **Available** or **Unavailable**. Server timestamps
  determine the available-response rank. Repeating Available preserves its rank;
  switching to Unavailable and back to Available creates a new available time.
- Admins choose the final team, including active nonrespondents. Response rank
  never assigns work automatically. Internal lead/trainee behavior is retained.
- Assignments close an item; fully unassigning a published item reopens it without
  deleting or retiming responses. Withdrawal hides an open item while preserving
  publication audit history.
- Outside drivers are names in team display data. They receive no account,
  directory entry, sign-in, signature/checklist privileges, chat, or notifications.
- Publication states are **Not published**, **Published — accepting responses**,
  and **Published — assigned**. Use contract terminology in user-facing copy.

## Assigned work and review

Contracts contain the work date/time, pay/bonus, terms, assigned team, checklist,
photos, and signing/review state. Setup/teardown remain the existing contract
types; one contract per show is enforced by the migration history. Show and
signing saves use atomic backend operations. Preserve linked-signing behavior,
work-detail visibility, signatures, existing checklist history, and bonus review.

Drivers complete required items and photos, then submit for admin review. Admins
review items, supply correction notes, and approve or deny work. Denied items can
be corrected/resubmitted; approved history is preserved. Do not infer permissions
from which button is visible: database policies/RPCs remain authoritative.

Photos accept JPEG, PNG, or WebP, up to 20 MiB. Supported files without browser
MIME metadata are normalized by extension. Images exceeding a 4800-pixel long
edge are resized at high quality. Native HEIC support is not promised. Uploads
have visible progress/recovery, and a failed metadata insert attempts to remove
the uploaded object. Active assigned teammates and admins can view contract
photos; unassigned/inactive users are denied. The image viewer offers zoom/pan.

## Resources and communication

Resources links to **My Toolbag**, **Driver Directory**, **Red Folder**, **FAQ**,
and **Submit Feedback**. Toolbags track assigned inventory/quantities. Directory
contains active team profiles, not external driver names. Admins publish resources,
manage toolbags/templates, and review feedback.

Red Folder contains published handbook resources, operating-guide content, and
private image/PDF attachments up to 20 MiB. Existing image resources stay images;
PDFs open in an in-app reader from **View PDF**, with previous/next-page controls,
zoom, close/Escape, and download. The viewer refreshes private links on open/retry
and preserves the Red Folder screen when closed. Loading/access/render errors
offer retry; download provides a fallback for unsupported documents. See
current-state for merge/deployment status; mobile Safari acceptance is still a
separate release check.

Chat has bounded thread summaries, paginated 50-message history, and unread
counts; search covers thread subjects/participants, not full message bodies.
In-app notifications are separate from device push. Batch publication creates
one notification per active user. Device delivery follows permissions,
subscriptions, and Profile preferences, including **New contract batches**.

Profile handles account details and account-synced light/dark/system appearance,
color schemes, Extreme Confetti Mode, and notification preferences. Recovery
screens and mutation feedback retain entered data where retry is safe. Date-only
fields use local calendar dates rather than UTC day truncation.

## Testing boundary

The admin-only Beta Test Show is a resettable beta sandbox. Keep resets isolated
from real shows. Live account/storage behavior and mobile regressions belong to
the [Beta 5A checklist](releases/beta-5a-test-checklist.md).

Sources: `src/App.tsx`, `src/components/AppShell.tsx`, `src/pages/`, `src/lib/`,
current migrations, and the [contract design](superpowers/specs/2026-09-29-contract-publishing-reliability-design.md).

### Personal iPhone presentation

The private Public 5 iPhone build uses native glass navigation, SF Symbols,
a combined Chat/Notifications/Quick Access menu and a device-local
Appearance/Color/Haptics sheet. Standard iOS tabs and a layered glass truck icon
complete the presentation. Verified administrators
also see Admin. These changes are local to the iPhone package; public website
workflows, live account data and checklist eligibility are unchanged. Closed-app
notifications remain outside this personal phase.

The personal build also applies matching glass styling to search/filter controls,
resource tiles and document toolbars; long-form reading surfaces stay solid.
The native package now includes a next-assignment widget and an explicitly started
active-checklist Live Activity. They show only the signed-in user’s own assignments,
with minimal local presentation data and stale/expired states. Progress refreshes
while the app is active; no closed-app server updates are promised. Physical-device
acceptance is tracked in [the build record](ios-personal-build.md).


In the personal iPhone build, required photo slots include shot guidance, separate
camera/library actions, preview/retake, explicit Use photo, upload confirmation,
and retry of a failed photo while the contract view remains mounted. Drafts are
memory-only and clear on leaving the contract, account re-verification, or app
termination. Device acceptance is pending; the website photo flow is unchanged.

Native route navigation suppresses duplicate web Back links while the iOS shell
is ready. Recovery screens and local actions keep their controls. The personal
app's launch and loading screens share the existing truck branding; its build uses
system fonts without the website's remote font import. Saved-first contracts and selected resources are implemented locally; installed
build and device acceptance are tracked in the offline verification record.

### Personal iPhone saved-first contracts

The personal iPhone build automatically saves explicitly assigned contracts and
checklists in private app storage. Existing screens show a usable saved copy while
account verification and fresh reads run, then update in place. Saved views are
read-only; signing, checklist updates and uploads require verified live data. A
Status screen distinguishes saved content, updating, successful refresh and errors.

Red Folder resources and contract photos/documents have explicit download/remove
controls. Only selected attachments are retained; saved PDFs open with the bundled
reader. The personal iPhone Settings tab is a navigation menu with separate
Profile, Appearance, Downloads, Notifications, and Status screens. Only Status
contains refresh and timestamp details. Other saved-content screens have no top
refresh/status strip; a read-only saved-copy label remains below the content when
needed. Automatic refresh runs at launch, after foreground account verification,
on saved changes, and periodically, rather than restarting on each tab change.
Previously loaded administrator contract views remain in account-scoped memory
for quick revisits, read-only until the current read completes. Downloads shows storage
usage and Clear downloads. Submenus use native Back when available, with a single
web fallback otherwise. Account changes discard local form drafts. The website
keeps its combined Profile page. The initial limits are
250 MiB of app storage and 20 MiB per file. Offline access requires an existing
session and an active-account verification within seven days; sign-out, account
switch or known inactive status clears the account's copies.

Quiet foreground refresh is the primary update path. iOS may also grant background
refresh while the existing short-lived access token remains valid. Closed-app
refresh is not guaranteed and requires no push service or paid membership.

### Personal iPhone swipe Back

Nested screens support a left-edge swipe that commits the existing Back action on
release after sufficient distance or a deliberate forward flick. Short, reversed
and cancelled gestures keep the current screen. Tab roots do not swipe between
tabs. Existing Back buttons remain. The gesture is disabled for dialogs, native
sheets, keyboard entry and retained/failed/uploading photo drafts. It does not
provide an interactive preview of the previous screen.
