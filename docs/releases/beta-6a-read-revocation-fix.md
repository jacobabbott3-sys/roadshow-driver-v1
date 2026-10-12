# Beta 6A queued agreement read: local review fix

October 8, 2026. Based on PR #12 head
`bbb1d9967087dc4a8d8598eea9b2d5f359f0bf21`; prepared on a separate local review
branch. No publication, hosted SQL, deployment or real-account mutation is
part of this fix. Beta 6A remains subject to the
[rollout checklist](beta-6a-test-checklist.md).

## Reproduction and scope

`public.get_contract_agreement(uuid)` in
`202610070002_beta_6a_agreement_signing.sql` checked account activity before
waiting on its advisory and contract row locks. After a wait, the lead-driver
comparison could authorize an account that an administrator had deactivated.

1. Admin session A starts a transaction, holds the agreement advisory lock
   `(61007,1)` or the target contract row lock, and calls `admin_update_user` to
   deactivate the assigned driver without committing yet.
2. Driver session B starts `get_contract_agreement`. Its initial activity check
   sees the prior committed profile, then waits on A. A third observer confirms
   the independent backend is blocked by A with `pg_blocking_pids`.
3. A commits. On the original SQL, B returns the existing version, or creates
   and returns the first version if none exists. First issuance also creates
   assignment periods and updates the contract pointer. A later request is
   denied. This is an in-flight revocation race, not persistent inactive access.

The fix repeats the activity check after **both** locks, before assignment
access, evidence issuance or the return query. The early check remains to reject
already-inactive requests promptly. This adds no lock, API, role, grant, policy
or product behavior. The modified October 7 migration is still unapplied on the
shared hosted project; applied migration history must not be rewritten. If an
integration target has applied this file since inspection, prepare a separately
reviewed forward replacement instead of replaying it.

This closes deactivation committed during either demonstrated lock wait under
PostgreSQL's default READ COMMITTED isolation. It does not claim to serialize
all account changes with every already-running request, or change transaction
isolation. No new profile lock/order is introduced.

## Durable regressions

Run `npm run test:sql:concurrency` with Python 3 and a working Docker daemon.
The standard-library Python harness starts a fresh PostgreSQL 17.11 container
pinned by image digest, with `--network none`, no exposed ports, no host mounts,
and no database-URL/credential input. It replays repository SQL against the
existing synthetic Auth/storage fixture and removes its container and volume
on ordinary success or test failure. GitHub Actions invokes the same command.
This is native PostgreSQL evidence, not hosted Supabase acceptance.

Six tests cover existing-version and first-issuance revocation after both
advisory and contract-row waits, plus two active-driver controls. Denial tests
assert the actual RPC error, unchanged version/period/signature counts and
contract pointer, and denial of a subsequent request. Controls verify that an
active driver still reads or creates the expected agreement. Blocking is
observed from independent database sessions, not inferred from a fixed sleep.

Before the fix: four regression cases failed (six failing subassertions), while
both active controls passed. After the fix: all six pass. The original
single-session PGlite suite is retained; it cannot reproduce this race.

Local verification with Node 24.19.0/npm 11.5.2: clean `npm ci`; 48 unit tests,
49 UI tests, 86 PGlite checks and all six native concurrency tests passed;
production build passed; lint reported zero errors and the same three baseline
warnings. These are local results, not a new remote CI or deployment result.

## Related boundary inspection

- `accept_contract_agreement` has an insertion guard that rechecks account
  activity and signing role. The independent readiness probe confirmed that
  a queued first-time acceptance after deactivation is denied and inserts no
  signature. An independent review probe confirmed that an idempotent retry of
  an already-recorded acceptance can still return its existing signature ID
  after deactivation; that early return bypasses the insertion guard and creates
  no new evidence. This pre-existing retry behavior is unchanged by the read fix.
- `get_my_agreement_history` is a stable, recipient-scoped query without this
  explicit blocking-lock path; its existing inactive-account denial is retained.
- Submission, draft checklist and admin decision wrappers call private
  implementations that recheck activity/admin authorization after wrapper locks.
  Current-acceptance gates additionally require an active accepted driver.
- Revision/assignment mutations retain their existing private authorization
  checks and lock order. This fix does not refactor those paths or claim a
  comprehensive concurrency audit.

## Hosted evidence and remaining prerequisites

Read-only hosted inspection on October 8 at approximately 18:40 UTC found no
agreement schema, version/signature/period/legacy tables, review/preview/commit
RPCs, current-version pointer, notice key, or archived-item column. The migration
ledger only listed the separate due-notification privilege migration. Schema
absence was verified directly, not inferred solely from the ledger.

A separate hosted source read returned ACTIVE `web-push` v2, lacking both
agreement-kind exclusions. The new notice migration must not be enabled before
the prepared Edge exclusion is deployed and verified in the authorized target.
No notification was sent to demonstrate that missing exclusion.

These hosted reads do not execute the proposed agreement code: the reproduced
race and its fix concern the PR's local SQL fixture. Shared Public 5 compatibility,
isolated hosted Auth/storage/webhook acceptance, real devices, and coordinated
rollout/recovery authorization remain unresolved.
