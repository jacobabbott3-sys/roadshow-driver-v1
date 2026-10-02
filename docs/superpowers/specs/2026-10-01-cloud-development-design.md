# Cloud Development and Durable Project Context Design

## Purpose

Make the Roadshow Driver App fully maintainable from any desktop computer with a web browser, without depending on Jacob's current laptop for source code, development tools, project knowledge, testing, or deployment. Phones and tablets remain monitoring and emergency-access tools rather than the primary development environment.

This change must preserve the existing GitHub, Vercel, and Supabase architecture and avoid disruptive infrastructure changes before the app's first season.

## Success Criteria

- A new browser-based workspace can be created from the GitHub repository without copying files from the current laptop.
- The workspace installs the expected Node.js toolchain and project dependencies consistently.
- The application can be run and previewed from the browser workspace.
- Codex cloud tasks can understand the product, architecture, operating rules, release state, and prior decisions from version-controlled project documentation.
- A contributor can test, commit, push, and open a pull request without GitHub Desktop.
- Vercel continues to deploy branch previews and the public release through the existing Git workflow.
- Supabase changes remain deliberate and reviewable.
- No private credentials or passwords are committed to Git.
- Losing or replacing the current laptop does not lose project code or essential project context.

## Non-Goals

- Replacing Supabase or Vercel.
- Building a permanent self-managed development server.
- Making phones or tablets full development environments.
- Automatically applying database migrations during the first rollout.
- Archiving complete raw chat transcripts in the repository.
- Changing the beta-to-public release process beyond making it accessible from the cloud.

## Recommended Architecture

### Source of truth

GitHub remains the source of truth for application code, database migrations, documentation, release instructions, and durable project context. A local checkout, Codespace, or Codex cloud sandbox is disposable and can be recreated from the repository.

The existing branches retain their meanings:

- `beta` is the shared testing version and feeds the stable beta deployment.
- `main` is the public release branch.
- Normal changes start on short-lived feature branches and enter `beta` through a pull request.
- A public release is made by merging the approved `beta` state into `main`.

### Browser development environment

GitHub Codespaces is the primary hands-on environment. The repository will contain a small dev-container configuration that:

- uses a supported Node.js version;
- installs dependencies with `npm ci`;
- recommends only the extensions needed for this project;
- forwards the Vite development port privately;
- provides a clear command for starting the application;
- does not install or start a local Supabase stack by default.

The forwarded development port remains private to the authenticated GitHub user unless the user explicitly changes its visibility. Full authentication-link testing continues on the stable Vercel beta deployment because Codespace URLs are temporary.

### Codex cloud work

Codex cloud tasks operate against the GitHub repository instead of this laptop's working directory. Tasks should use feature branches and pull requests rather than writing directly to `main`. They may target `beta` only through the normal review workflow.

The cloud environment receives only the minimum variables required to build and preview the client. Durable instructions live in the repository, not in a single Codex thread. A task-specific prompt should describe the requested outcome; it should not need to repeat the entire product history.

### Existing hosting and backend

Vercel remains connected to GitHub. Feature branches and pull requests receive preview deployments, `beta` remains the testing deployment, and `main` remains production.

Supabase remains the authentication, database, storage, and Edge Function provider. During the first rollout, migrations continue to be applied deliberately through the Supabase dashboard from a desktop browser. Migration automation is deferred until the historical migration state has been reconciled and verified against both beta and production.

## Durable Project Memory

The project will use a concise instruction file plus routed reference documents. The goal is to preserve decisions and current truth without forcing every task to ingest an oversized transcript.

### `AGENTS.md`

The repository-root `AGENTS.md` will contain only durable operating instructions:

- project identity and primary user groups;
- essential terminology;
- branch and release rules;
- security constraints;
- required verification commands;
- rules for preserving existing behavior and migrations;
- a routing table pointing Codex to the appropriate document for product, architecture, database, deployment, or release work.

It will not duplicate the detailed product specification or require every document to be read for every task.

### Context documents

The implementation will create or consolidate these documents:

- `docs/product.md`: product purpose, roles, navigation, workflows, and feature behavior.
- `docs/architecture.md`: React/Vite frontend, Supabase services, authentication, RLS, storage, notifications, and Vercel deployment boundaries.
- `docs/project-decisions.md`: curated decisions from prior conversations, including terminology, role behavior, release conventions, and intentionally rejected approaches.
- `docs/current-state.md`: public and beta versions, implemented features, known issues, pending migrations, and immediate priorities.
- `docs/development-workflow.md`: Codespaces, Codex cloud, branching, pull requests, testing, database changes, Vercel previews, and public promotion.
- `docs/releases/`: existing release-specific checklists and release notes.

The context summary will be synthesized from the existing repository documentation, migrations, application behavior, release notes, and the important requirements and decisions represented in the available conversation history. It will not include credentials, passwords, access tokens, private user data, or a verbatim conversation archive.

### Keeping context current

Every material change must update the documentation that represents current truth:

- Feature behavior changes update `docs/product.md` when needed.
- Service boundaries, database patterns, or deployment changes update `docs/architecture.md`.
- A durable product or operational choice updates `docs/project-decisions.md`.
- Release number, known issue, pending migration, or next-priority changes update `docs/current-state.md`.
- Deployment procedure changes update `docs/development-workflow.md`.

