# Implementation plan
1. Add failing service tests on admin authorization, recipient canonicalization/invalid input/staleness, signed money distinctions, stale version, and no send on skip/defer. Preserve independent beta provider guards.
2. Add a separately reviewable, unapplied settings-store proposal with narrow protection and settings-change audit; expose admin-only read/save through existing guarded Edge endpoint.
3. Add Settings UI and read-only review display. Generate a PDF receipt from immutable version and exact signature rows. Bind signed contents, PDF inputs and settings revision to reviewed payload; fail closed on unsupported data.
4. Run service/unit/UI/build/lint checks and inspect a synthetic PDF. Document gaps, no deployment, database changes or provider calls.

Follow-up: write tests for one-review plain-text editing, actor-bound rotation, no send on edit, unchanged source-bound data and exact provider bytes. Require a refreshed on-screen preview before enabling Send.
