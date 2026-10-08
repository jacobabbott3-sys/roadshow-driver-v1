# Beta 6A review and proposed rollout checklist

**Local preparation only. Nothing here authorizes live SQL, publication or deployment.**
Public 5/main and deployed Beta 5A are unchanged. Prepared beta builds default to
6A; existing public fallback remains 5. This is reconstructed work, not recovered
Mac commits. See [verification](beta-6a-verification.md) and [reconciliation](beta-6a-reconstruction.md).

## Required before live rollout

- [ ] Review the five forward-only files below against actual hosted schema and
  grants; check applied state manually without replaying historical SQL.
- [ ] Validate the combined migrations in a separately authorized disposable
  hosted/native PostgreSQL environment, including real simultaneous requests,
  stale snapshots, row/advisory lock ordering and rollback/retry behavior.
- [ ] Confirm hosted Auth/storage/webhook behavior and Edge runtime compatibility.
- [ ] Prepare a separately reviewed compatible public frontend rollout. Public 5
  uses old signing APIs; new wrappers intentionally fail closed. New UI requires
  new RPCs/archived columns. Neither frontend-first nor backend-first alone is
  transparent for old browsers. Plan a coordinated maintenance window and
  approved frontend/backend handoff, old-client reload notice and verification.
- [ ] Establish reviewed recovery/backup arrangements for this SQL release.
  The October 5 backup waiver was for Public 5 and is not extended here.
- [ ] Verify automatic Vercel previews with an authorized project-settings read;
  obtain specific approval before publishing if a preview can use shared backend.
- [ ] Obtain explicit live rollout authorization for both shared backend changes
  and the compatible public/frontend sequence. No main change is part of this branch.

## Proposed sequence for separate approval

1. Record actual schema/Edge deployment evidence and approved maintenance/recovery
   plan. Stop mutation traffic during the coordinated handoff, including old
   browser clients; do not rely on a beta hostname as isolation.
2. Deploy and verify the Edge exclusion for `agreement_removed` and
   `agreement_revision` **before enabling notice insertion**. Otherwise the old
   generic notification handler could send these kinds to devices.
3. Apply only reviewed missing additive SQL in order, within the approved
   maintenance handoff. Files have individual transactions; do not expose the
   partially upgraded API/schema between files. Verify grants/RLS/guards after
   each and review interruption handling before beginning:
   - `202610070001_beta_6a_agreement_storage.sql`
   - `202610070002_beta_6a_agreement_signing.sql`
   - `202610070003_beta_6a_agreement_revisions.sql`
   - `202610070004_beta_6a_agreement_notices.sql`
   - `202610070006_beta_6a_acceptance_gates.sql`
   There is no 005 SQL file: stage 5 is frontend integration.
4. Deploy separately approved compatible public and beta frontends, confirm
   channel labels and client reload behavior, and verify an isolated authorized
   account flow before resuming mutations. A source rollback alone cannot restore
   old signing after fail-closed database wrappers; use a reviewed forward repair,
   never erase immutable evidence to roll back.
5. Record actual applied state, deployment IDs and browser/account evidence.

## End-to-end acceptance from another desktop browser

Use an explicitly authorized disposable environment with synthetic users/work.
Do not run destructive or mutation acceptance against the shared live backend.

- [ ] Driver-first and admin-first: exact terms, zero/null pay/bonus/per diem,
  required/photo flags, same version, real account identity and server times.
- [ ] Assigned admin/trainee can accept driver role; inactive/unassigned cannot.
- [ ] Pay/terms/schedule/linked identity revision: inspect before/after, cancel
  without save, confirm atomically, stale/retry requests, both signatures fresh.
- [ ] Remove/replace/return accepting driver, full unassignment, preserve published
  response order; nonsigner add/remove retains acceptance; no current-work access
  through former receipt; both parties see appropriate historical evidence.
- [ ] Hotel name/address/contact/stay dates and admin notes save operationally.
- [ ] Template edits preserve IDs/flags/instructions/responses, require review,
  exclude archived rows, retain deactivated pinned template on ordinary saves.
- [ ] Pending revision preserves progress but labels acceptance pending; draft RPCs
  work, submit/review/bonus require current driver acceptance; direct and old paths
  cannot forge decisions, clear signatures, reparent requirements or delete evidence.
- [ ] Removal/revision notices are private in-app only; actual device push is absent;
  ordinary assignment/message alerts continue their authorized behavior.
- [ ] Exact historical receipt remains recipient-scoped after removal. Legacy names
  and dates are honest, with no fabricated accepted text or signer identity.
- [ ] PDF viewer/photo uploads and existing availability, external drivers, chat,
  active-account/final-admin protection and Red Folder/My Toolbag still work.
- [ ] Concurrent signing/edit/assignment requests serialize safely and reject stale
  requests without partial changes. Record evidence from independent sessions.
