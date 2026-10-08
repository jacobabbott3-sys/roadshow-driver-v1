# Roadshow Driver: repository instructions

Roadshow Driver is a mobile-first operations app for drivers and administrators.
GitHub is the durable source of truth; local checkouts, Codespaces, and Codex
cloud workspaces are disposable. Do not depend on laptop chat history.

## Operating rules

- Read the relevant documents below before changing behavior. Follow current
  code and migrations when historical plans differ; surface contradictions.
- Use `driver` and `admin` roles. Preserve active-account enforcement and the
  protection against removing the final active administrator.
- User-facing terms include **Publish Contracts**, **Availability**, **Shows &
  Contracts**, **Signings**, **Red Folder**, and **My Toolbag**. Internal names
  containing `opportunity` are not an instruction to change UI terminology.
- Admins make final assignments. Availability rank does not award work.
  Linked signings are one response/assignment unit. Preserve response order
  when fully unassigning a published contract.
- External drivers are display names, not accounts: no directory entries,
  signatures, checklists, chat access, or notifications.
- Work from current `beta` on a short-lived feature branch; open a PR into
  `beta`. Never push directly to `main`. Public promotion is a separately
  approved `beta` → `main` PR. Current deployed labels: **Beta 5A**, **Public 5**. Prepared Beta 6A
  is local-only; see `docs/releases/beta-6a-verification.md` and its rollout checklist.
- Keep Supabase Auth/database/private storage/Edge Functions and Vercel.
  Authorization belongs in database policies/RPCs as well as route guards.
  Do not loosen RLS, make buckets public, or bypass Auth for previews.
- Never commit credentials, service-role keys, database passwords, access
  tokens, VAPID private keys, webhook secrets, user passwords, private user
  data, or raw conversation transcripts. Only browser-safe client values
  may use `VITE_`; these are embedded in the client bundle.
- Environment files remain ignored except safe `.env.example` placeholders.
  Do not print secret values in logs, reviews, or documentation.
- Migrations initially run manually through the intended Supabase dashboard.
  Do not automatically apply/replay SQL or rewrite applied migration history.
  An absent migration ledger entry does not prove dashboard SQL never ran.
  Check actual schema and applied state, then apply only reviewed missing SQL.
- Keep production unchanged until public release approval. Backend-dependent
  previews require verified beta migrations before live testing.
- No local Supabase stack starts by default. Codespace ports stay private.
  Test invitation/reset links on stable Vercel URLs.
- Mobile is for monitoring, PR review, deployed-app testing, and tiny emergency
  text edits. Normal coding, security changes, migrations, and conflicts use
  desktop browser workspaces.

## Route by task

| Task | Read |
| --- | --- |
| Product/UI/workflow | [Product](docs/product.md), relevant pages/tests |
| Services, database, RLS, uploads, push | [Architecture](docs/architecture.md), relevant migration SQL and SQL tests |
| Durable product/operational choices | [Decisions](docs/project-decisions.md) |
| Release/status/promotion | [Current state](docs/current-state.md), [Beta 5A checklist](docs/releases/beta-5a-test-checklist.md) |
| Workspace, CI, deployment, recovery | [Development workflow](docs/development-workflow.md) |
| Cloud rollout acceptance | [Verification record](docs/releases/cloud-development-verification.md), [approved design](docs/superpowers/specs/2026-10-01-cloud-development-design.md) |

Read only the routes relevant to the task. Update product for changed behavior,
architecture for changed service/security patterns, decisions for durable
choices, current-state for versions/issues/migration status, and workflow for
changed procedures. Do not rewrite unrelated context on every task.

## Verification

Use Node from `.nvmrc` and npm from `package.json`'s `packageManager`.
Install with `npm ci`. Before proposing code/configuration changes for merge:

```sh
npm test
npm run test:ui
npm run build
npm run lint
```

Tests/build must pass and lint must have no errors or new warnings. The known
three-warning baseline is recorded in `docs/current-state.md`. Do not suppress
warnings or weaken tests to get a pass. Run meaningful tests for behavior changes.
SQL source assertions and mocked UI tests do not prove live RLS/migration safety;
use the release checklist for beta account/storage testing. Report commands,
results, and anything blocked/unverified honestly. Never equate committed SQL
with an applied migration, or a local build with a verified deployment.
