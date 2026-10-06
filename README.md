# Roadshow Driver

Mobile-first roadshow operations for drivers and administrators, built with
React, Vite, TypeScript, Supabase, and Vercel. GitHub is the durable source of
truth; development does not require Jacob's laptop or its Codex thread.

## Start here

- [Repository instructions](AGENTS.md): operating rules and routed context.
- [Product behavior](docs/product.md) and [architecture](docs/architecture.md).
- [Durable decisions](docs/project-decisions.md).
- [Current release state](docs/current-state.md): **Beta 5A**, **Public 5**.
- [Development workflow](docs/development-workflow.md): Codespaces, Codex cloud,
  secrets, PRs, manual database changes, deployment, and recovery.
- [Beta 5A checklist](docs/releases/beta-5a-test-checklist.md) and
  [cloud rollout evidence](docs/releases/cloud-development-verification.md).

## Development

Use Node 24 from `.nvmrc` and npm 11.5.2 from `package.json`. For browser-based
hands-on development, create a GitHub Codespace from the updated `beta` branch,
create a feature branch, and follow the workflow above. Its Vite port stays
private. Codex cloud tasks use the same repository context and return PRs into
`beta`; `main` stays public. Mobile is for monitoring, review, app testing, and
small emergency text edits, not normal coding or migrations.

For a local checkout, run `npm ci` and supply beta Supabase client values through
an ignored `.env.local` using `.env.example` as a names-only guide. Codespaces
secrets are inherited environment variables; do not commit their values. Start
with `npm run dev` (in Codespaces use
`npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`). Tests/build work without
a live backend; connected preview needs the beta URL and anonymous key.

```sh
npm test
npm run test:ui
npm run build
npm run lint
```

CI runs these checks without database/deploy credentials. The three existing
lint warnings are listed in current-state; new warnings/errors are not accepted.

## Database safety

Migrations initially run manually through the intended Supabase SQL editor from
a desktop browser. For an existing environment, verify actual schema and applied
state before applying **only reviewed missing migrations** in filename order.
Do not blindly replay history; dashboard SQL may be absent from CLI migration
records. New empty databases need an intentional review of the full historical
sequence. See the workflow for backups, storage recovery, and failure handling.

Beta 5A depends on the four September 29 migrations **and**
`202610010001_beta_5a_photo_resource_uploads.sql`, in that order. See the release
checklist for exact filenames, live RLS/photo/PDF checks, and promotion gates.
Do not apply these to production until public release is approved.

New accounts receive `driver`. Promote the initial admin deliberately through
the intended Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-id>';
```

Passwords stay in Supabase Auth. Browser variables may contain only client-safe
values; never supply a service-role key, database password, or private VAPID key
as a `VITE_` variable, commit credentials, or archive raw conversations.

## Device notification setup

The app and database are ready for web push, but each Supabase/Vercel environment needs its own keys and webhook setup:

1. Generate a VAPID public/private key pair with `npx web-push generate-vapid-keys`.
2. Add the public key to Vercel as `VITE_VAPID_PUBLIC_KEY`. Keep the private key out of Vercel's browser variables.
3. Set these Supabase Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example `mailto:admin@example.com`), and a long random `WEBHOOK_SECRET`.
4. Deploy the included function with `supabase functions deploy web-push --no-verify-jwt`.
5. In **Supabase → Database → Webhooks**, create an `INSERT` webhook for `public.notifications`. Send it to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/web-push` with an `x-webhook-secret` header matching the function secret. The old `public.messages` webhook can be removed after the chat migration.
6. In **Supabase → Integrations → Cron**, schedule `select public.create_due_work_notifications();` once each morning. Choose a UTC time that matches the desired local delivery time.

Users can then turn device notifications on and choose new-contract-batch, assignment, work-day, and message alerts from **Profile**. Browser permission is requested only when they press the enable button. Publishing still creates an in-app notification when a user turns off device push for new batches.

`create_due_work_notifications()` is a backend scheduler operation, not a browser
RPC. The additive `20261006152001_restrict_due_work_notification_execution.sql`
migration removes `PUBLIC`, `anon`, and `authenticated` execution while preserving
the existing `postgres` owner and `service_role` access. Keep the cron job running
as `postgres`; the app separately calls the user-scoped
`ensure_my_due_notifications()`.

This migration needs review and separate approval before live application. After
applying it to the intended environment, run the read-only catalog assertions in
`supabase/verification/due_work_notification_permissions.sql` and inspect the next
scheduled job result. The assertions need no pgTAP extension and do not invoke
notification writers. Do not invoke the global writer against live data merely
to test permissions: it can insert notifications and trigger device pushes.

## Fix invitation and password-reset links

In Supabase, open **Authentication → URL Configuration**:

1. Set **Site URL** to the stable production app root: `https://YOUR-PRODUCTION-DOMAIN.vercel.app`. Do not use a deployment-specific preview URL and do not add `/update-password`.
2. Add `https://YOUR-PRODUCTION-DOMAIN.vercel.app/**` to **Redirect URLs**.
3. Add the beta's stable Vercel branch URL followed by `/**` if beta uses the same Supabase project.
4. Keep `http://localhost:5173/**` only for local testing.

No email-template changes or custom domain are required. Leave Supabase's
default invitation template in place. Its `ConfirmationURL` verifies the invite
and returns an authenticated session to the Site URL. The app recognizes the
returned invite session and opens `/update-password` automatically.

Invite users from **Authentication → Users → Add user → Send invitation**. Supabase handles their password securely; the app and its administrators never receive it.

## Release labels

Vercel beta-branch deployments automatically show `Beta 5A`; production remains
`Public 5` after the approved October 5 promotion. Beta labels may include letters, while public release numbers are always displayed as numbers only. In the Vercel beta environment, set `VITE_RELEASE_VERSION=5A`. Public 5 is now deployed from `main`. To change either label without editing code, set
`VITE_RELEASE_CHANNEL` (`beta` or `public`) and `VITE_RELEASE_VERSION` in the
corresponding Vercel environment, then redeploy.

## Beta workflow

The `beta` branch is the testing version. Push changes to `beta` and use its Vercel Preview deployment for testing. The main app remains on `main`. When the beta is approved, merge `beta` into `main` in GitHub and Vercel will deploy it to production.
