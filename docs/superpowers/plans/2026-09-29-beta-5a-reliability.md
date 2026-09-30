# Beta 5A Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden authorization, saves, date handling, crashes, and photo uploads before first-season testing.

**Architecture:** Enforce account activity and multi-step integrity in PostgreSQL, add reusable React error/mutation boundaries, and isolate date and image processing into testable utilities. Preserve current routes and Supabase services while making failures visible and recoverable.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Supabase PostgreSQL/RLS/RPC, Supabase Storage

**Spec:** `docs/superpowers/specs/2026-09-29-contract-publishing-reliability-design.md`

## Global Constraints

- Deactivated accounts must be blocked even when an old auth session remains valid.
- The final active administrator cannot deactivate or demote themselves.
- Important actions expose Saving, Saved, Failed, and safe Retry behavior.
- Browser-local calendar dates must not be derived from UTC ISO strings.
- JPEG, PNG, and WebP uploads are accepted up to 20 MB.
- Images above 3,200 pixels on the long edge are resized to 3,200 pixels and JPEG quality 90%; smaller images remain unchanged.
- Failed database inserts must remove their newly uploaded storage object.
- Supabase and the existing storage buckets remain in place.

## Review Focus

- A deactivated user with a cached session must see the inactive-account screen and fail direct driver RPC calls; Tasks 1 and 3 test both layers.
- A sole active admin changing their own role must be rejected without changing the profile; Task 1 tests this transaction.
- A network failure after storage upload must delete only the newly uploaded object, never an earlier photo; Task 5 tests exact paths.
- A 20 MB boundary file and a 3,200-pixel boundary image must not be unnecessarily rejected or recompressed; Task 5 tests inclusive thresholds.
- At 8 PM Mountain Time, a same-day date must remain today rather than advancing with UTC; Task 4 tests a fixed clock/timezone.

---

### Task 1: Active-account and final-admin database enforcement

**Files:**
- Create: `supabase/migrations/202609290002_beta_5a_reliability.sql`
- Create: `supabase/tests/beta_5a_reliability.sql`

**Interfaces:**
- Produces: `is_active_user() returns boolean`.
- Replaces: `admin_update_user(target_user, new_role, new_active)` with final-active-admin protection.
- Hardens: contract, checklist, photo, availability-release, notification, resource, chat, and assignment policies/functions to require an active profile.

- [ ] **Step 1: Write failing pgTAP authorization tests**

Cover active driver access, stale-session inactive denial, active admin access, inactive admin denial, self-deactivation, sole-admin demotion, and demotion when another active admin exists.

- [ ] **Step 2: Add `is_active_user()` and harden RLS/RPC guards**

Allow an authenticated user to read their own profile so the client can explain deactivation, but require `is_active_user()` for all operational data and mutations.

- [ ] **Step 3: Replace `admin_update_user` with final-admin-safe logic**

Lock active admin profile rows during the count/update decision to prevent concurrent demotions from removing all admins.

- [ ] **Step 4: Run database tests and commit**

Run: `npx supabase test db --file supabase/tests/beta_5a_reliability.sql`  
Expected: PASS.

```bash
git add supabase/migrations/202609290002_beta_5a_reliability.sql supabase/tests/beta_5a_reliability.sql
git commit -m "Enforce active account authorization"
```

### Task 2: Shared mutation feedback

**Files:**
- Create: `src/hooks/useMutationFeedback.ts`
- Create: `src/hooks/useMutationFeedback.test.tsx`
- Create: `src/components/MutationNotice.tsx`

**Interfaces:**
- Produces: `useMutationFeedback()` returning `{ state, message, run, retry, clear }`, where `state` is `idle | saving | saved | failed`.
- Produces: `MutationNotice({ state, message, onRetry, onDismiss })`.
- Consumes: the `npm run test:ui` foundation from Task 2 of the contract-publishing plan.

- [ ] **Step 1: Write failing hook tests**

Assert saving state, success text, rejected-action recovery, safe retry of the latest action, no retry for non-retryable actions, and clearing stale messages before a new run.

