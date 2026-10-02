# Beta 5A Search and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent search across growing lists and stop chat/admin code from making the driver experience heavier.

**Architecture:** Reuse one accessible search presentation with pure matching helpers for bounded lists, add server-filtered/paginated chat summaries for unbounded data, and lazy-load route modules so admin and photo-heavy code is not part of initial driver startup.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Supabase PostgreSQL/RPC

**Spec:** `docs/superpowers/specs/2026-09-29-contract-publishing-reliability-design.md`

## Global Constraints

- Search placement, clear behavior, empty states, and dark-mode styling are consistent.
- Search is case-insensitive and covers only fields named in the spec.
- Chat searches conversation titles and participants, not historical message bodies.
- Chat summary pages contain at most 50 threads.
- Admin-only routes are lazy-loaded.
- Existing date and A–Z sort behavior remains available where already present.

## Review Focus

- Empty or whitespace-only search must restore the date-sorted complete list; Task 1 tests normalization.
- Mixed-case and accented names must match predictably without corrupting displayed text; Task 1 tests locale normalization.
- Opening Chat with thousands of messages must fetch summaries and only the selected thread's first message page; Task 3 tests query counts.
- A new realtime message arriving during pagination must not duplicate or reorder existing messages incorrectly; Task 3 tests ID de-duplication.
- Search controls and empty states must remain readable in every existing dark-mode accent; Task 2 includes a style-state UI test and manual matrix.

---

### Task 1: Shared search model and control

**Files:**
- Create: `src/components/ListSearch.tsx`
- Create: `src/components/ListSearch.test.tsx`
- Modify: `src/lib/listControls.ts`
- Modify: `src/lib/listControls.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `normalizeListText(value): string` and `matchesListSearch(values, query): boolean` with case/diacritic normalization.
- Produces: `ListSearch({ value, onChange, placeholder, label, resultCount })` with clear button and result announcement.

- [ ] **Step 1: Write failing helper and component tests**

Assert case/diacritic matching, trimmed empty queries, clear-button focus, accessible label, result announcement, and no clear button when empty.

- [ ] **Step 2: Implement helpers and the shared control**

Preserve current `SortButton`; compose the two controls in existing toolbar markup rather than creating a second sorting abstraction.

- [ ] **Step 3: Run tests and commit**

Run: `npm test -- src/lib/listControls.test.ts && npm run test:ui -- src/components/ListSearch.test.tsx`  
Expected: PASS.

```bash
git add src/components/ListSearch.tsx src/components/ListSearch.test.tsx src/lib/listControls.ts src/lib/listControls.test.ts src/styles.css
git commit -m "Add consistent list search control"
```

### Task 2: Add search to bounded operational lists

**Files:**
- Modify: `src/pages/AdminSigningsPage.tsx`
- Modify: `src/pages/AdminTemplatesPage.tsx`
- Modify: `src/pages/AdminChecklistsPage.tsx`
- Modify: `src/pages/AdminOperationsPage.tsx`
- Modify: `src/pages/ResourcesPage.tsx`
- Modify: `src/pages/RedFolderPage.tsx`
- Modify: `src/pages/DirectoryPage.tsx`
- Modify: `src/pages/ToolbagPage.tsx`
- Modify: `src/pages/FaqPage.tsx`
- Modify: `src/pages/ContractsPage.tsx`
- Modify: `src/pages/AdminShowsPage.tsx`
- Modify: `src/pages/AdminUsersPage.tsx`
- Test: `src/pages/ListSearchCoverage.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ListSearch` and `matchesListSearch`.
- Produces: the spec's bounded-list search coverage with screen-specific fields.

- [ ] **Step 1: Write a failing coverage test table**

For each screen, render representative matches/nonmatches, clear the query, and assert the original sorted order returns. Include light/dark class states and a no-results message that repeats the query.

- [ ] **Step 2: Replace existing one-off search markup and add missing searches**

Search fields: signings by artist/venue/city/date; templates by name/type/item text; reviews by show/driver/status; the Resources landing page by card title/description; Red Folder/FAQ by title/content; Directory by name/role/phone; toolbags by number/assignee/item; contracts and shows retain their existing domain fields.

- [ ] **Step 3: Run focused tests and build**

Run: `npm run test:ui -- src/pages/ListSearchCoverage.test.tsx && npm run build`  
Expected: PASS and build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminSigningsPage.tsx src/pages/AdminTemplatesPage.tsx src/pages/AdminChecklistsPage.tsx src/pages/AdminOperationsPage.tsx src/pages/ResourcesPage.tsx src/pages/RedFolderPage.tsx src/pages/DirectoryPage.tsx src/pages/ToolbagPage.tsx src/pages/FaqPage.tsx src/pages/ContractsPage.tsx src/pages/AdminShowsPage.tsx src/pages/AdminUsersPage.tsx src/pages/ListSearchCoverage.test.tsx
git commit -m "Add search across operational lists"
```

