# Beta 5A Contract Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Beta 5A batch publishing, ordered availability response, notification, and mixed internal/external assignment workflow.

**Architecture:** Add transactional PostgreSQL functions around dedicated release-batch tables, keep the legacy `availability` table untouched for rollback, and expose the workflow through a focused TypeScript data module. A new route-launched publishing workspace and a reusable assignment dialog keep the existing admin navigation recognizable.

**Tech Stack:** React 19, TypeScript, Vite, Supabase PostgreSQL/RLS/RPC, Supabase Realtime, Supabase Edge Functions, Web Push

**Spec:** `docs/superpowers/specs/2026-09-29-contract-publishing-reliability-design.md`

## Global Constraints

- The release label is `Beta 5A`; the corresponding approved public release will be `Public 5`.
- Supabase Auth, Database, Storage, and Vercel remain in place.
- The admin action copy is exactly **Publish Contracts**.
- New and currently unassigned future work is hidden until published.
- Pay and potential bonus remain visible in Availability.
- Administrators always make the final assignment; response order never auto-assigns.
- A linked-signing group is one indivisible availability opportunity.
- One batch produces one in-app notification per active profile.
- External drivers never create profiles or Directory entries.
- Database timestamps, not browser timestamps, determine response order.

## Review Focus

- Cyclic or duplicate signing links must produce one release item containing each linked signing once; Task 1 pins this with a database test.
- Two admins publishing the same show concurrently must yield one success and one clear conflict without duplicate open items; Task 1 tests the unique-open guard.
- Two responses with the same timestamp must still have deterministic order; Task 1 tests the `available_at, id` tie-breaker.
- A stale assignment dialog must not overwrite an assignment completed by another admin; Task 6 tests the expected-item-state guard.
- Migration must hide old unassigned work while preserving assigned future work without sending notifications; Task 1 tests both data classes.

---

### Task 1: Release schema, migration, and transactional RPCs

**Files:**
- Create: `supabase/migrations/202609290001_beta_5a_contract_publishing.sql`
- Create: `supabase/tests/beta_5a_contract_publishing.sql`

**Interfaces:**
- Produces: `admin_get_publishable_opportunities()` returning grouped opportunity rows with `show_ids uuid[]`, title, event type, location, work time, kind, pay, and bonus.
- Produces: `admin_publish_availability_batch(target_show_ids uuid[]) returns uuid`.
- Produces: `get_my_published_availability()` returning batches, item states, grouped shows, the caller's response, and internal/external assignees.
- Produces: `set_my_release_response(target_release_item uuid, target_status text) returns timestamptz`.
- Produces: `admin_get_release_responses(target_release_item uuid)` returning active profiles, status, `available_at`, and ordinal rank.
- Produces: `admin_replace_opportunity_assignments(target_release_item uuid, target_show_ids uuid[], target_driver_ids uuid[], target_external_names text[]) returns void`; `target_release_item` may be null for a direct manual assignment.
- Produces: `admin_withdraw_release_item(target_release_item uuid) returns void`.

- [ ] **Step 1: Write pgTAP tests for schema constraints, grouping, server timestamps, deterministic ranking, publication conflicts, migration visibility, atomic rollback, external-name uniqueness, and assignment closure**

Run: `npx supabase test db --file supabase/tests/beta_5a_contract_publishing.sql`  
Expected before implementation: FAIL because the release tables and functions do not exist.

- [ ] **Step 2: Add the release tables, response table, external-assignee table, indexes, enum/check constraints, and RLS policies**

Use the exact table names from the spec. Add `notification_preferences.availability_release_alerts boolean not null default true`. Enforce one open item per show, one notification per batch/recipient, case-insensitive external-name uniqueness per contract, a maximum external name length of 120 characters, and active-profile checks on every driver/admin function.

- [ ] **Step 3: Implement the seven RPC interfaces as single-transaction functions**

The publish function expands connected signing graphs, groups them once, rejects assigned or already-open work, and inserts notifications after all items validate. The assignment function locks the item, validates its current state and show membership, replaces all internal/external rows, propagates linked-signing assignments, and closes the item only after the replacements succeed. When `target_release_item` is null, it performs a silent direct assignment without creating a release batch.

- [ ] **Step 4: Add migration data handling**

Create assigned release items for future assigned work without notifications. Leave future unassigned work without a release item. Preserve all legacy `availability` rows without reading or writing them from the new functions.

- [ ] **Step 5: Run the database tests**

Run: `npx supabase test db --file supabase/tests/beta_5a_contract_publishing.sql`  
Expected: PASS for every pgTAP assertion.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609290001_beta_5a_contract_publishing.sql supabase/tests/beta_5a_contract_publishing.sql
git commit -m "Add transactional contract publishing schema"
```

### Task 2: UI-test foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`

