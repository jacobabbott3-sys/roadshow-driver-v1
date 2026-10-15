# Account-management source increment and separate contract-email design

## Scope and implementation

Repository ID 1337965910, `jacobabbott3-sys/roadshow-driver-v1` only. Branch
`feat/user-account-safety` starts at beta `c5a44344`; main `d0e1f83` (PR #17)
had the same tree. No open PRs were found at initial inspection. The original
checkout remains untouched in an isolated cloud worktree. No native project,
production deployment, agreement repair, live schema, grants or settings changed.

Implemented, with activation disabled:

- Recovery uses exact stable beta/public callbacks. Temporary/deceptive origins
  fail before requesting mail. Invite/recovery types are runtime-validated;
  StrictMode single-use OTP exchanges are deduplicated. Recovery routing survives
  SDK hash consumption; password failures preserve recovery state.
- Users has a default-off account panel: create driver/invite, resend invitation,
  password recovery, minimal paginated email/account status and request feedback.
  Activity, invitation confirmation and unknown email delivery remain distinct.
  Pending duplicates are blocked; uncertain retries retain request IDs; deliberate
  later requests after success receive new IDs. Session/access changes discard
  stale views/results. Existing role/activity controls still use admin_update_user.
- Server-only orchestration, Supabase Auth adapter, Resend adapter, durable request
  adapter and deployable Edge Function source are complete. Fresh active-admin
  checks, strict fields, minimum status responses, driver-default creation, exact
  beta callbacks, test-recipient allowlist, project-identity gates and no-store
  HTTP responses fail closed. Server feature/mail flags both default off.
- Auth creation is atomic and does not email. Existing addresses cannot silently
  become a resend or promotion. Generated links must match the expected user.
  Links/provider secrets never enter client responses or logs. Resend sending is
  explicit and separate from existing SMTP configuration.
- The request-store SQL is an **unapplied proposal** outside migrations. It adds
  no grants; RLS and revoked browser access protect the table. Activation requires
  verifying existing service_role privileges; missing permissions are a blocker
  for a separate review, not a reason to loosen RLS.

Durable operation IDs and recipient uniqueness prevent duplicate/overlapping mail.
One operation per actor and recipient per UTC minute is enforced by database
constraints. Pending/uncertain requests never expire automatically, even across
new request IDs. Definite provider rejection allows a manual new request after
the rate window. Unknown outcomes require reconciliation, including after lost
provider acknowledgements or persistence failure. A 202 is acceptance, never proof
of inbox delivery. The adapter does not automatically regenerate/retry mail.

`vercel.json` disables automatic Git deployment for this exact feature branch.
Do not manually deploy or rename it without reviewing deployment safety. Main and
beta remain unchanged. The previous denied agreement repair was not retried,
reconstructed or routed around.

## Activation configuration and approval boundaries

[Server setup and exact configuration](../../server/README.md) is authoritative.
The repository's October 12 isolated-beta candidate is `exsquwjtqnirojntoxqv`;
reconfirm it before activation. Stable web origin is
`https://beta.roadshowdriver.com`. Endpoint and browser must use the same beta
project. No live identity, redirect allowlist, SMTP/provider settings or privileges
were inspected or changed during this increment.

| Step | Authorization/status |
| --- | --- |
| Disabled source code, UI, endpoint/adapters, synthetic tests, independent review and draft PR | Authorized and implemented |
| Further disabled source-only fixes/tests | Already authorized; no additional approval needed |
| Live beta endpoint deployment or connection | Needs explicit approval and verified beta identity |
| Server credential/persistent access setup | Needs approved secure setup; never chat/client/VITE secrets |
| Apply request-store SQL | Needs separately approved schema review/application; no SQL applied here |
| New grants or Auth/security/redirect setting changes | Not authorized in this turn; separate review if needed |
| Send beta test invitations/recovery | Needs named approved test inboxes and explicit mail-test approval |
| Real or automatic delivery activation | Needs separate approval after acceptance; flags remain off |
| Signed-contract notice implementation | Separate increment; no sender or agreement changes here |
| Merge/deploy production | Not authorized |

Before enabling the UI, verify endpoint JWT gateway protection, the actual Auth
revoked/expired-session behavior, new-profile default-driver trigger, unconfirmed
user invitation generation, final-admin protection and server-only request-table
privileges. Test only approved synthetic beta accounts and inboxes. Default SMTP
Site URL fallback must not send beta recovery to public; this adapter constructs
fixed token-hash beta callbacks. Production Site URL remains unchanged.

## Separate signed-contract notice proposal

Purpose: **Agreement fully signed** informational notice to all admins plus
`accounting@havenlight.com`. Required wording: **This is not payment authorization.
Payment readiness will be communicated separately.** No historical backfill.
The abandoned queue removed by `202608190002_remove_contract_email.sql` must not
be restored or replayed.

Both required parties must sign the same current immutable agreement version;
current assignment eligibility and noncancelled work must still hold. Either
signing order is valid. An obsolete-version signature cannot qualify. Revision,
cancellation or signer removal invalidates unsent notices. If implementation
requires the previously restricted agreement repair, stop and report that
specific dependency; do not reconstruct or bypass it.

A separately reviewed private outbox should atomically capture eligibility and
have a unique `(notice kind, agreement version, normalized recipient)` key.
Deduplicate accounting if already an admin. Workers claim bounded leases and
recheck current version, signatures, cancellation and recipient eligibility before
sending. Coordinate with the existing approved locking protocol, without altering
agreement semantics in this account-management increment.

Retain one provider idempotency key per recipient/version across safe retries;
store provider IDs/status. Use bounded backoff for explicit transient failures.
Timeout after possible acceptance requires reconciliation, particularly beyond
provider idempotency retention. Do not claim exactly-once delivery across an
external mail boundary. A revision after provider acceptance cannot recall mail:
include version ID/time and a link to authenticated current agreement state.
Define send/revision ordering explicitly during implementation review.

Default delivery off. Beta requires an isolated backend and a provider sandbox or
hard server allowlist of explicit test recipients. No real admin/accounting CC,
BCC or fallback. Reject nonallowlisted recipients before provider invocation;
a browser flag is not a mail security boundary. Authenticate provider callbacks
and redact tokens/private contract contents. Prefer authenticated app links over
emailed private attachments.

Activation decisions still open:

1. Whether inactive admins receive notices, or only active admins.
2. Whether each fully signed revision sends another notice, and whether a later
   revision/cancellation needs a follow-up after an earlier notice was delivered.

Account email currently blocks inactive recipients and permits only configured
beta test inboxes. Any inactive-account recovery exception needs a separate
product/security decision. Real accounting/admin inboxes are not test recipients
without explicit approval.

Contract notice test plan: both signing orders; one/mismatched-version signature;
repeated events; concurrent workers; duplicate recipients; revision/cancellation/
removal before enqueue and between claim/send; stale recipient roles; transient/
terminal failures; lost acknowledgement; expired idempotency window; lease recovery;
default-off gates; test-recipient enforcement; no backfill; no payment wording.

## Verification and evidence limits

Independent source review found and resolved a successful-resend request-ID issue.
The reviewer then found no remaining source blockers and approved the disabled
increment subject to checks. Atomic creation and session-identity validation were
also reviewed. Targeted adapter/core tests passed during review. Live Auth,
provider and schema-privilege acceptance remain separate prerequisites.

Local verification includes unit/server tests with SDK requests intercepted by
synthetic fetch, UI mocks, proposed-store constraints/RLS in in-memory PGlite,
existing SQL checks, native disposable PostgreSQL concurrency tests, TypeScript,
Vite build, lint and Deno Edge Function checking. No tests send real mail or use
live data. Exact current counts and CI status are recorded in PR #18. Passing
mocks/CI is not preview readiness or real Auth/SMTP/provider acceptance.

References: [Supabase recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink),
[Auth session check](https://github.com/supabase/auth/blob/master/internal/api/auth.go),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Vercel branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).

Final source-only verification: 78 unit/server tests, 112 UI tests, 88 existing
SQL assertions and six native disposable PostgreSQL concurrency tests passed.
TypeScript/Vite build and frozen-lock Deno Edge Function check passed. Lint has
zero errors and exactly the three pre-existing warnings. Independent final review
approved the disabled increment with no blockers and separately ran 13 account UI
and 27 adapter/core/store tests successfully. GitHub CI for the published head is
reported in PR #18; none of this is live provider, deployment or Auth acceptance.
