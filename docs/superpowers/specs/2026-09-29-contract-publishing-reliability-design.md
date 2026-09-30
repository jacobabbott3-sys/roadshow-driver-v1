# Contract Publishing and Reliability Design

**Date:** September 29, 2026  
**Target:** Roadshow Driver Beta 5A

## Summary

The next beta will prioritize a controlled contract-publishing workflow before the first season of live testing. Administrators will publish hidden, unassigned work in system batches, users will respond from Availability, and administrators will retain final assignment control. Response order will be trustworthy and visible but will never assign a contract automatically.

The beta will keep Supabase and the current Vercel deployment. It will also include a focused reliability and search package. A backend migration, offline synchronization, and a dedicated notification-diagnostics screen are deliberately deferred to avoid first-season disruption.

## Goals

- Keep new and currently unassigned future work hidden until an administrator publishes it.
- Let an administrator publish several shows or linked-signing groups as one batch.
- Notify every active driver and administrator with one summary notification per batch.
- Record availability responses using server time and show administrators the order in which users became available.
- Keep final single- or multi-person assignment decisions with administrators.
- Support mixed assignments containing app users and named external drivers.
- Keep pay and potential bonus visible while users make availability choices.
- Add consistent search to lists that are expected to grow.
- Fix the highest-risk reliability, authorization, date, upload, and error-recovery problems found in the Beta 4A audit.
- Preserve existing assignments and avoid forcing current users or administrators into a substantially different navigation structure.

## Non-goals

- Replacing Supabase, Supabase Auth, or Supabase Storage.
- Automatically awarding work to the first respondent.
- Deadlines, bidding, waitlists, or automatic scheduling rules.
- Turning external drivers into app users or inviting them later.
- Showing external drivers in the Driver Directory.
- Allowing external drivers to sign contracts, complete checklists, use chat, or receive notifications.
- Offline checklist synchronization.
- A dedicated admin notification-diagnostics page.
- Full-message-content search in Chat.

## Product Decisions

- The admin action is labeled **Publish Contracts**.
- A publication is always a batch, even when it contains one opportunity.
- A linked-signing group is one availability opportunity and must be accepted or declined as a unit.
- Administrators always make the final assignment.
- Ranking uses the server-recorded time at which a user most recently switched to **Available**.
- Switching from Available to Unavailable and back to Available moves the user to the end of the available-response order.
- Pay remains visible in Availability because it informs availability choices.
- Every active driver and administrator receives an in-app publication notification. Device delivery follows the user's existing notification permissions and preferences.
- One batch creates one summary notification per user, not one notification per opportunity.
- External driver names are visible anywhere the assigned team is shown, but the records are otherwise admin-managed and have no account behavior.

## User Experience

### Publishing contracts

The existing **Shows & Contracts** page gains a prominent **Publish Contracts** button. It opens a release workspace rather than adding another permanent admin-navigation destination.

The workspace lists hidden, unassigned future shows and linked-signing groups. It provides:

- Search by show, artist, city, venue, or date.
- Date and A–Z sorting.
- Multi-select checkboxes and Select all.
- Setup or signing date and time.
- Contract type, pay, and potential bonus.
- Automatic all-or-none selection of linked signings.
- A confirmation dialog listing the selected opportunities and recipient count.

Confirming performs one atomic server operation. It creates the batch and its items, opens the opportunities, and creates one summary notification for every active profile. A failure rolls back the entire operation and leaves all selected work hidden.

The workspace also shows recent batches with Open, Partially assigned, Completed, or Withdrawn state. These states are derived from the states of the opportunities in the batch. An administrator can withdraw an unassigned opportunity; withdrawal hides it from driver Availability without deleting the show or its contract.

### Driver and administrator Availability

Availability shows only:

- Open published opportunities.
- Previously published opportunities that have been assigned and have not yet passed their relevant work date.
- Existing assigned future work, including assignments that predate the new publishing system.

Hidden draft work is not returned by driver-facing database queries. The newest publication batch appears first. Search covers show name, artists, venue, city, and state. Sorting supports date and A–Z.

An open card continues to show pay, potential bonus, work date, and setup/signing information. Users can choose Available or Unavailable. The app sends the choice to a server function; the browser does not supply the authoritative timestamp.

The batch notification links to `/availability?batch=<batch-id>`. The page highlights or scrolls to that batch, while still allowing users to search and browse other open work.

### Responses and final assignment

Every published opportunity has **View responses / Assign** in the admin interface. The assignment view contains:

