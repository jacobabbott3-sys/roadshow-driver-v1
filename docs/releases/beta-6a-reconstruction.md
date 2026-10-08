# Beta 6A reconstruction and reconciliation

Cloud base: `c439a0fe43b202667436decd6b17861e5a5bd1e0`; isolated branch
`feat/beta-6a-agreement-reconstruction`. Remote beta verified before editing.
No open PRs were returned by GitHub's repository query. Existing notification
permission hardening is retained. Other checkouts and their untracked files are
untouched. Main/Public 5 is not this feature's integration target.

## Unavailable Mac checkpoint

- Task: `01a11448-d30e-700d-a126-261b6f88e023`.
- Worktree: `/Users/jacoba/Documents/Codex/2026-10-06/task-3/roadshow-agreement-spec`.
- Branch: `docs/agreement-history-design`.
- Original spec path: `docs/superpowers/specs/2026-10-07-agreement-versions-design.md`; local commit `d08a0f3e810dbc3f2bbcbc0fe7c51dbf816fe5dd`.
- Original plan path: `docs/superpowers/plans/2026-10-07-agreement-versions.md`; local commit `72ce9f9b5e70ce9632a0beb92a99a3ec122a5309`.
- Tasks 1–2 reportedly approved; Task 3 commit `b5eb8a7`, later review fixes uncommitted; Tasks 4–7 pending.
- Prior reported SQL/focused/51-unit/build results are **not validation of this checkout**; UI/lint were unconfirmed.
- Those local SHAs and files have not been recovered. No prior push/live SQL/deployment was reported. This reconstruction does not reproduce old commit identity.

When the Mac returns, compare its spec, plan and uncommitted diff with this
branch. Reconcile product/security differences before discarding either copy.
The reconstruction records requirements and decisions, not raw conversations.

## Clarified choice

Jacob selected hotel name/address, all hotel contact/confirmation/notes, and
check-in/check-out dates as operational edits without fresh signatures.

## Fresh cloud evidence

Baseline Node 24.19.0/npm 11.5.2: unit 46/46; UI 40/40; build passed; lint zero
errors / three known warnings. Production-only registry audit zero findings.
See [dependency audit](beta-6a-dependency-audit.md) for before/after versions.
Fresh implementation, stage/whole-branch reviews and final limits are recorded
in [verification](beta-6a-verification.md). The unavailable Mac implementation
was not used as code or validation.
