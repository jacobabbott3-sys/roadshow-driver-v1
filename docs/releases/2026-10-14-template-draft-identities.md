# Checklist template draft identities

Local candidate atop PR14 commit `64bbd38fcb417f6e99c47d2153744d18bf47f562`.

New checklist draft items and sections receive UUIDs at creation. IDs survive
renaming, reordering, canceled confirmation and retry; deleted/re-added objects
receive new identities. Existing IDs, required/photo flags and instructions are
preserved. The editor sends those identities through the existing preview/commit
adapter. No API, migration, native, dependency or hosting changes are included.

## Existing API compatibility

Source inspection of `202610070003_beta_6a_agreement_revisions.sql`, lines 210–250,
shows supplied UUIDs are preserved; position fallback applies only to absent IDs.
The mutation inserts new supplied IDs and checks existing IDs belong to the
expected section/template. This frontend fix avoids that positional fallback.
No database was queried or modified to establish this source-level finding.
Restored beta definitions/policies/grants are not proven to match repository SQL.

Brand-new templates still use `createTemplate` and fresh database-generated row
IDs. That path does not replace an existing template or inherit its completion;
this change targets identity preservation in edits. There is no duplication UI.

## Verification

Using existing installed dependencies, Node 24.19.0 and npm 11.5.2:

- Test-first: three new identity regressions failed with absent IDs; existing-ID
  reorder coverage passed before the fix.
- Four editor integration tests pass using real updateTemplate/preview/commit
  code with mocked external reads, RPC and confirmation. Cases cover new items
  and sections; same-position delete/re-add; existing IDs/flags/instructions;
  cancellation, reorder and retry with stable identities.
- Full unit suite: 48 passing. Full UI suite: 83 passing in 23 files.
- TypeScript/Vite build passes. Lint: zero errors, three baseline warnings.
- Independent source review: no actionable findings; reviewer did not rerun tests.

Initial build caught unsupported test matcher options and an ES2023 array helper;
those were corrected to match existing TypeScript settings before final checks.
No SQL/concurrency suites or live acceptance were run for this candidate.

Before release, the separately responsible backend reviewer must verify supplied
UUID behavior in the intended beta and check that replacing a completed item does
not transfer completion, while reordering an existing item preserves it. This is
an acceptance requirement, not authorization to repair or change the backend.

No push, PR update, merge, deployment, credentials or environment changes occurred.
PR14 and production remain unchanged. Lead-only signing remains intended; driver
removal confirmation and other backend findings are outside this narrow fix.
