# Draft PR prepared locally

Target: existing `beta`; source: `feat/beta-6a-agreement-reconstruction`.
Jacob approved publishing the feature branch and opening a draft PR on
October 7 (Denver), including automatic Vercel previews that may use shared
Supabase. Project-settings verification remains blocked by 403. This authorization
does not cover live SQL, merging or public release.

Title: **Beta 6A: immutable agreement versions, reviewed revisions and private receipts**

## Body

Drivers and administrators now review and accept the same immutable agreement
version with authenticated identity and server time. Pay, terms, schedule,
linked-work identity and issued checklist changes require an explicit normalized
preview and fresh signatures, while preserving earlier evidence and checklist
progress. Removal/return uses real assignment periods; nonsigner roster changes
retain acceptance. Former signers receive private historical receipts and
recipient-only in-app notices explicitly excluded from device push. Legacy
signatures retain recorded names/times but never gain invented accepted copies.
Hotel/stay-date edits remain operational, as selected by Jacob.

Database guards protect old RPCs/direct writes, evidence deletion, template
reparenting/replacement, preview staleness and submission/final decision gates.
Frontend signing, admin confirmation, template saves, private history and pending
acceptance labels use these boundaries. CI adds disposable PostgreSQL tests with
no backend credentials or deployment steps. Beta fallback becomes 6A; public 5
fallback and main remain unchanged. Dependency fixes are isolated in `d305c69`.

Five unapplied forward-only migrations, in order:

1. `202610070001_beta_6a_agreement_storage.sql`
2. `202610070002_beta_6a_agreement_signing.sql`
3. `202610070003_beta_6a_agreement_revisions.sql`
4. `202610070004_beta_6a_agreement_notices.sql`
5. `202610070006_beta_6a_acceptance_gates.sql`

**Compatibility/rollout:** beta and public share live Supabase. Old Public 5
signing/submission fails closed after these migrations; this branch must not be
applied to the shared backend in isolation. Deploy the push exclusion before
notice SQL, then use a separately reviewed/authorized coordinated maintenance
handoff with compatible public and beta frontends and recovery arrangements.
No deployment, live migration, notice or public release is authorized by this PR.
See `docs/releases/beta-6a-test-checklist.md`.

**Validation:** clean npm ci, Node 24.19.0/npm 11.5.2; 48 unit tests, 49 UI tests,
86 synthetic real PostgreSQL role/RLS checks; default/public and explicit beta
builds pass; lint zero errors with the same three baseline warnings; full and
production-only registry audits zero. Stage reviews and a fresh whole-branch
review completed and findings corrected; reconstructed spec/plan and reconciliation
record are included. No Mac files/commits recovered or old results counted.

**Remaining limits:** single-session PGlite cannot prove simultaneous-request
race/deadlock behavior. Hosted Auth/storage/webhook/Edge deployment, actual devices
and another desktop browser remain pending in a disposable authorized environment.
Vercel automatic-preview settings could not be read (403); Jacob specifically
approved branch/draft-PR publication including any automatic preview on October 7. Historical PDFs are document-path references;
no claim is made that existing mutable storage content has been archived.
