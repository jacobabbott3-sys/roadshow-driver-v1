# Browser development workflow

GitHub owns code, SQL, context, release instructions, and reviewed decisions.
Disposable workspaces must not be the only copy of important work. Read
[AGENTS.md](../AGENTS.md) and relevant routed context for each task.

## Tools and checks

Use Node 24 (`.nvmrc`) and npm 11.5.2 (`package.json`). Install with `npm ci`.
Run both test suites, then build and lint:

```sh
npm test
npm run test:ui
npm run build
npm run lint
```

No live backend credentials are needed for those checks. Known lint warnings are
listed in [current-state](current-state.md); no new warnings/errors are accepted.

## Codespaces setup

1. In GitHub, open this repository, select `beta`, and use **Code → Codespaces →
   Create codespace on beta** once the setup PR has merged. The dev container
   installs Node/npm and runs `npm ci`. No local Supabase stack starts.
2. Create a short-lived feature branch from current `beta`, for example
   `git switch -c feat/describe-change`. Confirm the base before editing.
3. Supply the beta client variables through **GitHub Settings → Codespaces →
   Codespaces secrets → New secret**, granting access only to this repository:

| Name | Value/source | Required for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Intended beta Supabase project URL | Connected app preview |
| `VITE_SUPABASE_ANON_KEY` | Beta anonymous client key | Connected app preview |
| `VITE_VAPID_PUBLIC_KEY` | Beta public VAPID key | Optional device-push tests |

4. Restart the Codespace after adding/changing secrets, and restart Vite after
   changing its environment. Verify presence without printing values. Vite reads
   inherited environment values before `.env` values. Do not copy a file from the
   laptop or supply high-privilege secrets to ordinary development.
5. Set `VITE_RELEASE_CHANNEL=beta` and `VITE_RELEASE_VERSION=5A` for this preview
   (dev-container defaults provide these). `.env.example` has safe placeholders
   only. If using a local `.env.local`, use real beta client values securely or
   keep only release defaults while inheriting Codespaces secrets; placeholders
   are not a working backend. Missing client configuration still permits offline
   tests/build, but cannot prove live workflows.
6. Start the app:

