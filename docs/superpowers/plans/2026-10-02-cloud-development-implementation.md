# Cloud Development and Durable Context Implementation Plan

> **For agentic workers:** After Jacob approves this plan, use `superpowers:executing-plans` to implement it task-by-task. Steps use checkboxes for tracking. Approval of this document is not approval to promote Beta 5A to public.

**Goal:** Make hands-on development and delegated Codex work reproducible from GitHub on another desktop browser, without depending on Jacob's laptop.

**Architecture:** GitHub holds code, migrations, concise context, and workflow instructions. Codespaces provides the hands-on workspace; Codex cloud produces reviewed feature-branch changes. Existing Vercel deployments and Supabase services remain in place, with dashboard-applied migrations during the initial rollout.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Supabase, Vercel, GitHub Codespaces and Actions; proposed shared Node 24 toolchain and the repository's declared npm 11.5.2.

**Spec:** `docs/superpowers/specs/2026-10-01-cloud-development-design.md`

**Status:** Approved by Jacob October 2, 2026; implementation on `chore/cloud-development`. External account/browser acceptance remains tracked in `docs/releases/cloud-development-verification.md`. Jacob additionally requested in-app PDF viewing as the first application change. Deviations and measured results are recorded with the implementation.

## Global Constraints

- GitHub remains the source of truth; workspaces are disposable.
- `beta` is shared testing; `main` is public. Normal changes use short-lived feature branches and pull requests into `beta`; approved public releases merge `beta` into `main`.
- Preserve driver/admin roles, active-account checks, final-admin protection, contract terminology, assignment and checklist behavior, private storage, and RLS.
- Keep Beta 5A and Public 4. Public release numbers contain no letters.
- No Supabase replacement, local Supabase startup, automatic migrations, destructive database rollback automation, or infrastructure migration in this rollout.
- Never commit credentials, passwords, access tokens, service-role keys, database passwords, VAPID private keys, webhook secrets, private user data, or raw conversation transcripts. User passwords remain exclusively in Supabase Auth.
- Codespace ports stay private; authentication-link testing uses stable Vercel URLs.
- Mobile is for monitoring, PR review, deployed-app testing, and small emergency text edits. Normal coding, migrations, security work, and conflict resolution use desktop browsers.
- Update only context documents relevant to a material change.

## Repository Baseline and Findings

Inspected `beta` at `016c4c15c7878c569ec768caf5eb38109cacba3c` on October 2, 2026.

- `016c4c1`: approved cloud-development design.
- `505cfbf`: desktop/mobile photo uploads, assigned-team photo viewing, photo/storage RLS, PDF resource attachments, and associated tests.
- `5c1fc6d`: published contract terminology and reversible assignment behavior.
- `30786a7`: UUID aggregation migration correction; retain the corrected historical file.
- Earlier Beta 5A commits cover lazy routes, paginated chat, operational search, atomic saves, recovery, and active-account authorization.
- Root `AGENTS.md`, dev-container configuration, and Actions workflows are absent in this checkout.
- `.env.example` still specifies release `4A`; the application fallback is Beta 5A/Public 4.
- README and the Beta 5A checklist list four September 29 migrations but omit `202610010001_beta_5a_photo_resource_uploads.sql`.
- README's generic instruction to apply all migrations is unsafe for an existing project without checking which scripts already ran.
- Existing commands are `npm test` (Node TypeScript tests), `npm run test:ui` (Vitest/Testing Library), `npm run build`, and `npm run lint`.
- The checklist states three existing lint warnings; their current identities/count must be measured rather than assumed.
- The source contains JPEG/PNG/WebP photo support, a 20 MiB limit, resizing above a 4800-pixel long edge, upload cleanup after a failed photo-row insert, and image/PDF resources. Do not promise native HEIC support.
- Remote Supabase migration completion, actual account settings, Vercel environment configuration, and deployed versions have not been inspected. Record these as unverified, not completed. No installation or application tests were run during planning.

