# Account management — source complete, activation disabled

The Users-page account panel, HTTP Edge Function entrypoint, Supabase Auth adapter,
Resend adapter and durable request-store adapter are implemented and tested offline.
`server/` is not imported into the browser bundle. No deployment, credential entry,
live SQL, grants, Auth settings or outgoing mail has been performed.

## Source boundaries

- `adminAccounts.ts`: authorization, validation, minimal status, create/resend/recovery
  orchestration, fixed callbacks, allowlist, rechecks and idempotency outcomes.
- `adminAccountAdapter.ts`: verified Auth user/session identity, fresh profiles,
  atomic createUser (no SMTP), generateLink (no SMTP), and explicit Resend send.
  New profiles must be active drivers; existing accounts cannot be silently created
  again or promoted. Generated-link user ID must match the intended account.
- `adminAccountEndpoint.ts`: exact stable-beta CORS, POST/JSON/bearer requirements,
  4 KiB streamed body cap, no-store responses and sanitized errors. Privileged
  clients are constructed only after server activation and project checks.
- `supabase/functions/admin-accounts/index.ts`: deployable Deno entrypoint with
  pinned Supabase 2.112.3 and a lockfile. Both server feature/mail gates default off.
- `adminAccountStore.sql`: **unapplied proposal**, not an automatic migration.
  It adds one RLS-protected server-only table, with no policies or new grants.
  Existing service_role privileges must be verified; if absent, stop for a separately
  approved permission design. Never loosen browser access to make the adapter work.

## Durable request behavior

Atomic inserts enforce actor/request uniqueness, one operation per actor and
recipient per UTC minute, and a single pending/uncertain operation per recipient.
Completed results replay; fingerprint changes conflict. Finalization uses a
pending-state compare-and-set. Pending/uncertain claims never expire automatically.
A crash or lost provider/persistence acknowledgement therefore blocks another send
under the same or a new ID until an authorized operator reconciles the outcome.
No request tokens/links/provider keys are stored in this table. It does contain
recipient addresses and minimal command metadata; keep it server-only.

The adapter does not automatically regenerate/retry mail. A definite rejection
permits an explicit new request after the rate window. A timeout, 5xx, provider
conflict or uncertain generation remains blocked for review. Resend receives an
operation idempotency key; do not rely on its finite retention window for recovery.
A 202 means provider acceptance, never inbox delivery. Delivery remains unknown.
If creation succeeds but mail fails, refresh status and use resend for the existing
unconfirmed account; do not recreate it. Unknown invitation state is distinct from
confirmed; active unconfirmed accounts can request a new invitation.

## Exact isolated-beta configuration (requires approval)

The October 12 repository record names `exsquwjtqnirojntoxqv` as the isolated beta
project. Reconfirm that identity before activation; this task did not inspect live
project settings. Never substitute production `myraoovepjwhkafzdppq`.

| Location | Setting | Required value/meaning |
| --- | --- | --- |
| Stable beta web app | URL | `https://beta.roadshowdriver.com` |
| Browser build | `VITE_ACCOUNT_MANAGEMENT_ENABLED` | Defaults `false`; `true` only after approved endpoint acceptance |
| Browser build | Supabase URL/anon key | Same verified isolated beta project, never service-role credentials |
| Edge server | `ACCOUNT_MANAGEMENT_ENABLED` | Defaults off; exact `true` enables reads/endpoint orchestration |
| Edge server | `ACCOUNT_MAIL_ENABLED` | Defaults off; exact `true` separately enables account/mail operations |
| Edge server | `ACCOUNT_BETA_PROJECT_ID` | `exsquwjtqnirojntoxqv` only after reconfirmation |
| Edge server | `SUPABASE_URL` | Must exactly equal `https://exsquwjtqnirojntoxqv.supabase.co` for that target |
| Edge server only | `SUPABASE_SERVICE_ROLE_KEY` | Target-scoped server credential via approved secure setup, never VITE/client |
| Edge server only | `ACCOUNT_RESEND_API_KEY` | Approved isolated provider credential; existing SMTP is not used by this adapter |
| Edge server | `ACCOUNT_MAIL_FROM` | Approved verified beta sender address |
| Edge server | `ACCOUNT_TEST_RECIPIENTS` | Explicit comma-separated approved test inboxes; empty denies every send |
| Supabase Auth | Redirect allowlist | Stable beta `/update-password` and `/auth/confirm`; verify exact callback behavior |
| Beta database | Request store | Review/apply only `server/adminAccountStore.sql` after separate approval and backup/review |

Email uses a fixed `/auth/confirm?token_hash=…&type=invite|recovery` URL; no client
redirect is accepted, and tokens are never returned/logged. `getUser(token)` uses
Auth's authenticated-user verification; the adapter additionally requires matching
subject, authenticated role and a nonzero session UUID. Current upstream Auth
loads the session and rejects a missing record. Verify actual target behavior for
revoked/expired sessions before activation; source/mock tests are not live proof.

## Remaining activation work

Source-only changes and offline testing were authorized. Live endpoint deployment,
credential setup, schema application, permission changes (if needed), Auth settings,
named test mail and automatic/real delivery each require the relevant approval.
Keep normal Edge gateway JWT verification enabled; the handler also validates Auth.
Verify created profile defaults/trigger, Auth unconfirmed-user invite generation,
revoked sessions, final-active-admin protection, and effective server-only table
privileges using approved synthetic beta accounts. No grants or policy changes were
introduced to existing application tables. No agreement repair or signed-contract
sender is included. Do not deploy this feature branch; its Vercel Git deployment
block remains intact. Review the draft PR before any beta integration.

References: [Supabase createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink),
[Auth session validation source](https://github.com/supabase/auth/blob/master/internal/api/auth.go),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
