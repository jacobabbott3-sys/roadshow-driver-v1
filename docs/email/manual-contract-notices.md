# Manual signed-contract notices (disabled source proposal)

This feature branch is independent of account-management PR #18 and starts at beta c5a44344. Neither branch is merged. No live SQL, Edge deployment, provider call, credential setup or account/security settings change is authorized here. The earlier denied agreement repair is unrelated and must not be retried. If existing evidence cannot be read as designed, stop; do not repair agreement schema as a prerequisite.

An active admin explicitly opens **Review signed-contract email** on the admin agreement tab. The server prepares a ten-minute, actor-bound snapshot showing the intended recipients, actual test destination, subject and full message. **Send test email** requires an explicit confirmation. **Skip** records a skipped decision. **Send later** records deferred intent only: no scheduled job, worker or queue consumes it. The admin must reopen a new review and confirm Send later. Signing, editing, cancellation, page mounting and session changes never prepare or send a notice automatically.

Intended recipients are all active admins plus accounting@havenlight.com, normalized and deduplicated. Missing active admin emails fail closed. Both required signatures must reference the same current, noncancelled agreement version; the driver must retain the corresponding open assignment. These facts, the active admin session and the recipient/message fingerprint are rechecked before each delivery and after claiming it. This is an informational signed-contract notice, **not payment authorization**. Payment readiness is communicated separately.

This increment deliberately implements only test-inbox delivery. Actual recipients cannot be selected by the browser. Every test email goes to a separately configured inbox that must differ from every intended address; each message identifies its intended recipient. The endpoint accepts only the stable beta origin and an explicitly approved nonproduction Supabase project, rejects the known production project, and defaults off. Browser code has no service-role or provider key. Only the server reads Auth email addresses.

## Idempotency and failures

Unapplied `server/contract-notices/store-proposal.sql` defines private review records and a unique ledger keyed by test environment/inbox, immutable version and intended recipient. A conditional review transition blocks double clicks and parallel confirmations. A conditional delivery claim plus provider idempotency key prevents concurrent duplicate delivery. Accepted recipients are skipped on a fresh explicit retry. Definite rejection can be retried after a new confirmation. Pending or uncertain outcomes never expire or retry automatically: inspect the provider and ledger under separate authorization before reconciliation. Provider acceptance is not proof of inbox delivery. A state change after a provider accepted a message cannot recall it; partially accepted batches are possible and the service reports counts.

## Activation prerequisites (not performed)

1. Review this source and SQL independently; approve any beta-only persistence setup. The proposal is outside migrations, has RLS and revokes browser access, and contains no grants, triggers or agreement alterations. Verify existing service-role table privileges without silently adding privileges.
2. Verify a genuinely isolated beta Supabase project, current agreement read compatibility, stable beta URL and active-admin session behavior. No production/shared database is permitted. If that cannot be established, stop.
3. Separately approve Edge deployment and server-only configuration: `CONTRACT_NOTICE_ENABLED`, `CONTRACT_NOTICE_MAIL_ENABLED`, `CONTRACT_NOTICE_BETA_PROJECT_ID`, `CONTRACT_NOTICE_TEST_INBOX`, `CONTRACT_NOTICE_RESEND_API_KEY`, `CONTRACT_NOTICE_FROM`, plus the platform server credentials. Flags remain false/absent until approval. Never copy secrets to VITE variables.
4. Separately approve a synthetic test recipient and manual test sends, verify sender domain, rate limits, provider response interpretation, expiry, retries and inbox receipt. No real admins/accounting or real contract details during initial acceptance. Verify JWT expiry/revocation behavior; Auth getUser checks do not imply immediate access-token revocation after logout.
5. Enable `VITE_CONTRACT_NOTICE_ENABLED` only for that approved beta setup. Feature-branch Vercel auto deployment is disabled in vercel.json; retain PR #18's independent branch exclusion when integrating both changes. No preview is claimed ready.
6. Real-recipient delivery is absent. It requires a separately reviewed implementation and explicit approval, including operational reconciliation, audit/retention and deployment policy. No automatic delivery activation is included.

Local mock tests and disposable PostgreSQL tests prove source behavior only. They do not prove live RLS, deployment, real email delivery or operational acceptance.

## Verification record

Local source verification: 48 unit tests, 90 UI tests (7 new notice tests),
14 notice service/adapter/endpoint/disposable-ledger tests, 88 existing synthetic
SQL checks and 6 native PostgreSQL concurrency tests passed. Build and pinned
Deno 2.5.4 Edge typecheck passed. Lint has zero errors and the existing three
warnings. Independent source review found no actionable issues. CI results are
recorded in the draft PR. Live beta and real inbox acceptance are not performed.
