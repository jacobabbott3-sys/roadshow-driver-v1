# Existing cloud beta: account and notice integration

Scope: integrate PR #18 (72eebc6c) and PR #19 (5c54457f) into the existing GitHub beta branch. Keep the current cloud beta at https://beta.roadshowdriver.com and its existing test Supabase project `exsquwjtqnirojntoxqv`. Do not create another environment or use the Mac. Production project `myraoovepjwhkafzdppq` and main remain outside scope.

## Evidence and activation state

October 18 read-only inspection confirms the existing project is named roadshow-driver-beta and ACTIVE_HEALTHY. It has no Edge Functions and lacks admin_account_operations, contract_notice_reviews and contract_notice_deliveries. Existing agreement tables were inventoried only; no agreement repair was attempted or authorized.

Both UI and server/mail feature flags remain disabled. Source integration does not establish live test readiness. The build now refuses a beta branch/channel unless VITE_SUPABASE_URL equals the existing test project URL. The stable beta hostname also refuses a browser client for another project. Existing feature exclusions for feat/user-account-safety and feat/manual-contract-notices are preserved; the integration branch is excluded too. These exclusions do not disable the existing beta branch deployment.

## Approved test scope

Email testing is approved only to **shipping@havenlight.com**, using clearly labeled synthetic data. Configure ACCOUNT_TEST_RECIPIENTS to exactly that address and CONTRACT_NOTICE_TEST_INBOX to that address when activation is separately completed. No other recipients, real signed contracts, real payment instructions or automatic edit/sign/cancel sends. The manual Send / Skip confirmation remains. Send later is deferred intent only. Actual active-admin plus Accounting delivery is still incomplete and requires separate implementation/approval.

## Exact remaining setup steps

1. **Existing Vercel project access:** the connected identity previously received HTTP 403 for project settings. A project/team owner must authorize the Vercel connection for the existing Roadshow project (or reconnect with an identity already authorized for it). Do not create another project, substitute credentials, change production access, or bypass protection. This turn does not retry the denied API. Once access is granted, verify the existing beta domain maps to Preview branch beta and the Git connection targets this repository.
2. **Beta-only browser configuration:** in that existing Vercel project's Preview environment, scoped to Git branch beta, verify VITE_SUPABASE_URL=https://exsquwjtqnirojntoxqv.supabase.co and the matching browser-safe key. Keep both new VITE feature flags false until backend acceptance. Do not change Production environment values. If the guard rejects a build, correct this scoped configuration through the authorized owner; do not weaken the guard.
3. **Persistence approval:** review/apply only the two request-store proposals, server/adminAccountStore.sql and server/contract-notices/store-proposal.sql, to the existing test project. These are not applied automatically or replayed from migration history. Verify RLS and existing service-role access. Any missing grants/security changes require a separate concrete action-time approval. No agreement schema repair belongs in this step.
4. **Secure server setup:** the owner enters the verified test sender and provider credentials directly into the existing beta project's Edge Function secrets interface. Never paste secrets in chat or commit them. See server/README.md and docs/email/manual-contract-notices.md for exact server variable names. Both beta project IDs must equal exsquwjtqnirojntoxqv; recipients must be shipping@havenlight.com only. Credential entry, persistent access and security settings require their action-time approval/handoff. Existing Resend SMTP does not supply the new explicit API sender's credentials.
5. Deploy admin-accounts and contract-notices to that test project only, retaining gateway JWT verification. Verify active/inactive/nonadmin/revoked sessions and private persistence before enabling UI. Verify the two fixed stable-beta Auth callbacks without broadening production redirects; any settings change needs approval.
6. Use synthetic beta accounts/contracts and the in-app confirmation to test create/resend/recovery, same-current-version signatures, Skip, duplicate requests, rejection/uncertain retry handling and actual inbox receipt only at shipping@havenlight.com. No unattended send or signing trigger. Record provider acceptance separately from inbox receipt. No real email flow has been exercised in this integration turn.

The known Vercel denial blocks deployment verification, not source integration. GitHub CI and local mock/disposable-database checks are recorded in the integration PR; neither substitutes for the live acceptance steps above.

## Integration verification

Local: 80 unit/server tests, 121 UI tests, 14 notice tests, 88 synthetic SQL
checks and six disposable PostgreSQL concurrency tests passed. Normal and beta
builds passed; the beta build used a synthetic browser key and no live calls.
Both frozen-lock Deno Edge typechecks passed. Lint: zero errors, unchanged three
warnings. GitHub exact-head and merged-beta CI evidence belongs in the integration
PR. No real invitation, recovery, contract notice or inbox receipt was tested.