1. Available app users ordered by `available_at`, with ordinal position and response time.
2. Unavailable app users.
3. Active app users who have not responded.
4. Existing external assignees.

Administrators may select any active app user, including a nonrespondent, and may add one or more external drivers by name. Internal and external drivers can coexist on one contract. Existing lead/trainee behavior for app users remains intact.

Saving assignments is atomic across the contract, its internal driver rows, its external driver rows, linked signings, and the publication item. Once at least one internal or external driver is assigned, the opportunity closes as Assigned. Driver-facing Availability continues to show the assigned team, including external names.

External assignees contain only a display name and assignment metadata. They do not create profiles, appear in the Directory, receive notifications, respond to availability, sign contracts, submit checklists, or participate in chat.

### Existing data rollout

The migration preserves every existing show, signing, contract, checklist, response, and assignment.

- Existing future work with an internal assignment becomes Assigned and remains visible with its team.
- Existing future work with no internal or external assignment becomes Hidden and must be published through **Publish Contracts**.
- Existing unassigned availability responses are not carried into a new publication batch. A new response is required after publication.
- Existing linked signings remain linked and are represented as one batch opportunity.
- Historical shows and contracts are not republished or altered.

## Search Coverage

A shared search-and-sort presentation will be used so placement, clear behavior, empty states, and dark-mode styling remain consistent.

This beta adds search to:

- Driver Availability.
- Admin signings.
- Contract, checklist, and toolbag templates.
- Checklist reviews.
- Resources and Red Folder.
- Directory.
- Toolbags.
- Chat conversations and people.

Contracts, admin shows, and users retain their existing search. Chat search covers thread titles and participants only; searching the full contents of historical messages is deferred.

Search is local for the bounded operational lists. Chat loads server-filtered thread summaries in pages of 50 and never downloads complete message history to search conversation titles or participants.

## Data Model

The migration adds the following tables with the stated responsibilities.

### `availability_release_batches`

- `id`
- `released_by`
- `released_at`
- `created_at`

Batch status is derived from its item states so it cannot disagree with the opportunities it contains.

### `availability_release_items`

- `id`
- `batch_id`
- `status`: Open, Assigned, or Withdrawn.
- `closed_at`
- `closed_by`

One item represents one user-facing opportunity. A normal show maps to one item. A linked-signing group also maps to one item.

### `availability_release_item_shows`

- `release_item_id`
- `show_id`

This join allows a linked-signing group to remain one opportunity while retaining its individual signing records. Database validation prevents a show from belonging to more than one open release item at a time.

### `availability_release_responses`

- `release_item_id`
- `profile_id`
- `status`: Available or Unavailable.
- `responded_at`
- `available_at`
- `updated_at`

The row is unique by release item and profile. Server code sets every timestamp. `available_at` is set to the current server time whenever a response transitions into Available and cleared when it transitions to Unavailable.

The existing `availability` table is retained for the first release as rollback-safe legacy data, but the new publishing workflow no longer writes to it. Its removal can be considered after the first season.

### `contract_external_assignees`

- `id`
- `contract_id`
- `display_name`
- `position`
- `created_by`
- `created_at`

The table has no relationship to `profiles`. External rows are returned only as assignment display data and through admin management functions.

## Server Operations and Security

Database functions provide the write boundary for publication and assignment:

- Publish a selected set of shows as one batch.
- Set the current user's response to one open release item.
- Withdraw an open release item.
- Replace internal and external assignments for one opportunity, including every contract in a linked-signing group.

Each operation validates the active profile and required role. Publication and assignment functions run in a database transaction so partial state cannot be committed.

Driver-facing reads expose only open or assigned publication items and assigned legacy work. Hidden shows are not merely filtered in React; row-level security and/or security-definer read functions prevent an authenticated non-admin from querying their unpublished details directly.

Deactivated profiles are denied protected application routes and driver database operations even if an old authentication session remains present. Admin functions continue to require an active admin. The user-management function must prevent an administrator from deactivating or demoting the final active administrator.

## Notifications

Publishing creates a notification with a dedicated `availability_release` kind. Its body summarizes the number of new opportunities, and its link targets the batch in Availability.

In-app notifications are created for every active driver and administrator. Device push is sent only when the browser has permission, an active subscription exists, and the user has enabled publication notifications. The Profile notification controls gain a **New contract batches** option enabled by default.

No new diagnostics page or notification-health interface is added. Profile retains its current device-notification enablement and preferences and gains only the **New contract batches** preference.

## Reliability Package

### Mutation feedback