```sh
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

7. Forwarded ports default to private in Codespaces; the supported configuration
   schema has no per-port visibility setting. In **Ports**, verify 5173 is
   **Private**, then open the forwarded HTTPS URL.
   Check HMR and refreshing a deep route. A signed-out browser must be unable to
   access the private port. Do not make it public for ordinary testing.
8. Run checks, commit/push the feature branch, and open a PR targeting `beta`
   through GitHub's browser UI. GitHub Desktop is unnecessary. Review CI and the
   Vercel preview before merging; backend-dependent live tests also require the
   matching beta migrations.

Use MFA on GitHub, OpenAI, Supabase, and Vercel. Configure Codespaces usage alerts,
spending limits, and a 30-minute idle timeout in account settings; do not enable
paid usage implicitly. Save/push work before deletion. Account-specific settings
are not configured merely by committing a dev-container file.

## Secrets and environment boundaries

`VITE_` values are bundled into the browser client. Anonymous keys are client
credentials; Auth/RLS control data access. Never supply service-role keys,
database passwords, access tokens, VAPID private keys, or webhook secrets as
client variables or commit them to Git. `.env`/`.env.*` are ignored except
`.env.example`. Do not log secrets or signed file URLs.

Codespaces secrets, Codex cloud variables, Vercel environment variables, and
Supabase Edge Function secrets are separate stores. They do not synchronize
automatically. Vercel feature previews intended for beta testing need explicit
Beta 5A variables and the intended beta backend; a feature-branch name alone does
not select the app's beta label. Never point ordinary development at production.

## Codex cloud tasks

Select this GitHub repository with `beta` as the base. Codex reads `AGENTS.md` and
only the task's relevant documents, uses a feature branch, runs checks, and
returns a PR into `beta`. Do not write directly to `main` or shared `beta`.

The dev-container lifecycle is not assumed to run inside Codex. Configure the
available cloud environment to use Node 24 and npm 11.5.2, with `npm ci` as setup.
When its global npm prefix is read-only, use a writable workspace/toolchain
prefix rather than changing runtime-owned files. Only minimum beta client
variables are needed for a connected preview; documentation/tests/build require
no real backend secrets. Preserve existing network restrictions; report blocked
dependencies/checks instead of using production credentials to work around them.

Include the requested outcome, target beta release, and acceptance behavior in
each prompt. Do not repeat project history or attach raw transcripts. A change
updates only relevant context. Review its diff, checks, and preview from any
desktop browser. Fresh-task acceptance prompts are in the [verification record](releases/cloud-development-verification.md).

## CI and review

GitHub Actions runs `npm ci`, both suites, build, and lint on PRs targeting
`beta`/`main` and pushes to those branches. It has read-only repository access,
no database/deploy secrets, and no migration/deploy commands. Failed checks block
readiness. Existing warnings stay visible; reviewers verify no increase.

After CI succeeds, recommend making its check required in branch protection.
Protection changes are explicit repository settings, not an assumption of this
setup. Vercel previews/deployments remain the existing Git integration, separate
from CI. Pushing a feature PR can trigger a preview; verify its environment.

## Manual Supabase migrations

**Existing environments:** never run the whole migration directory blindly.

1. Confirm the project identity and whether it is beta or production in the
   dashboard. Check existing migration records **and actual schema/functions/
   policies** against repository SQL. Dashboard-applied scripts may not appear
   in the CLI migration ledger; absence there alone is not evidence to rerun.
2. List reviewed missing migrations in filename order. Mark uncertain state as
   uncertain and reconcile it before executing. Preserve corrected historical
   migrations; do not rewrite/replay data-changing steps such as consolidation.
3. Back up the intended database and separately verify recoverable storage
   copies. Review affected data/security and matching app-code dependencies.
4. Apply only verified missing scripts through **Supabase → SQL Editor** from a
   desktop browser. For Beta 5A, use the five-file sequence in the [release
   checklist](releases/beta-5a-test-checklist.md). Do not touch production merely
   to test cloud access.
5. Run relevant `supabase/tests/` assertions in the intended beta environment
   after inspecting the scripts; use permitted test accounts for real API/RLS
   and private-storage checks. Record filename/date/environment and sanitized
   result, not secrets/user data. A source assertion is not live SQL evidence.
6. If anything fails, pause promotion and understand state before proceeding.
   Do not automatically roll back destructive operations or blindly rerun SQL.

**New empty databases:** review the historical migration sequence and apply in
filename order only after confirming the target is empty and intentional. This
rollout does not create a database, start a local stack, or prove historical
fresh-database compatibility.

Backend-required SQL must be verified in beta before testing matching code.
A PR preview can exist earlier, but is not ready for live acceptance. Agree the
schema/deploy sequence before merging backend-dependent work into `beta`.

Migration automation is deferred until beta/production history and actual schema
are reconciled. A separate approved design must cover environment protection;
production database changes retain manual approval.

## Vercel, Auth links, and public promotion

Keep existing GitHub/Vercel relationships: feature PRs → previews, `beta` → shared
testing, `main` → production. Confirm actual project branch/environment settings
in Vercel; do not infer them from source. Beta uses `VITE_RELEASE_CHANNEL=beta`
and `VITE_RELEASE_VERSION=5A`; production remains `public`/`4`.

Keep production's stable Supabase Site URL and explicit stable production/beta
redirect allowlist. Invitations/password resets are tested on stable Vercel beta
with permitted accounts, not temporary Codespace hosts. Never broaden redirects
to all Codespaces URLs. See [README Auth setup](../README.md#fix-invitation-and-password-reset-links).

Promotion is separate: complete the entire Beta 5A checklist, obtain approval,
back up production database/storage, verify/apply only required missing SQL
immediately before matching app deployment, then merge approved `beta` into
`main` through a PR. At that approved promotion, set production's numeric release
to Public 5, verify deployment and Auth/data workflows, and update current-state
and release notes. Setup/PDF-viewer work alone does not authorize promotion.

## Recovery and mobile limits

Commit and push before deleting a Codespace. A new workspace can reinstall from
GitHub; stopped/deleted workspaces must not hold the only essential context.
If usage is exhausted, Codex cloud or GitHub's lightweight editor can still help;
another full Codespace may require allowance reset or an explicit paid-usage
choice. GitHub retains failed-preview commits so they can be corrected.

Mobile can monitor checks/deployments/services, review small PRs, test the deployed
app, and perform tiny emergency text edits. Use a desktop browser for normal
coding, database migrations, security work, and conflict resolution. Initial
rollout is complete only after [another-desktop acceptance](releases/cloud-development-verification.md)
with the original laptop off.