**Interfaces:**
- Produces: `npm run test:ui` using Vitest with jsdom and Testing Library.

- [ ] **Step 1: Add Vitest, jsdom, Testing Library, and the jsdom setup file**

Keep the current Node test command as `npm test`; UI/component tests run through the separate `test:ui` script.

- [ ] **Step 2: Write a smoke test that renders a React component and uses jest-dom assertions**

Run: `npm run test:ui -- src/test/smoke.test.tsx`  
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/test/smoke.test.tsx
git commit -m "Add React UI test foundation"
```

### Task 3: Publishing and availability domain layer

**Files:**
- Create: `src/lib/availabilityData.ts`
- Create: `src/lib/availabilityModel.ts`
- Create: `src/lib/availabilityModel.test.ts`
- Modify: `src/types.ts`
- Modify: `src/lib/driverData.ts`
- Modify: `src/lib/adminData.ts`

**Interfaces:**
- Consumes: Task 1 RPCs.
- Produces: `PublishableOpportunity`, `AvailabilityBatch`, `AvailabilityOpportunity`, `AvailabilityResponsePerson`, and `AssignmentDisplay` types. `AvailabilityOpportunity.batch_id` is `string | null`; directly assigned and migrated legacy work uses null and appears under **Assigned work** rather than a release batch.
- Produces: `getPublishableOpportunities()`, `publishContractBatch(showIds)`, `getPublishedAvailability()`, `setReleaseResponse(itemId, status)`, `getReleaseResponses(itemId)`, `replaceOpportunityAssignments(input)`, and `withdrawReleaseItem(itemId)`.
- Produces: pure `filterOpportunities`, `sortOpportunities`, and `rankAvailabilityResponses` helpers.

- [ ] **Step 1: Write failing model tests**

Test linked groups as one result, case-insensitive multi-field search, date/A–Z ordering, newest-batch ordering, available-first ranking, unavailable/nonrespondent ordering, and stable timestamp ties.

Run: `node --experimental-strip-types --test src/lib/availabilityModel.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the types, pure model helpers, and RPC adapters**

Remove the new UI's dependency on `getAvailability`, `setAvailability`, and `setAvailabilityMany`; retain those exports only if another current screen still imports them.

- [ ] **Step 3: Run unit tests and type checking**

Run: `node --experimental-strip-types --test src/lib/availabilityModel.test.ts && npm run build`  
Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/availabilityData.ts src/lib/availabilityModel.ts src/lib/availabilityModel.test.ts src/types.ts src/lib/driverData.ts src/lib/adminData.ts
git commit -m "Add contract publishing data model"
```

### Task 4: Publish Contracts workspace

**Files:**
- Create: `src/pages/AdminPublishContractsPage.tsx`
- Modify: `src/pages/AdminShowsPage.tsx`
- Modify: `src/pages/AdminSigningsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getPublishableOpportunities()`, `publishContractBatch(showIds)`, `withdrawReleaseItem(itemId)`, and Task 3 filtering/sorting helpers.
- Produces: route `/admin/shows/publish` launched by **Publish Contracts** from both show and signing admin pages.

- [ ] **Step 1: Write a failing UI smoke test for selection and confirmation**

Create `src/pages/AdminPublishContractsPage.test.tsx` with the Task 2 UI-test setup. Assert linked-group all-or-none selection, Select all, pay/bonus confirmation details, and one publish call containing unique show IDs.

- [ ] **Step 2: Build the publishing workspace**

Implement search, SortButton date/A–Z modes, multi-select, Select all, confirmation, success/failure feedback, recent-batch states, and withdrawal. Disable publishing while the transaction runs and retain the selection after a failed request.

- [ ] **Step 3: Add the route and launch buttons**

Use the exact label **Publish Contracts**. Do not add a permanent AdminNav item.

- [ ] **Step 4: Add responsive and dark-mode styles**

Verify mobile cards expose selection, pay, date, and status without horizontal scrolling.

- [ ] **Step 5: Run focused tests and build**

Run: `npm run test:ui -- src/pages/AdminPublishContractsPage.test.tsx && npm run build`  
Expected: PASS and production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPublishContractsPage.tsx src/pages/AdminPublishContractsPage.test.tsx src/pages/AdminShowsPage.tsx src/pages/AdminSigningsPage.tsx src/App.tsx src/styles.css
git commit -m "Build Publish Contracts workspace"
```

### Task 5: Batch-based driver Availability

