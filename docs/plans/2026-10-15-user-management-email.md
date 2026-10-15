# Account recovery increment and deferred email design

## Inspected baseline and scope

Repository ID 1337965910, `jacobabbott3-sys/roadshow-driver-v1` only.
Feature branch `feat/user-account-safety` starts at beta `c5a4434`.
Main `d0e1f83` (Public v6 PR #17) has the same tree. No open PRs were returned
by GitHub at inspection. Older release labels/status in repository docs are
historical; this work does not assert current hosted configuration from them.

This increment changes frontend recovery and account-link handling only:

- Stable beta callback: `https://beta.roadshowdriver.com/update-password`.
- Stable public callback: `https://www.roadshowdriver.com/update-password`.
  Root public origin maps to www. Other origins fail before requesting email.
- Pending recovery/password submissions reject duplicates; recovery feedback
  does not reveal whether an account exists or claim provider delivery.
- Only explicit invite/recovery OTP types are accepted. StrictMode replays reuse
  the pending OTP exchange. Failed/expired/unmounted exchanges do not advance.
- Both invite and recovery hash flows survive SDK hash consumption. Recovery
  Auth events set the same routing signal. It is routing state, not authorization.
- Password failure retains recovery flow; successful update clears it. Existing
  Auth/RLS authorization and final-active-admin protection remain authoritative.
- Users copy distinguishes operational activity from invitation acceptance.
  Email and invitation status are not fabricated from profiles.

No backend endpoint, email sender, migration, live account, persistent access,
Auth setting, native project, or agreement schema changes are included. The
previous denied agreement repair was not retried or reconstructed.

## Publication and acceptance boundary

`vercel.json` disables automatic Git deployments for this exact feature branch.
Do not manually deploy it. This allows GitHub persistence without a connected
preview capable of touching production or sending email. The rule leaves beta
and main unchanged. A differently named branch needs its own deployment review.
No application sender exists in the inspected Edge Functions inventory; prior
Resend SMTP configuration is not proof of current delivery readiness.

Before any beta deployment/live acceptance, explicitly verify the isolated beta
project, stable callback allowlist and email templates. Do not change production
Site URL. Default SMTP Site URL fallback must not redirect beta tests to public.
The current implementation supports implicit hash links and token_hash callbacks;
PKCE code callbacks need separate implementation/acceptance if enabled later.
Use only approved synthetic accounts/recipient inboxes after mail-test approval.
A client origin check is UX protection, not a server mail authorization boundary.

## Next account-management increment (not implemented)

Create server-only active-admin endpoints for paginated minimal account status,
create/invite, resend invitation and recovery. Verify the bearer session and
current active admin profile on every request, including retry; never authorize
from user-editable metadata or stale browser role. Return 401 for invalid/expired
sessions and 403 for inactive/non-admin actors. Keep server credentials outside
client code, responses and logs. Default creation to driver; admin promotion
remains an intentional separate action with final-active-admin enforcement.

Minimal response: user ID, name, email where permitted, role, operational active
flag, invited/confirmed state and last email request/delivery state. Unknown is
explicit; activity is never a proxy for confirmation. Bound pagination and reject
unrecognized fields. Do not return tokens, full Auth objects or private metadata.

Use server-chosen stable environment callbacks, validated inputs, per-actor and
per-recipient rate limits, and a persisted operation key. Distinguish duplicate
create requests from explicit resend operations. Serialize concurrent creation
for the same normalized address. Never automatically retry an ambiguous invite
operation: reconcile account state first. UI shows requesting/accepted/delivery
unknown/delivered/failed, with delivery requiring authenticated provider events.
SMTP acceptance alone cannot prove inbox delivery. Verify installed SDK semantics
for invitation resend rather than assuming public Auth resend supports invites.

Required before implementation/activation: approved endpoint/auth design, verified
isolated beta target, test-recipient allowlist and server-only credential setup
through an approved channel. No live schema/settings changes are authorized here.
Automatic email delivery needs separate approval and a default-off server gate.
Tests must include driver/inactive/anonymous/stale admin denial, field filtering,
duplicate/concurrent creation, retry after timeout, provider rejection/rate limit,
expired links and sign-out during requests. Mock tests precede approved beta
acceptance; they do not establish live Auth/RLS or SMTP safety.

## Separate signed-contract notice proposal (not implemented)

Purpose: an informational **Agreement fully signed** notice to all admins plus
`accounting@havenlight.com`. State explicitly: **This is not payment authorization.
Payment readiness will be communicated separately.** Do not infer payment readiness
from signatures. No historical backfill. The old queue removed by
`202608190002_remove_contract_email.sql` must not be replayed or restored.

Eligibility requires both required party signatures on the same current immutable
agreement version, with current assignment eligibility and noncancelled work.
Either signing order is valid. A later signature on an obsolete version is not
eligible. Revision/cancellation/signer-removal must invalidate unsent notices.
If implementation requires the previously restricted agreement repair, stop and
report that dependency; do not reconstruct or route around it.

After a separately approved schema/design review, use a new private outbox with
atomic eligibility capture and a unique `(notice kind, agreement version,
normalized recipient)` key. Deduplicate accounting if already an admin. Recipient
snapshot and actor/audit data stay private. Workers claim bounded leases and
revalidate current version, signatures, cancellation and recipient eligibility
before send. Coordinate signature/revision/outbox decisions using the existing
approved locking protocol, without changing agreement semantics in this work.

Use the same provider idempotency key across retries for each outbox recipient.
Persist provider IDs/status; retry transient failures with backoff and bounded
attempts; terminal errors require review. On timeout after provider acceptance,
reconcile provider state before resend, especially beyond provider deduplication
retention. Do not claim exactly-once delivery across an external mail boundary.
A revision after the provider accepted mail cannot recall it: include version ID
and acceptance time and link to current authenticated agreement state. Define the
send/revision ordering boundary explicitly during implementation review.

Default delivery off. Beta must use an isolated backend and provider sandbox or
hard server allowlist of explicit test recipients; no real admin/accounting
addresses, CC/BCC or fallback destinations. Reject nonallowlisted recipients before
provider invocation. Do not rely on a VITE flag or UI button to prevent sending.
Authenticated provider callbacks and delivery logs must redact tokens/private
contract contents. Prefer authenticated app links over emailed private attachments.

Open activation choices: whether inactive admins receive notices; whether a fully
signed revision produces a second notice, and what revision/cancellation follow-up
means after delivery. These do not block frontend work, but block delivery activation.

Test plan: both signing orders; one signature; signatures on different versions;
repeated signature events; concurrent workers; duplicate recipient identities;
revision/cancellation/removal before enqueue and between claim/send; stale account
roles; transient/terminal provider failures; lost acknowledgement and expired
idempotency window; restart/lease recovery; default-off gate; test-recipient guard;
no historical backfill; no payment wording. Local synthetic tests, CI and approved
beta end-to-end/provider acceptance must be recorded separately.

References: [Supabase recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[Vercel per-branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).
The changelog markdown could not be retrieved in this environment (HTTP 403);
existing installed SDK interfaces and official API documentation were inspected.

## Local verification evidence

Node 24.19.0 with npm 11.5.2 invoked through a temporary npm cache; clean
`npm ci` succeeded. `npm test`: 51 passed. `npm run test:ui`: 99 passed
(24 files), including 16 new mocked account recovery tests. `npm run build`:
passed. `npm run lint`: zero errors, three existing warnings (AuthContext
Fast Refresh and two useAsync dependency warnings). `git diff --check`: clean.
Existing route tests cover inactive and mismatched admin sessions; source unit
tests retain final-active-admin assertions. No live authorization claim follows.
SQL/concurrency suites were not rerun locally because no SQL changed; existing
CI includes them. CI result, hosted preview, mobile behavior, real Auth redirects,
SMTP delivery and provider acceptance remain separate evidence, not local passes.
