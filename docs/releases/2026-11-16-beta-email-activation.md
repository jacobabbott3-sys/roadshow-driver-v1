# Beta email activation preparation — November 16, 2026

Scope: existing beta project `exsquwjtqnirojntoxqv` only. No production change.

The two Edge entrypoints now pass environment values to their existing endpoint
factories rather than overriding all four feature/mail gates to false. Missing
or false flags still disable the endpoints/mail. Beta-project identity, exact
origin, active-admin/session validation, recipient restrictions, idempotency and
manual Send/Skip checks are unchanged. Gateway JWT verification must stay on.

The activation feature branch is excluded from Vercel previews; the existing
beta deployment is unaffected by that exclusion. No UI feature flag is enabled
by this source change.

The operator verified beta Site URL and exact `/auth/confirm` and
`/update-password` redirects, staged both beta project IDs and shipping-only
recipient settings, and saved all four server flags false. Existing provider
credentials/sender values have not been printed or changed. Their presence does
not prove provider acceptance.

Deploy reviewed code only to the existing test project, keeping gates false.
Then separately enable service gates for authenticated non-mail acceptance.
Enable mail/UI only for approved synthetic shipping-only tests. Do not reset
the existing shipping administrator or add another inbox without authorization.
Do not send real contract notices or sign real agreements. Inbox receipt remains
unverified until observed; provider acceptance alone is insufficient.

Rollback: set service/mail gates false in the beta project. No SQL changes are
part of this activation. Public promotion remains separately approved.

## Verification before deployment

New entrypoint tests failed with the holds and passed after removal. Local unit
suite: 85/85; contract suite: 15/15; normal build passed; lint has zero errors and
the unchanged three-warning baseline. Initial full UI run had one existing
admin-route timeout (120/121); beta-channel rerun is recorded in the PR.
Independent code review found no blockers. Minor test limitation: the environment
stub checks forwarded values but does not distinguish incorrect variable names;
the reviewed implementation forwards names directly.

Local Deno dependency fetching and Docker concurrency checks remain unavailable;
GitHub CI must provide those checks before merge/deployment. No live mail receipt
or authenticated workflow acceptance is implied by these checks.