`AGENTS.md` will instruct Codex to update only relevant documents and avoid rewriting unrelated context on every task.

## Secrets and Access

### Repository safety

- `.env` and `.env.local` remain ignored by Git.
- `.env.example` contains variable names and safe descriptions only.
- Supabase service-role keys, database passwords, access tokens, VAPID private keys, and webhook secrets must never use a `VITE_` prefix and must never be committed.
- User passwords remain exclusively in Supabase Auth.

### Codespaces

GitHub Codespaces secrets provide the browser-safe variables required for local preview, including the Supabase project URL, anonymous client key, and optional public VAPID key. The dev-container configuration will list recommended secret names without containing their values.

High-privilege Supabase credentials are not required for ordinary app development. Database migrations remain a separate, deliberate dashboard action during the initial rollout.

### Account security

GitHub, Vercel, Supabase, and OpenAI accounts should use multi-factor authentication. Codespace preview ports stay private. Spending limits and usage alerts should be configured for Codespaces, and idle Codespaces should stop automatically to limit cost.

## Day-to-Day Workflow

### Codex-led change

1. Start a Codex cloud task connected to the repository.
2. Describe the requested outcome and the target release.
3. Codex reads `AGENTS.md` and the documents routed for that task.
4. Codex creates or uses a feature branch, implements the change, and runs verification.
5. Review the resulting pull request and Vercel preview from any desktop browser.
6. Merge into `beta` when ready for shared testing.
7. Apply any reviewed Supabase migration manually to the beta Supabase project.

### Hands-on change

1. Open the repository in GitHub Codespaces.
2. Create a feature branch from the current `beta` branch.
3. Run the app through the private forwarded Vite port.
4. Run tests, lint, and the production build.
5. Commit, push, and open a pull request into `beta`.
6. Test the Vercel preview before merging.

### Public release

1. Confirm the beta test checklist is complete.
2. Confirm all required migrations have been applied to the intended production Supabase project.
3. Merge `beta` into `main` through GitHub.
4. Verify the Vercel production deployment and release label.
5. Update `docs/current-state.md` and the release notes.

## Mobile Use

Mobile access is limited to:

- checking GitHub pull-request and workflow status;
- reviewing small diffs and approving changes;
- monitoring Vercel deployments;
- checking Supabase service status;
- testing the deployed Roadshow Driver App;
- making a very small emergency text edit through GitHub when necessary.

Database migrations, security changes, conflict resolution, and normal coding should be performed from a desktop browser workspace.

## Continuous Integration

A GitHub Actions workflow will run on pull requests and relevant branch pushes. It will use the supported Node.js version and run:

1. `npm ci`
2. `npm test`
3. `npm run build`
4. `npm run lint`

The current known lint warnings should be documented or resolved so new warnings can be distinguished from existing ones. The workflow must fail on test, build, or lint errors. It must not receive production database credentials and must not deploy Supabase migrations in the initial rollout.

## Failure and Recovery Behavior

- A Codespace can be deleted and recreated without losing committed work or project knowledge.
- Uncommitted Codespace work must be committed or pushed before deleting the Codespace.
- If Codespaces usage is exhausted, Codex cloud tasks and GitHub's lightweight web editor remain available, while a new full Codespace may require the monthly allowance to reset or paid usage to be enabled.
- If a Vercel preview fails, GitHub retains the branch and commit for correction.
- If a migration fails, the application deployment must not be promoted to public until the database state is understood and corrected.
- No automation will attempt to roll back destructive database changes automatically.

## Rollout Plan

### Stage 1: Portable context and workspace

- Push the current `beta` commit so GitHub contains the latest work.
- Add the durable context documents and repository instructions.
- Add the Codespaces dev-container configuration.
- Add the non-deploying continuous-integration workflow.
- Configure Codespaces secrets through GitHub settings.
- Create a fresh Codespace and verify install, test, build, lint, and private app preview.

### Stage 2: Cloud task validation

- Connect the GitHub repository to the available Codex cloud workflow.
- Run one small documentation-only task from a different computer.
- Run one low-risk application change through a feature branch and pull request.
- Confirm Codex follows the repository instructions and updates relevant context.

### Stage 3: Database workflow improvement

- Inventory the migration history recorded by beta and production Supabase projects.
- Reconcile repository migrations with remote history without replaying already-applied destructive operations.
- Design a separately approved GitHub deployment workflow with environment protections.
- Keep production database deployment manually approved even if automation is later added.

## Verification

The initial implementation is complete only when:

- a new Codespace can be created from the repository;
- `npm ci`, `npm test`, `npm run build`, and `npm run lint` run there;
- the Vite app opens through a private forwarded port;
- no `.env` file or secret value is committed;
- a fresh Codex task can explain the current release state and branch workflow using repository context;
- a feature branch can produce a Vercel preview;
- the existing laptop can be turned off without blocking the remaining workflow.

## References

- [GitHub Codespaces quickstart](https://docs.github.com/en/codespaces/quickstart)
- [GitHub Codespaces security](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces)
- [GitHub Codespaces included usage](https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [OpenAI guidance on repository `AGENTS.md`](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
- [OpenAI durable project memory example](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)
