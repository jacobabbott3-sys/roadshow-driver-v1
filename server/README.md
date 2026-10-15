# Account service core — no live endpoint

`adminAccounts.ts` is server-only orchestration with injected adapters. Nothing
imports it into the browser, starts an HTTP listener or creates a Supabase/provider
client. Its default feature/mail policy is disabled. `npm test` runs synthetic
adapter tests; the normal build also typechecks this directory.

A separately reviewed live adapter must verify session validity (including revoked
sessions), read current profile authorization, page only minimal Auth/profile
fields, and implement durable atomic request claims with recipient serialization.
Claims must survive crashes: expired leases cannot automatically release an
uncertain provider attempt. Same actor/request ID with a changed command must
conflict. Different IDs must not bypass a pending/uncertain recipient operation.
Do not let a client choose project identity, policy, allowlist, role or callbacks.

Use server-side secrets only. `perform` must independently enforce sandbox/test
recipient policy, reject an existing account on create, never silently resend or
promote, and pass the stable operation key through provider idempotency. Existing
Auth invite/resend behavior needs verified adapter-specific handling; do not
assume public Auth resend supports invitations. Both default invite and recovery
redirects return to stable beta `/update-password`; custom token-hash email
templates must explicitly target `/auth/confirm?token_hash=…&type=invite|recovery`.
Never log those tokens or generated links.

An explicit transient rejection means the provider definitely did not accept the
operation. Only that outcome permits a same-key retry. Timeouts, exceptions and
ambiguous acknowledgements remain uncertain and require reconciliation, including
provider deduplication expiry. A stored 202 means accepted, not delivered. Delivery
status stays unknown until separately authenticated provider feedback exists.

Before wiring/deploying: verify the isolated beta project, obtain approvals for
credential setup/live schema/endpoint deployment and named test mail, review HTTP
method/CORS/body-size/rate-limit protections and run real Auth/RLS acceptance.
No production or automatic email activation is authorized by this code.
See `docs/plans/2026-10-15-user-management-email.md` for review decisions.