**Files:**
- Modify: `src/pages/AvailabilityPage.tsx`
- Modify: `src/styles.css`
- Test: `src/pages/AvailabilityPage.test.tsx`

**Interfaces:**
- Consumes: `getPublishedAvailability()`, `setReleaseResponse(itemId, status)`, and Task 3 model helpers.
- Produces: batch-grouped Availability UI honoring `?batch=<id>`.

- [ ] **Step 1: Write failing UI tests**

Assert hidden work is absent, newest batch is first, batch deep links highlight the target, pay/bonus remain visible, linked signings have one all-or-none response control, and Available → Unavailable → Available displays refreshed ordering after reload.

- [ ] **Step 2: Replace legacy show-based loading with batch loading**

Show Open, Assigned, and Withdrawn/closed states according to the spec. A response rejected because the item closed must refresh and explain the closure instead of silently reverting.

- [ ] **Step 3: Add Availability search and existing date/A–Z sort controls**

Search title, artists, venue, city, and state. Keep response controls keyboard accessible and dark-mode legible.

- [ ] **Step 4: Run focused tests and build**

Run: `npm run test:ui -- src/pages/AvailabilityPage.test.tsx && npm run build`  
Expected: PASS and production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AvailabilityPage.tsx src/pages/AvailabilityPage.test.tsx src/styles.css
git commit -m "Show published availability batches"
```

### Task 6: Ordered response and mixed assignment dialog

**Files:**
- Create: `src/components/AssignmentDialog.tsx`
- Test: `src/components/AssignmentDialog.test.tsx`
- Modify: `src/pages/AdminShowsPage.tsx`
- Modify: `src/pages/AdminSigningsPage.tsx`
- Modify: `src/pages/AdminPublishContractsPage.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getReleaseResponses(itemId)` and `replaceOpportunityAssignments(input)`.
- Produces: `AssignmentDialog({ releaseItemId, showIds, title, onSaved, onClose })` supporting ranked responders, other active users, and external names.

- [ ] **Step 1: Write failing dialog tests**

Assert ordinal response order and times, manual nonrespondent selection, mixed internal/external save, duplicate external-name rejection, external-name removal, stale-state refresh, and preserved selections after a non-conflict network failure.

- [ ] **Step 2: Implement the accessible assignment dialog**

Trap and restore focus, label the dialog, allow multiple external names up to 120 characters, show existing assignees, and clearly distinguish Lead, Team, External, Unavailable, and No response.

- [ ] **Step 3: Replace existing assignment controls with the shared dialog**

Keep direct manual assignment available for hidden work and use release-item assignment for published work. Refresh shows, signings, batches, and Availability-derived state after success.

- [ ] **Step 4: Run focused tests and build**

Run: `npm run test:ui -- src/components/AssignmentDialog.test.tsx && npm run build`  
Expected: PASS and production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/AssignmentDialog.tsx src/components/AssignmentDialog.test.tsx src/pages/AdminShowsPage.tsx src/pages/AdminSigningsPage.tsx src/pages/AdminPublishContractsPage.tsx src/styles.css
git commit -m "Add ordered mixed-driver assignment"
```

### Task 7: Batch notifications and Beta 5A labeling

**Files:**
- Modify: `src/lib/pushNotifications.ts`
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `supabase/functions/web-push/index.ts`
- Modify: `src/lib/communications.ts`
- Modify: `vite.config.ts`
- Modify: `README.md`
- Test: `src/lib/buildConfig.test.ts`

**Interfaces:**
- Consumes: Task 1 `availability_release` notifications and `/availability?batch=<id>` links.
- Produces: `availability_release_alerts` preference enabled by default and honored by Web Push.

- [ ] **Step 1: Extend failing preference and release-label tests**

Assert Beta fallback `5A`, Public fallback remains `4` until promotion, default publication alerts are true, and preference saves include `availability_release_alerts`.

- [ ] **Step 2: Add the profile preference and Edge Function routing**

In-app publication notifications always exist. Push skips publication alerts only when the user disabled **New contract batches**, disabled device notifications, or has no valid subscription.

- [ ] **Step 3: Update release documentation**

Document Beta 5A, the new migration, and the Vercel beta environment value `VITE_RELEASE_VERSION=5A`. Do not change the public environment to `5` until promotion.

- [ ] **Step 4: Run all publishing tests and build**

Run: `npm test && npm run test:ui && npm run build`  
Expected: all tests PASS and build output labels beta as `5A` when no environment override exists.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pushNotifications.ts src/pages/ProfilePage.tsx supabase/functions/web-push/index.ts src/lib/communications.ts vite.config.ts README.md src/lib/buildConfig.test.ts
git commit -m "Add batch publication notifications"
```