## Review Focus

1. Fresh workspace with no environment values: install/tests/build/lint work; backend-connected preview clearly requires the beta client variables.
2. Feature branch with no Vercel branch auto-label: the Codespace and intended beta preview display Beta 5A, without changing Public 4.
3. Existing dashboard-managed database with incomplete migration history: identify actual schema state before applying anything; never blindly replay historical scripts.
4. Private forwarded port with temporary hostname: signed-out access is blocked, HMR and route refresh work, and stable auth redirects remain unchanged.
5. Assigned co-driver versus unrelated or inactive user: photo sharing works for permitted accounts and retains denied access for others; PDF viewing does not turn private buckets public.

## File Map

| Path | Responsibility |
| --- | --- |
| `AGENTS.md` | Short operating rules, verification commands, and task-based document routing |
| `docs/product.md` | Roles, navigation, terminology, and observable workflows |
| `docs/architecture.md` | Frontend/service boundaries, data access, RLS, storage, push, and hosting |
| `docs/project-decisions.md` | Curated durable decisions, rationale, source references, and deferred approaches |
| `docs/current-state.md` | Beta/public versions, implemented work, verified versus pending deployment state, issues, priorities |
| `docs/development-workflow.md` | Browser setup, secrets, branching, PRs, validation, manual migrations, promotion, recovery |
| `.devcontainer/devcontainer.json` | Reproducible toolchain, dependency install, extensions, port, and secret-name recommendations |
| `.nvmrc` | Shared Node major: `24` |
| `.github/workflows/ci.yml` | Credential-free, non-deploying checks |
| `.env.example` | Safe client variable placeholders and Beta 5A defaults |
| `.gitignore` | Ignore environment variants while retaining the safe example |
| `README.md` | Concise entrypoint and links to the authoritative workflows/context |
| `docs/releases/beta-5a-test-checklist.md` | Correct migration sequence and photo/PDF test/promotion gates |
| `docs/releases/cloud-development-verification.md` | Sanitized evidence from fresh Codespaces, cloud-task trials, and another desktop browser |

No application refactor, dependency upgrade, schema change, or historical migration rewrite is planned. Preserve existing spec/plan documents as historical references; current context documents carry current truth.

## Task 1: Establish Baseline and Extract Durable Context

**Files:** Create `AGENTS.md` and the five context documents listed above. Update this plan's status only after approval.

**Consumes:** Approved spec, README, release checklist, migrations and SQL tests, `src/App.tsx`, navigation, auth/protected routes, data modules, upload helpers, page behavior, and Git history.

**Produces:** A concise routing contract that future tasks can follow without laptop chat history.

