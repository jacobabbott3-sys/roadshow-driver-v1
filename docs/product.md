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

## Prepared Beta 6A agreement behavior

Driver/admin acceptance refers to one immutable reviewed version: full text,
base pay, potential bonus, per diem, work/schedule and linked unit, issued checklist
IDs/instructions/required/photo flags. Changed accepted content reopens both
signatures after an explicit before/after confirmation. Signing supports both
orders and any eligible assigned active account, including an assigned admin.
Removing/replacing the accepting driver reopens; nonsigner roster changes retain
acceptance; returning signers need a new assignment-period acceptance.

Earlier receipts remain private to their actual signer after removal and do not
restore current work/team access. Legacy names/times remain evidence with an
explicit missing historical copy label. Checklist progress survives pending
revisions; pending acceptance is shown separately from checklist state. Drafts
remain editable through allowed RPCs; new submissions and final decisions require
current driver acceptance. Removal/revision notices are in-app only. All hotel
fields, stay dates, details-unlock timing and admin notes remain operational.
This is prepared local behavior, not a claim of deployment; see the
[Beta 6A checklist](releases/beta-6a-test-checklist.md).