### Task 3: Paginated chat summaries, message loading, and unread count

**Files:**
- Create: `supabase/migrations/202609290003_beta_5a_chat_performance.sql`
- Create: `supabase/tests/beta_5a_chat_performance.sql`
- Modify: `src/lib/communications.ts`
- Create: `src/lib/communications.test.ts`
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `get_chat_thread_summaries(target_search text, target_before timestamptz, target_limit integer)` capped at 50.
- Produces: `get_my_unread_chat_count() returns integer`.
- Produces: `getChatThreadSummaries({ search, before, limit })`, `getChatMessages({ threadId, before, limit })`, and `getUnreadChatCount()`.

- [ ] **Step 1: Write failing database tests**

Assert membership isolation, subject/participant search, 50-row cap, cursor pagination, latest-message preview, correct unread count, and no message-body search.

- [ ] **Step 2: Implement SQL functions and TypeScript adapters**

Fetch messages only for the selected thread in pages of 50. Merge pages and realtime inserts by message ID, then sort by `created_at, id`.

- [ ] **Step 3: Write failing client tests for page merging and realtime inserts**

Assert no duplicates, stable order, unread clearing, Load earlier behavior, and a new message arriving while an older page is loading.

- [ ] **Step 4: Update Chat and TopBar**

Add ListSearch for thread titles/participants, Load more threads, Load earlier messages, and the lightweight unread-count call. Preserve existing realtime refresh behavior without fetching every thread's history.

- [ ] **Step 5: Run database/client tests and commit**

Run: `npx supabase test db --file supabase/tests/beta_5a_chat_performance.sql && npm test -- src/lib/communications.test.ts && npm run build`  
Expected: PASS.

```bash
git add supabase/migrations/202609290003_beta_5a_chat_performance.sql supabase/tests/beta_5a_chat_performance.sql src/lib/communications.ts src/lib/communications.test.ts src/pages/ChatPage.tsx src/components/TopBar.tsx src/styles.css
git commit -m "Paginate chat and unread counts"
```

### Task 4: Route-level lazy loading and release verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LoadingScreen.tsx`
- Modify: `README.md`
- Create: `docs/releases/beta-5a-test-checklist.md`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: lazy route imports wrapped by one route-loading fallback.

- [ ] **Step 1: Write a failing route-loading test**

Assert protected driver routes show the fallback while loading, admin modules are not requested for a driver route, and a failed lazy import reaches `AppErrorBoundary`.

- [ ] **Step 2: Convert route pages to `React.lazy` imports**

Prioritize admin, photo-heavy, and chat routes. Keep tiny authentication routes eager only if doing so produces a smaller and simpler entry bundle.

- [ ] **Step 3: Run the complete verification matrix**

Run: `npm test && npm run test:ui && npm run lint && npm run build`  
Expected: all commands PASS, no new lint warnings, and the initial production JavaScript chunk is below the previous 611 KB baseline.

- [ ] **Step 4: Update README rollout checklist and commit**

Document all three Beta 5A migrations in order, the beta-only migration requirement, Vercel `VITE_RELEASE_VERSION=5A`, notification preference change, database/storage backup, representative-data migration checks, a multi-account response-order test, and manual iPhone Safari/Android Chromium checks.

```bash
git add src/App.tsx src/App.test.tsx src/components/LoadingScreen.tsx README.md docs/releases/beta-5a-test-checklist.md
git commit -m "Lazy load Beta 5A routes"
```