- [ ] Confirm approval, refresh `origin/beta`, and create `chore/cloud-development` from its current SHA. Record any changes since this plan's baseline before proceeding.
- [ ] Run `npm ci`, `npm test`, `npm run test:ui`, `npm run build`, and `npm run lint` on the untouched baseline using Node 24/npm 11.5.2. Record exit codes, suite totals, and exact lint warning file/rule locations. Diagnose unexpected failures before changing configuration.
- [ ] Build a source-to-document inventory. Use repository behavior/migrations as evidence; use the user-approved direction for operational decisions. Mark unavailable laptop-only decisions as unknown rather than inventing them or requiring transcript import.
- [ ] Write `docs/product.md`: driver/admin roles, Home/Contracts/Resources/Profile navigation and Admin access, Availability, Shows & Contracts, Signings, Publish Contracts, linked-signing unit responses, server-timed availability order, final admin assignment, outside-driver limitations, contract signatures/checklists/item review, Red Folder, toolbags, chat, notifications, profile, and Beta Test Show boundaries.
- [ ] Write `docs/architecture.md`: React/Vite route loading, `AuthContext`, protected routes, browser client keys, client data modules and RPCs, active-profile/RLS checks, private bucket names, photo paths `<user-id>/<contract-id>/<unique-file>`, signed URLs, resource `file_type`, upload recovery, Supabase Edge Function push/webhook/cron boundaries, and Vercel SPA rewrites. Document actual behavior without asserting broader security guarantees than the policies provide.
- [ ] Write `docs/project-decisions.md` with decision/rationale/source entries: admin final assignment, response ordering without automatic awards, linked-signing grouping, outside drivers remaining names only, contract wording, beta/public conventions, Supabase/Vercel retention, Codespaces/Codex split, manual migrations, mobile limits, and deferred offline sync/backend replacement/notification diagnostics. No raw conversations.
- [ ] Write `docs/current-state.md`: Beta 5A/Public 4, key committed features, five required Beta 5A migrations, source SHA/date, known lint baseline, deployment/migration status explicitly unverified pending dashboard evidence, and immediate rollout priorities.
- [ ] Write `AGENTS.md`, targeting roughly 100 lines or fewer. Include identity, terminology, branch rules, secrets and migration constraints, all four validation commands, behavior preservation, and a routing table: product work → product; service/security work → architecture plus actual migration SQL; durable choices → decisions; release work → current-state plus release checklist; setup/deploy work → workflow. Do not require every document for every task.
- [ ] Review each factual claim against its source, verify every routed link exists, and confirm a reader can explain release state and assignment/security boundaries using these documents alone.
- [ ] Commit only context documents: `docs: add durable Roadshow project context`.

## Task 2: Reproducible Codespaces and Safe Client Setup

**Files:** Create `.devcontainer/devcontainer.json` and `.nvmrc`; modify `.env.example`, `.gitignore`, and `docs/development-workflow.md`.

**Consumes:** Task 1 context and measured baseline; current package lock and `packageManager: npm@11.5.2`.

**Produces:** A fresh workspace with a shared Node toolchain and a documented private preview command.