- [ ] **Step 2: Implement the hook and notice component**

Keep error conversion in one helper so Supabase errors, `Error`, and unknown failures produce consistent plain-language messages.

- [ ] **Step 3: Run node and UI tests**

Run: `npm test && npm run test:ui`  
Expected: both suites PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMutationFeedback.ts src/hooks/useMutationFeedback.test.tsx src/components/MutationNotice.tsx
git commit -m "Add recoverable mutation feedback"
```

### Task 3: Inactive-account and app-crash recovery screens

**Files:**
- Create: `src/components/AppErrorBoundary.tsx`
- Create: `src/components/AppErrorBoundary.test.tsx`
- Create: `src/pages/InactiveAccountPage.tsx`
- Test: `src/components/ProtectedRoute.test.tsx`
- Modify: `src/components/ProtectedRoute.tsx`
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: profile `is_active` and current sign-out action.
- Produces: top-level recovery UI with **Try Again** and **Reload App**.
- Produces: inactive-account view with explanatory copy and **Sign out**.

- [ ] **Step 1: Write failing boundary and route tests**

Assert a thrown child renders recovery instead of blank output, Try Again remounts the child, Reload calls `location.reload`, inactive users never render protected content, and active admins still reach admin routes.

- [ ] **Step 2: Implement the error boundary and inactive route handling**

Do not sign inactive users out automatically; they must be able to read the explanation and choose Sign out.

- [ ] **Step 3: Run focused tests and build**

Run: `npm run test:ui -- src/components/AppErrorBoundary.test.tsx src/components/ProtectedRoute.test.tsx && npm run build`  
Expected: PASS and build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppErrorBoundary.tsx src/components/AppErrorBoundary.test.tsx src/pages/InactiveAccountPage.tsx src/components/ProtectedRoute.tsx src/components/ProtectedRoute.test.tsx src/context/AuthContext.tsx src/main.tsx src/styles.css
git commit -m "Add account and crash recovery screens"
```

### Task 4: Safe local calendar dates and surfaced query errors

**Files:**
- Create: `src/lib/calendarDate.ts`
- Create: `src/lib/calendarDate.test.ts`
- Modify: `src/lib/adminData.ts`
- Modify: `src/lib/driverData.ts`
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- Produces: `localDateKey(date = new Date()): string`, `parseDateOnly(value): Date`, and `compareDateOnly(a, b): number`.

- [ ] **Step 1: Write failing fixed-clock tests**

Run tests with `TZ=America/Denver` for evening UTC rollover, midnight, daylight-saving transitions, and date-only round trips.

- [ ] **Step 2: Implement the helpers and replace `toISOString().slice(0, 10)` date filters**

Use noon-local parsing for display-only date fields and leave true timestamps such as signing time as timestamps.

- [ ] **Step 3: Make dashboard count queries throw on any Supabase error**

Do not convert failed counts into zero. The existing PageState error UI must receive the failure.

- [ ] **Step 4: Run tests and build, then commit**

Run: `TZ=America/Denver npm test -- src/lib/calendarDate.test.ts && npm run build`  
Expected: PASS.

```bash
git add src/lib/calendarDate.ts src/lib/calendarDate.test.ts src/lib/adminData.ts src/lib/driverData.ts src/pages/HomePage.tsx
git commit -m "Fix local date and dashboard failures"
```

### Task 5: Resilient, storage-conscious photo uploads

