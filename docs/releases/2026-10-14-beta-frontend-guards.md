# Local beta frontend guards

Base: `a02f5521b703931b3dfa6747e6bd1d79af3d5772`. Local branch:
`review/beta-frontend-guards`. PR #13 and recovery `ee34f15` remain unchanged.

## Implemented scope

- Explicit `/admin/contracts/:id/agreement` under the existing admin route guard.
  The guard now requires an active admin profile belonging to the current user.
- Show/signing list entries use that route. Older `?review=admin` links redirect
  through it instead of selecting admin acceptance from a query parameter.
- Show save retains beta revision preview/commit behavior but no longer prompts
  acceptance from a previously stored admin name. The signature field and its
  `adminSignContract` adapter are removed; stale draft properties are inert.
- Review lifecycle uses contract/role keys, latest-request and lifetime guards.
  Review/accept responses from obsolete views cannot refresh or notify a new view.
  Acceptance requires displayed terms, legal name and explicit acknowledgement.
  Failed refresh hides old signing controls; changed versions reset consent.
- Contract details remount per current account/role/contract/review mode and do not
  mount for an unverified/mismatched/inactive profile. Both show and signing work
  expose Contract review. Successful signing refreshes the existing beta
  acceptance gate and contract in parallel, even if signed_at is unchanged.
- Beta history navigation, confirmation host, revision APIs, archived readers,
  checklist gate and database source are preserved. No native code is imported.

## Test evidence

Clean npm ci completed using Node 24.19.0 and npm 11.5.2 (repository pin), with a
workspace-local npm cache; no environment or credential configuration changed.
Regressions were run against the original beta before implementation: 18 failures
across the new review/entry/lifecycle cases, plus two standalone mismatched-session
admin guard failures. A StrictMode test was corrected to place StrictMode at the
root so React actually replays its effects; it then failed against beta because
a late initial response replaced the newer review. The patched targeted suite
passed 35 cases.

Full verification: 48 unit tests and 79 UI tests across 22 files passed; TypeScript
and Vite build passed; lint has zero errors and the three documented warnings.
An independent reviewer inspected the final production/test diff, including account/role remounts, late-response handling and parallel contract/gate refresh, and found no actionable findings.
These tests use fixtures/mocks and do not demonstrate live server authorization.
SQL execution/concurrency suites were intentionally not run under this task's
no-database-operation boundary. No migrations were modified or reconstructed.

## Preview evidence and deployment acceptance prerequisite

The preserved recovery preview's public HTML returned HTTP 200 at:
https://roadshow-driver-v1-git-recov-23d3d6-jacobabbott3-5631s-projects.vercel.app/

It referenced `index-DI72_AEr.js`, loading `AppRoot-hainx2q8.js`. The application
chunk constructs its web Supabase client with `https://placeholder.supabase.co`.
The production reference `myraoovepjwhkafzdppq` in the entry bundle is a native
validation constant, not the configured web client. Vercel success therefore
proves a build/deployment, not a working connected preview. This local beta patch
has not been deployed and does not configure that preview. No keys were printed.

Before calling a future preview usable, independently verify its actual browser
client URL points at the intended beta project and that authorized live account
flows work. A successful build, public 200 or incidental hostname string alone
is insufficient. Configuration must use separately permitted user-controlled
hosting access; the prior Vercel denial remains binding.

## Unresolved dependencies / next decision

Beta still depends on `get_my_agreement_history`, `contract_acceptance_gate`,
`preview_agreement_change`, `commit_agreement_change`,
`contracts.current_agreement_id`, and archived checklist fields, in addition to
existing review/accept APIs. The patch preserves these contracts without asserting
that the target database implements them. Live schema/revision/authorization
compatibility and authenticated signing/submission remain unverified. Frontend
work cannot replace server-side revision atomicity or access controls. The
previously restricted database repair is outside scope; no workaround was added.

Next decision: whether to publish this separate beta-based frontend candidate for
review after local review completion, while leaving native integration and live
backend acceptance separate. No publication, merge or deployment is authorized
for this step.
