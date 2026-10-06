# Cloud development verification

Updated October 2, 2026. **Repository implementation ready for review; browser/account
acceptance pending.** Do not treat this record as public-release approval.

## Observed baseline

Source base: `016c4c15c7878c569ec768caf5eb38109cacba3c`; feature branch
`chore/cloud-development`. Isolated cloud checkout, Node 24.19.0, npm 11.5.2.

| Check | Result |
| --- | --- |
| Clean dependency install | Passed with npm 11.5.2 |
| Baseline unit tests under UTC | 42/44 initially; two fixtures assumed Mountain time |
| Unit tests after explicit fixture timezone | 44/44 passed under UTC; no app-date change |
| Baseline UI tests | 35/35 passed |
| Baseline build | Passed |
| Baseline lint | 0 errors, exactly 3 known warnings; see current-state |
| Fresh Codespace/private port/HMR | Pending; not the same as this cloud checkout |
| Supabase beta/production migration status | Unverified; no SQL executed |
| GitHub CI and Vercel preview | Blocked: publication denied; no remote PR created |

## Repository and viewer results

Final clean install runs the PDF asset preparation successfully. Unit tests
44/44, UI tests 40/40 across 15 files, and production build pass. Lint has no
errors and the same three known warnings after removing the temporary browser
fixture. All routed local documentation links resolve. Dev-container base and
Codespaces schemas validate; the configured image manifest returns HTTP 200.
Workflow YAML parses, Actions refs are pinned, and environment-file ignore checks
pass with `.env.example` retained.

Real Chromium tests use synthetic guides and intercepted synthetic signing
responses, **not** production or beta user documents. At 1280px and 390px widths,
a real three-page PDF renders, pages/zoom work, download uses the signed private
endpoint, no new tab opens, and close restores focus. A JPEG2000 image PDF first
failed a rendered-pixel check without decoder assets, then passed after bundling
them. Generated assets match the locked dependency: 169 CMaps, 16 font files,
7 decoder files; the build contains them and the matching worker. Screenshots
were inspected locally. These tests do not prove iPhone Safari or live RLS.

Fresh read-only review identified the missing decoder/CMap support, which was
fixed and reverified. Internal PDF table-of-contents navigation remains a minor
follow-up; use page controls. No application roles, SQL, RLS, buckets, production
release variables, or account settings were changed.

Terminal Git push lacks authentication. The connected GitHub API can read the
repository but rejected feature-branch creation with HTTP 403, **Resource not
accessible by integration**. No remote branch/PR or setup changes were published;
`beta` and `main` remain untouched. The local feature branch is complete and a
standalone patch preserves the reviewable handoff pending publication access.
PR/remote CI results must be recorded after they actually run.
The deliberate remote CI-failure injection remains pending; local
regression tests were observed failing against the old implementation and passing
against the new one. No remote CI result is inferred from a local pass.

## Setup choices and remaining browser validation

The originally proposed unversioned `24-bookworm` image tag returned 404. The
configuration uses published `5.2.1-24-bookworm` instead. Its registry manifest
and dev-container schema are checked during implementation; booting a fresh
Codespace is still required. Supported port attributes do not include a
Codespaces `visibility` field. Rely on GitHub's private default and explicitly
verify **Private** in Ports and denial from a signed-out browser; no unsupported
configuration field is presented as an access-control guarantee.

## Jacob's account/browser actions

- [ ] Review and merge the setup PR into `beta` after CI/preview review.
- [ ] Configure repository-scoped **beta client** Codespaces secrets from
  [workflow](../development-workflow.md); set MFA, budget/alerts, idle timeout.
- [ ] Create a fresh Codespace; verify Node/npm, install, all checks, Beta 5A,
  deep-route refresh/HMR, port 5173 **Private**, and signed-out access denial.
- [ ] Verify Vercel feature-preview labels/backend and unchanged Public 4.
- [ ] Inspect actual beta migration/schema state in Supabase. Record all five
  files as applied/missing/uncertain; no blanket replay and no production edits.
- [ ] Test stable-beta invitation/password-reset and allowed/denied photo/PDF
  access using permitted test accounts.

These authenticated account and second-computer checks have not been performed
by the repository task. Do not enter credentials into a task prompt or PR.

## Fresh Codex cloud trials

First trial, on a new task connected to the updated `beta` repository:

> Read AGENTS.md and its release/workflow references. Explain current beta/public
> versions, all required Beta 5A migrations, and feature → beta → main flow. On a
> feature branch, add a short contributor documentation clarification with
> source links. Do not modify application code, deployments, or databases. Run
> relevant verification and open a PR into beta.

- [ ] Confirm Beta 5A/Public 4, five migrations, unknown applied-state honesty,
  admin final assignment, security rules, relevant-only context edits, and a PR
  into `beta`. Record task/PR SHA and results, not the transcript.

Jacob selected **in-app PDF viewing** as the first application change. This
ongoing task implements it alongside setup; it does **not** count as a fresh
task proving discovery of newly merged repository context. After setup is merged,
start a separate small app task with a specific acceptance requirement and
verify both suites/build/lint, relevant context updates, and its Vercel preview.

- [ ] Record fresh application-task outcome, check evidence, and PR target.

## Another desktop with the laptop off

- [ ] From a different desktop browser, with the original laptop off, access
  GitHub, Codespaces, Codex, Vercel, and beta Supabase using Jacob's accounts.
- [ ] Create/recreate a Codespace from GitHub; no laptop files or transcript.
- [ ] Run install/checks/private preview and test ordinary driver/admin navigation.
- [ ] Commit/push a small documentation edit on a feature branch and open a PR
  into `beta`; verify remote CI and Vercel preview.
- [ ] Review fresh Codex work using only repository context.
- [ ] Read actual migration status; execute no SQL solely to prove browser access.
- [ ] Verify stable-beta Auth, photo/PDF sharing, and denied access. Mark missing
  migration/access prerequisites as blockers rather than passes.
- [ ] Push work, stop/delete/recreate the Codespace, and confirm GitHub retains
  committed work and context.

For each observed step record date, device/browser, SHA/PR, command/exit code,
pass/fail/blocked result, port/deployment labels, and sanitized migration evidence.
Initial rollout is complete only when these checks and both fresh trials pass.
Full Beta 5A public promotion requires its separate release checklist and approval.
