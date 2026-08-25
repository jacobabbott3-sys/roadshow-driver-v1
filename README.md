# Roadshow Driver

Mobile-first operations app for roadshow drivers and administrators, built with React, Vite, TypeScript, and Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and anonymous key.
3. Apply the SQL files in `supabase/migrations` in filename order using the Supabase SQL editor or CLI.
4. Run `npm run dev`.

New accounts receive the `driver` role. Promote the initial administrator from the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-id>';
```

The browser only receives the public anonymous key. Never add the Supabase service-role key to a `VITE_` variable. Passwords remain in Supabase Auth and are never stored or exposed in application tables.

## Current scope

- Supabase authentication and password recovery
- Driver/admin profiles and protected routing
- Responsive sidebar and mobile bottom navigation
- Home shell and route placeholders
- Core schema, relationships, indexes, and row-level security
- Private storage buckets prepared for contract files, checklist photos, and resources
- Driver contracts and contract detail
- Interactive sectioned checklists
- Private required-photo uploads
- Contract acknowledgement/signing
- Upcoming-show availability
- Published resources, FAQs, and feedback
- Driver profile editing
- Admin dashboard and operational counts
- Show creation and driver contract assignment
- Checklist template builder and submission review
- User role and activation management
- Resource publishing, feedback review, and toolbag assignment

If Phase 1 is already deployed, run only `202608170002_driver_experience.sql` before deploying the Phase 2 application code.

For the admin workspace, run `202608170003_admin_workspace.sql` after the Phase 2 migration. Create a checklist template before creating contracts; the newest active template matching the contract type is attached automatically.

Run `202608170004_admin_editing.sql` to enable editable checklist templates, explicit setup/teardown checklist assignments for each show, and published contract terms. Show checklist changes are also applied to existing matching contracts.

Run `202608180001_contract_workflow_corrections.sql` to merge show and contract configuration, add a separate setup/teardown work date, and enable reliable assigned-driver checklist completion.

Run `202608180002_single_contract_per_show.sql` to consolidate any legacy duplicate contracts and enforce one contract per show. The migration keeps the most progressed or assigned contract for each show.

Run `202608180003_beta_collaboration.sql` for the beta features: multiple drivers, messages and notifications, dual signatures, toolbag templates and quantities, and Red Folder image uploads.

Run `202608180004_notification_review_fixes.sql` to add checklist submission alerts, live message/notification badges, notification preferences, and secure device push subscriptions.

Run `202608180005_item_level_checklist_review.sql` to enable full item-by-item admin review, correction notes, driver resubmission of denied items, and persistent checklist review history.

Run `202608190001_operations_expansion.sql` for account-synced appearance settings, color schemes, group chat, reusable contract templates, signings, the team directory, public assignment visibility, per diem and lodging details, and setup times.

If an earlier beta database already installed the contract-email queue, run `202608190002_remove_contract_email.sql` to remove it safely.

Run `202608190003_beta_v3b.sql` for beta v3b availability pay/work-date details and safe checklist-template editing that preserves completed checklist history.

Run `202608190004_beta_test_show.sql` to add the admin-only, resettable Beta Test Show sandbox. Each admin can create one Test Show from the beta Admin overview; resetting it clears test workflow progress without touching real shows.

Run `202608190005_checklist_review_fix.sql` to correct item-level checklist review saves and final approvals by removing ambiguous database variable names.

Run `202608210001_beta_round.sql` to include signings in the shared availability and assignment summaries used by the linked-signing experience.

Run `202608240001_beta_4b.sql` to add the account-synced Extreme Confetti Mode profile setting used by Beta 4B.

## Device notification setup

The app and database are ready for web push, but each Supabase/Vercel environment needs its own keys and webhook setup:

1. Generate a VAPID public/private key pair with `npx web-push generate-vapid-keys`.
2. Add the public key to Vercel as `VITE_VAPID_PUBLIC_KEY`. Keep the private key out of Vercel's browser variables.
3. Set these Supabase Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example `mailto:admin@example.com`), and a long random `WEBHOOK_SECRET`.
4. Deploy the included function with `supabase functions deploy web-push --no-verify-jwt`.
5. In **Supabase → Database → Webhooks**, create an `INSERT` webhook for `public.notifications`. Send it to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/web-push` with an `x-webhook-secret` header matching the function secret. The old `public.messages` webhook can be removed after the chat migration.
6. In **Supabase → Integrations → Cron**, schedule `select public.create_due_work_notifications();` once each morning. Choose a UTC time that matches the desired local delivery time.

Users can then turn device notifications on and choose assignment, work-day, and message alerts from **Profile**. Browser permission is requested only when they press the enable button.

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

Vercel beta-branch deployments automatically show `Beta 4B`; production shows
`Public 4`. Beta labels may include letters, while public release numbers are always displayed as numbers only. To change either label without editing code, set
`VITE_RELEASE_CHANNEL` (`beta` or `public`) and `VITE_RELEASE_VERSION` in the
corresponding Vercel environment, then redeploy.

## Beta workflow

The `beta` branch is the testing version. Push changes to `beta` and use its Vercel Preview deployment for testing. The main app remains on `main`. When the beta is approved, merge `beta` into `main` in GitHub and Vercel will deploy it to production.