- [ ] Set `.nvmrc` to `24`. Use the official dev-container Node image `mcr.microsoft.com/devcontainers/javascript-node:24-bookworm`; verify the tag exists during implementation and build it in Codespaces before accepting it. Do not fall back silently to a different Node major.
- [ ] Configure `postCreateCommand` to install npm 11.5.2 and run `npm ci`; use the image's non-root `node` user. Recommend only `dbaeumer.vscode-eslint`. Do not install Supabase CLI/Docker services or auto-start the app.
- [ ] Forward port 5173, label it Roadshow Driver, and use browser notification when forwarded. Set Codespaces-specific visibility for 5173 to `private` using the supported configuration schema; verify both schema validity and the actual Ports panel. A configuration declaration alone is not acceptance evidence.
- [ ] Document the start command `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`. Retain the normal local dev script and avoid changing Vite host-security settings unless a reproduced forwarding problem requires a narrowly scoped fix.
- [ ] Recommend the secret names `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional `VITE_VAPID_PUBLIC_KEY` in dev-container metadata, with descriptions only. Keep values in GitHub Codespaces secrets scoped to this repository, never in JSON or scripts.
- [ ] Update `.env.example` with placeholders, `VITE_RELEASE_CHANNEL=beta`, and `VITE_RELEASE_VERSION=5A`. Explain that the anonymous client key is browser-visible by design and authorization depends on Auth/RLS. Do not put real project values in the example.
- [ ] Ignore `.env` and `.env.*`, then explicitly allow `!.env.example`. Check with `git check-ignore --no-index .env .env.local .env.production .env.beta.local`; all must be ignored, while `.env.example` must remain trackable.
- [ ] Document that Codespaces secrets are environment variables usable by Vite. When using those variables, copy the safe example to ignored `.env.local` only for missing defaults; its placeholder Supabase values must not be mistaken for a live configuration. Set beta release variables explicitly for feature branches; an app without any configured backend cannot validate live workflows.
- [ ] Jacob configures only beta client values through GitHub account settings → Codespaces secrets → selected repository. Rebuild/restart as required for changed secrets; verify names/presence without printing values. Document separate Codespaces, Codex, Vercel, and Supabase secret stores.
- [ ] Document account MFA, Codespaces budget/usage alerts, and a proposed 30-minute idle timeout. Account setting changes remain explicit browser actions; do not silently enable paid usage.
- [ ] Verify a fresh Codespace installs the expected Node/npm versions and dependencies, opens the app, supports HMR and deep-route refresh, shows Beta 5A, and denies access from a signed-out browser to the private port. Do not broaden Supabase redirects to all Codespaces hostnames.
- [ ] Commit setup files: `chore: add portable Codespaces development setup`.

## Task 3: Non-Deploying GitHub CI

**Files:** Create `.github/workflows/ci.yml`; modify workflow documentation with measured warning baseline.

**Consumes:** Node selection from `.nvmrc`, npm version from `package.json`, existing scripts and lockfile.

**Produces:** One CI check covering both test suites, build, and lint without live backend credentials.

- [ ] Trigger `pull_request` targeting `beta` or `main`, and `push` on `beta` or `main`. Use ordinary PR events, never `pull_request_target`.
- [ ] Use `ubuntu-latest`, `permissions: contents: read`, a 15-minute job timeout, and concurrency grouped by workflow/ref with obsolete runs canceled. Pin checkout/setup-node to reviewed full commit SHAs with readable version comments.
- [ ] Load Node from `.nvmrc`, cache npm using `package-lock.json`, and install npm 11.5.2 before `npm ci`.
- [ ] Run distinct steps in order: `npm ci`, `npm test`, `npm run test:ui`, `npm run build`, `npm run lint`. UI tests are included because the repository already depends on them for release verification.
- [ ] Supply no GitHub repository secrets or Supabase/Vercel deploy tokens. If client values prove necessary for tests/build, use unmistakable dummy values only; do not solve a build failure by giving CI live backend access.
- [ ] Make nonzero exits fail CI. Retain lint rule severity and do not add blanket suppressions. Record exact existing warnings; require no increase in review. If the measured baseline has errors or differs from the stated three warnings, diagnose and propose the smallest corrective change before accepting CI.
- [ ] Open a PR into `beta` and verify the check succeeds without credentials. Exercise a temporary failing test on an unmerged validation branch to prove failure propagation, then remove it and verify the final revision passes. Inspect YAML to confirm there are no deployment/migration commands.
- [ ] Document that branch protection is a separate repository setting: after CI is proven, recommend requiring this check before merges; do not assume it is already enabled or alter protection implicitly.
- [ ] Commit: `ci: validate Roadshow changes without deployment credentials`.

## Task 4: Correct Release and Browser Workflow Documentation

**Files:** Modify `README.md`, `docs/development-workflow.md`, `docs/current-state.md`, and `docs/releases/beta-5a-test-checklist.md`.

**Consumes:** Context/setup/CI contracts from Tasks 1–3 and the existing reviewed SQL; no SQL modifications.

**Produces:** One consistent browser workflow and a release checklist matching the committed Beta 5A code.

- [ ] Make README a short entrypoint linking context, Codespaces setup, commands, release checklist, and existing push/auth setup. Replace blanket migration replay with separate instructions for a new empty database and an existing environment.
- [ ] Add the fifth Beta 5A migration after the four September 29 scripts: `202610010001_beta_5a_photo_resource_uploads.sql`. Correct all references to “four migrations” in current operational instructions, including the promotion gate.
- [ ] Document the manual migration procedure: verify beta versus production project identity, inspect applied history and actual schema/policies, identify only missing scripts, back up database and separately preserve storage, review SQL, apply reviewed scripts in filename order through the dashboard, run relevant SQL checks in beta, and record sanitized completion evidence. Dashboard application may not be represented in CLI migration history; an absent ledger row does not prove a script is unapplied.
- [ ] Explain dependency ordering: backend-required migrations must be verified on the intended beta database before testing a preview with matching code. PR previews may be created before then, but must not be declared ready; plan the schema/deploy sequence before merging to `beta`. No automatic replay or destructive rollback.
- [ ] Expand photo/PDF checks: desktop file picker and mobile selection; supported formats with missing MIME information; near-20 MiB and oversized dimensions; readable zoom/pan; failed-upload retry and row-insert cleanup; admin and co-driver photo viewing; unrelated/inactive access denial; image and PDF resource publishing, PDF view/download, expired signed-link recovery, and existing image compatibility. Test actual API/storage access, not only hidden UI controls.
- [ ] Preserve contract publication/assignment, linked signings, ordering after full unassignment, chat pagination, final-admin protection, appearance, and mobile regression checks already present. Do not make all legacy release tests prerequisites merely for a documentation edit; require them before release promotion.
- [ ] Document hands-on flow: feature branch from latest `beta` → private Codespace preview → validation → commit/push → PR into `beta` → CI and Vercel preview review → beta testing. Codex uses the same branches/review boundary; never writes directly to `main`.
- [ ] Document public promotion separately: approved Beta 5A checklist, production backup and verified missing migrations, reviewed `beta` → `main` PR, Vercel deployment, Public 5 numeric label only at the approved promotion, and current-state/release updates. Until then Public 4 remains unchanged.
- [ ] Preserve stable production Site URL and existing beta redirect rules. Validate invitation/reset links on stable Vercel beta; Codespace passwords can be used for ordinary preview login without treating temporary URLs as permanent auth destinations.
- [ ] Document recovery: commit/push before deleting a workspace; recreate from GitHub; stop idle workspaces; correct failed previews from retained branches; pause release on migration failure; use Codex/web editor if Codespaces quota is exhausted. State mobile boundaries.
- [ ] Check all links, variable names, release labels, migration ordering, and consistency with the approved design, then commit: `docs: document cloud workflow and complete Beta 5A release checks`.

## Task 5: Validate Codex Cloud From Repository Context

**Files:** Create `docs/releases/cloud-development-verification.md`; update `docs/current-state.md` as evidence becomes available.

**Consumes:** Reviewed setup/context merged into `beta`, available Codex repository access, and minimum beta client variables only if live preview is needed.

**Produces:** Sanitized evidence that fresh delegated work follows repository instructions without laptop context.

- [ ] In a new Codex cloud task, choose this repository and `beta` as the base. Configure Node 24/npm 11.5.2 and `npm ci` using the available cloud environment settings; do not assume dev-container lifecycle hooks run in Codex. No backend secrets are needed for documentation or mocked tests.
- [ ] First trial prompt: “Read AGENTS.md and its release/workflow references. Explain the current beta/public versions, required Beta 5A migrations, and feature → beta → main flow. On a feature branch, add a short contributor-facing documentation clarification with source links; do not modify application code, deployments, or databases.”
- [ ] Confirm the trial reports Beta 5A/Public 4, all five migration files, unknown applied-state honestly, admin final assignment, security rules, and PR target `beta`. Verify the task touches only relevant documentation and returns a reviewable branch/PR.
- [ ] Second trial, after Jacob chooses a specific minor UI copy or accessibility improvement: implement that exact change on a separate feature branch, add a meaningful behavior test if warranted, run both suites/build/lint, and open a PR into `beta`. Selection of this change is outside the setup plan; do not invent a feature during setup.
- [ ] Inspect scope, context updates, CI results, and Vercel preview. Reject direct writes to shared/release branches, unexplained behavior changes, credential exposure, or skipped verification.
- [ ] Record task outcome, source/PR SHAs, check results, and preview validation with secrets/private data removed. Do not save full task transcripts. Keep unresolved prerequisites visible rather than marking them passed.

## Task 6: End-to-End Acceptance on Another Desktop Browser

**Files:** Complete `docs/releases/cloud-development-verification.md`; update current-state/workflow only where actual findings change current truth.

**Consumes:** Tasks 1–5 and Jacob's access to GitHub, Codex, Vercel, and beta Supabase from another desktop browser.

**Produces:** Evidence that the laptop can be switched off without blocking the complete workflow.

- [ ] With the original laptop off, sign into the required services on another desktop. Jacob performs browser actions requiring his own authenticated accounts; record blocked steps honestly if access is unavailable.
- [ ] Create a new Codespace from the updated repository, create a feature branch from `beta`, and verify install/toolchain plus `npm test`, `npm run test:ui`, `npm run build`, and `npm run lint`. Record expected baseline warnings separately from new warnings/errors.
- [ ] Configure beta client variables securely, run the private Vite preview, verify Beta 5A and basic admin/driver login/navigation, then verify signed-out port denial, HMR, and deep-route refresh.
- [ ] Make a small documentation edit, commit/push using the browser Codespace, open its PR into `beta`, and verify CI and the Vercel preview. Check the preview's intended beta backend and label; confirm public remains Public 4. Do not merge `main` for this exercise.
- [ ] Review the fresh Codex cloud trial and PR from this second browser without supplying laptop files or chat history.
- [ ] In the beta Supabase dashboard, read actual migration/schema state and record the required scripts as applied, missing, or uncertain. Do not execute a migration solely to prove browser access. Applying any missing scripts follows Task 4's backup/review procedure as a separate explicit operational action.
- [ ] On stable beta, verify invitation/reset links and representative photo/PDF sharing and denied-access checks with permitted test accounts. If a prerequisite migration is missing, record the blocker and withhold live acceptance.
- [ ] Stop the Codespace and verify committed/pushed work remains available from GitHub. Demonstrate that recreating a workspace does not need laptop files.
- [ ] Record date, browser/device, tested SHA, PR/check references, toolchain, commands/exit codes, private-port status, deployment labels, migration evidence, pass/fail/blocked results, and remaining actions. Do not record credentials or identifiable test data.
- [ ] Mark initial rollout complete only when fresh workspace, CI, private preview, both cloud trials, browser PR/Vercel flow, and no-laptop acceptance pass. A full Beta 5A public release remains independently gated by its complete release checklist.

## Deferred Stage 3: Database Automation

Do not implement in this plan. Inventory both remote environments and reconcile repository SQL, actual schema, and any migration ledgers without replaying destructive/data-changing operations. Prepare a separate design and approval for protected migration automation; retain manual production approval. The context/workflow should list this as deferred, not promise automatic database deployment.

## Review and Completion Gates

- **Now:** Jacob reviews this proposed plan before any setup implementation or account configuration.
- **After approval:** Execute Tasks 1–4 on a feature branch and provide a PR into `beta` with measured validation and a clean secret-safe diff. Do not bundle public promotion.
- **Before calling cloud development ready:** Complete Tasks 5–6. Configuration committed successfully is not proof of another-browser acceptance.
- **If access or external account settings block a step:** Record the exact unfinished action and provide browser instructions; do not claim it was performed.

## Source References

- Approved repository design and Beta 5A contract design under `docs/superpowers/specs/`.
- Existing Beta 5A release checklist, migration SQL, SQL tests, application routes/data modules, and latest Git history.
- [GitHub Codespaces port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)
- [GitHub Codespaces account-specific secrets](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces)
- [Node release support](https://nodejs.org/en/about/previous-releases)

Self-review: every approved design section is mapped to Tasks 1–6 or the explicitly deferred database-automation stage. Review-focus conditions have acceptance steps in Tasks 2–4 and 6. This plan adds no application feature or database change and preserves the approval boundary requested by Jacob.