Important actions use a consistent mutation state: idle, saving, success, or failure. Failures produce a visible message and Retry action where retrying is safe. Buttons always recover from rejected requests. This applies at minimum to checklist updates, availability responses, feedback, user management, publication, assignments, and profile preferences.

### Crash recovery

A top-level error boundary prevents an unexpected component error from leaving a blank screen. It displays a plain-language recovery view with Try Again and Reload App actions. Route-level failures continue to use existing page loading/error states.

### Calendar dates

Date-only comparisons stop deriving calendar dates from UTC ISO timestamps. Browser-visible filtering uses a local calendar-date helper, and database operations compare stored date values without converting them through UTC. Existing date-only fields remain date-only.

### Photo uploads and storage pressure

- Accept JPEG, PNG, and WebP images up to 20 MB and show a clear format or size error before upload.
- Leave images whose long edge is 3,200 pixels or less unchanged. Resize larger images to a 3,200-pixel long edge and encode the optimized upload as JPEG at 90% quality.
- Keep the existing in-app zoom/pan viewer as the normal way administrators inspect uploaded photos.
- If storage succeeds but the related database row fails, remove the uploaded object automatically.
- Show upload progress and preserve a retry path.

This reduces storage growth without changing storage providers immediately. Verification includes portrait, landscape, text-heavy, low-light, and already-compressed phone photos so the 3,200-pixel result remains readable when zoomed.

### Performance boundaries

The publishing work should not enlarge initial driver startup unnecessarily. New admin-only UI is route-loaded separately. Chat unread counts and conversation search must avoid repeatedly loading complete message history.

## Error Handling

- Batch publication fails as a whole if any selected opportunity is invalid, already open, assigned, or cannot be linked safely.
- A response rejected because an opportunity just closed refreshes the card and explains that assignment has already been completed.
- Concurrent admin assignments use a locked/validated database operation; the second conflicting save receives a clear stale-state error and refreshes.
- Duplicate notification creation is prevented with a batch-recipient uniqueness rule.
- External names are trimmed, required, limited to 120 characters, and unique case-insensitively within a contract. A duplicate is rejected with an inline message.
- Search failures do not erase the underlying list; remote searches display retryable errors.

## Testing and Acceptance Criteria

### Database and authorization

- Publishing multiple selections produces one batch, the correct grouped items, and one notification per active profile.
- Any validation failure rolls the entire publication back.
- Hidden work cannot be read through driver-facing APIs.
- Deactivated users cannot publish, respond, sign, check checklist items, or read assigned-only data through stale sessions.
- Response timestamps come from the server.
- Available → Unavailable → Available receives a later `available_at` value and moves behind existing available responders.
- Simultaneous responses are ordered deterministically by server time and a stable tie-breaker.
- Assignment atomically replaces internal and external assignees and closes the opportunity.
- Linked signings publish, respond, and assign as one opportunity.
- The final active administrator cannot deactivate or demote themselves.

### User interface

- Existing future unassigned work disappears from driver Availability after migration.
- Existing assigned work remains visible with the correct team.
- The Publish Contracts workspace can search, sort, select, confirm, and publish a mixed batch of shows and linked signings.
- A user receives one notification for a multi-item batch.
- Admins see response order and exact response times.
- Admins can assign internal users, external drivers, or both.
- External names appear on assigned cards but never in Directory search.
- All named search screens return expected matches and useful empty states in light and dark modes.
- Critical action failures show a message and release busy buttons.
- A simulated rendering error shows the recovery screen instead of a blank app.
- Oversized photo handling retains legible zoom detail and does not orphan storage objects after a failed database write.

### Release verification

- Type checking, linting, unit tests, and production build pass.
- New database functions are tested against a local or isolated Supabase project before the beta database is migrated.
- The migration is exercised against a copy of representative existing data, including assigned shows, unassigned shows, linked signings, availability responses, and inactive users.
- Manual mobile testing covers iPhone Safari and an Android Chromium browser for publication notifications, Availability response, assignment, search, dark mode, and photo upload.

## Rollout

1. Back up the Supabase database and storage metadata.
2. Apply the migration to the beta project only.
3. Deploy the beta app and verify the migration acceptance cases.
4. Publish a small test batch, respond from multiple accounts, and verify ordering and assignment.
5. Confirm current unassigned future work is hidden and current assignments remain intact.
6. Run a short beta with administrators before merging to the public branch.

The public deployment must not receive the migration until its compatible app build is ready. The beta and public environment release labels remain separate through the current Vercel branch workflow.