**Files:**
- Create: `src/lib/imageUpload.ts`
- Create: `src/lib/imageUpload.test.ts`
- Modify: `src/pages/ContractDetailPage.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `validatePhoto(file): void`.
- Produces: `preparePhoto(file): Promise<{ file: File; width: number; height: number; optimized: boolean }>`.
- Produces: `uploadContractPhoto({ contractId, userId, slot, file, onProgress }): Promise<void>` with compensating storage deletion after database failure.

- [ ] **Step 1: Write failing validation and transformation tests**

Assert accepted MIME types, the inclusive 20 MB limit, unchanged 3,200-pixel images, 3,201-pixel resizing, 90% JPEG encoding, filename normalization, and exact-path cleanup after a simulated database failure.

- [ ] **Step 2: Implement validation, canvas-based resizing, and upload compensation**

Generate the storage path once, upload the prepared file, insert its database row, and remove only that generated path if the insert fails.

- [ ] **Step 3: Integrate progress and retry UI in contract photo slots**

Reset the file input after each attempt so selecting the same file can retry. Preserve existing zoom/pan viewing.

- [ ] **Step 4: Run focused tests, manually inspect representative fixtures, and build**

Run: `npm test -- src/lib/imageUpload.test.ts && npm run build`  
Expected: PASS and build succeeds. Manually verify portrait, landscape, text-heavy, low-light, and compressed photos at zoom.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageUpload.ts src/lib/imageUpload.test.ts src/pages/ContractDetailPage.tsx src/styles.css
git commit -m "Harden contract photo uploads"
```

### Task 6: Apply mutation feedback and transactional admin saves

**Files:**
- Modify: `supabase/migrations/202609290002_beta_5a_reliability.sql`
- Modify: `supabase/tests/beta_5a_reliability.sql`
- Modify: `src/lib/adminData.ts`
- Modify: `src/lib/pushNotifications.ts`
- Modify: `src/pages/ContractDetailPage.tsx`
- Modify: `src/pages/AvailabilityPage.tsx`
- Modify: `src/pages/FeedbackPage.tsx`
- Modify: `src/pages/AdminUsersPage.tsx`
- Modify: `src/pages/AdminShowsPage.tsx`
- Modify: `src/pages/AdminSigningsPage.tsx`
- Modify: `src/pages/ProfilePage.tsx`

**Interfaces:**
- Produces: `admin_save_show_contract(target_payload jsonb) returns uuid` and `admin_save_signing(target_payload jsonb) returns uuid`.
- Produces: `ShowContractSavePayload` with nullable show/contract IDs, show name/dates/location/details, contract kind/work date/work time/pay/bonus/terms, checklist template ID, internal driver IDs, and external driver names.
- Produces: `SigningSavePayload` with nullable show/contract IDs, artist/signing/setup/venue/location fields, checklist template ID, linked show IDs, internal driver IDs, and external driver names.
- Consumes: `useMutationFeedback` and `MutationNotice` from Task 2.

- [ ] **Step 1: Add failing database tests for mid-save validation rollback**

Assert show/contract/checklist saves and signing/contract/link saves leave no partial changes when their last validation fails.

- [ ] **Step 2: Implement the two transactional save RPCs and update TypeScript adapters**

Replace the current client sequences in `saveShowContract` and signing save/link propagation. Keep the public TypeScript call sites narrow and typed.

- [ ] **Step 3: Change notification-preference saving from update to upsert**

Verify a missing preference row is created and an existing row is updated.

- [ ] **Step 4: Apply shared mutation feedback to the named critical pages**

Checklist toggles and availability responses must refresh after rejected writes; feedback prevents duplicate submissions; user-management and profile buttons always leave busy state in `finally` behavior supplied by the hook.

- [ ] **Step 5: Run database, node, UI, lint, and build verification**

Run: `npx supabase test db --file supabase/tests/beta_5a_reliability.sql && npm test && npm run test:ui && npm run lint && npm run build`  
Expected: all commands PASS with no new warnings.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609290002_beta_5a_reliability.sql supabase/tests/beta_5a_reliability.sql src/lib/adminData.ts src/lib/pushNotifications.ts src/pages/ContractDetailPage.tsx src/pages/AvailabilityPage.tsx src/pages/FeedbackPage.tsx src/pages/AdminUsersPage.tsx src/pages/AdminShowsPage.tsx src/pages/AdminSigningsPage.tsx src/pages/ProfilePage.tsx
git commit -m "Make critical saves atomic and recoverable"
```
