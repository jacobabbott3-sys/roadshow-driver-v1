# Agreement Versions Implementation Plan — reconstructed

> **For agentic workers:** Use superpowers:executing-plans for implementation and fresh independent reviewers after each stage and for the whole branch.

**Goal:** Implement the approved Beta 6A agreement feature locally without changing Public 5 or the shared backend.

**Architecture:** Immutable database evidence plus current-version RPCs. One canonical transactional preview/commit path protects normalized edits and assignment identity. UI renders issued copies and private history; database gates enforce acceptance.

**Tech Stack:** Existing React/TypeScript, Supabase PostgreSQL, Node 24/npm 11.5.2; isolated PostgreSQL runtime for synthetic tests.

**Spec:** `docs/superpowers/specs/2026-10-07-agreement-versions-design.md`

## Global constraints

- Preserve driver/admin, assigned-admin signing, active-account checks, final-admin protection, terminology, availability ordering and external-name semantics.
- Public 5/main and live Supabase/Vercel unchanged; no live SQL, notices, credentials, previews or publication without specified authorization.
- Exact text, null versus zero, source IDs and evidence remain immutable; no manufactured legacy receipts.
- Hotel details and stay dates are operational edits, per Jacob's October 7 decision.
- Seven independently reviewed stages, focused tests first, separate dependency commit.

## Review focus

- Old browser clients, direct writes and cascade deletion must not bypass new evidence boundaries.
- A returning former signer must not regain current acceptance or private access via receipt access.
- Template replacement must not silently move issued checklists, lose IDs/flags/responses or reject deactivated pinned templates.
- JSON null, whitespace, amounts, dates and linked rosters must have identical preview/commit results.
- Concurrent signing and edits must serialize; test runtime limitations must be explicit.

## Preparation

- [ ] Record baseline and scoped audit fixes separately; rerun all four checks and current registry audit.
- [ ] Save this reconstructed design/plan and reconciliation record; create execution ledger.
- [ ] Prepare disposable SQL fixtures with auth identities, real roles/RLS and synthetic rows only.

### Task 1: Immutable storage and integrity/security

**Files:** `supabase/migrations/202610070001_beta_6a_agreement_storage.sql`, `scripts/test-agreements.mjs`, `supabase/tests/agreement-fixture.sql`.
**Produces:** version, signature and assignment-period tables; `agreement_content(uuid) → jsonb`; private mutation context; immutable/delete guards.
- [ ] Write SQL assertions denying evidence update/delete, direct signature writes, cascade deletion and unauthorized reads; observe failure before migration.
- [ ] Implement immutable tables, restrictive FKs, RLS/grants and source-ID snapshot builder without legacy backfill.
- [ ] Run real role tests, inspect grants/search paths and obtain fresh independent review; fix findings and commit.

### Task 2: Signing/review/history APIs

**Files:** `supabase/migrations/202610070002_beta_6a_agreement_signing.sql`, SQL tests.
**Consumes:** Task 1 content/evidence/periods. **Produces:** `get_contract_agreement(uuid) → jsonb`, `accept_contract_agreement(uuid,uuid,text,text) → uuid`, `get_my_agreement_history() → jsonb`.
- [ ] Test both signing orders, assigned admin/trainee, inactive/unassigned denial, duplicate/stale signing, period binding, recipient-only history and legacy labeling.
- [ ] Implement authenticated/server-timed acceptance, safe current-version issuance and fail-closed old signing RPC.
- [ ] Run focused role tests, independently review and commit.

### Task 3: Confirmed edits and assignments

**Files:** `supabase/migrations/202610070003_beta_6a_agreement_revisions.sql`, SQL tests.
**Produces:** `preview_agreement_change(text,jsonb) → jsonb`, `commit_agreement_change(text,jsonb,text) → uuid`; wrappers for existing saves/assignments/templates.
- [ ] Test normalized preview equality, stale token, atomic rollback, pay/terms revision, signer removal/return/full unassignment, retained/nonsigner periods, JSON null and deactivated templates.
- [ ] Implement canonical mutations, consistent locking, protected context, confirmed consequences and version creation.
- [ ] Test template-edit bypass plus matching IDs/flags/responses and linked-work effects; independently review and commit.

### Task 4: Private in-app notices

**Files:** additive notice migration; `supabase/functions/web-push/index.ts`, shared push policy tests.
**Consumes:** Task 3 before/after and signatures. **Produces:** idempotent recipient-only removal/revision notices and explicit push exclusion.
- [ ] Test removed-recipient reads without current access and denial to other recipients/admins; test explicit push exclusion.
- [ ] Implement minimal historical links, no external channel, no real sends; independently review and commit.

### Task 5: Driver/admin UI

**Files:** `src/lib/agreementData.ts`, agreement components/history route; `ContractDetailPage`, admin saves/signing/assignment pages and UI tests.
**Consumes:** Tasks 2–4 RPCs. **Produces:** exact reviewed copy, version-bound acceptance, explicit edit consequences, private historical receipts and honest legacy/pending states.
- [ ] Write behavior tests for signing/review, canceled/stale preview and history/legacy display.
- [ ] Integrate all signing/edit paths without browser timestamps; preserve terminology and operational work.
- [ ] Run UI/build/lint, independently review and commit.

### Task 6: Operational gates

**Files:** additive operational migration, driver/admin gate UI and SQL tests.
**Produces:** DB-enforced current driver-acceptance gate for submission/final decisions, preserved draft progress.
- [ ] Test old RPC/direct status bypass, pending revisions, historical acceptance, draft progress and completed-item preservation.
- [ ] Implement gate under the same contract locking discipline, retain existing required-item checks.
- [ ] Run focused authorization tests, independently review and commit.

### Task 7: Integrated verification and rollout proposal

**Files:** Beta 6A verification/checklist, product/architecture/decisions/current-state updates, draft PR and reconciliation record.
- [ ] Run synthetic end-to-end scenarios and concurrent requests if supported; all four required checks plus fresh audit/clean installation.
- [ ] Obtain whole-branch independent review; fix material findings with regression tests.
- [ ] Document exact migration dependencies, public old-client compatibility and deploy-order risks; do not claim live verification.
- [ ] Verify remote beta/main and Vercel automatic-preview behavior read-only; hold publication if it triggers a preview.
- [ ] Commit locally, prepare full patch/durable artifact and draft PR targeting beta, report exact evidence and specific required approval.
