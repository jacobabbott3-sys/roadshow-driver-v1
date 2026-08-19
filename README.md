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

## Device notification setup

The app and database are ready for web push, but each Supabase/Vercel environment needs its own keys and webhook setup:

1. Generate a VAPID public/private key pair with `npx web-push generate-vapid-keys`.
2. Add the public key to Vercel as `VITE_VAPID_PUBLIC_KEY`. Keep the private key out of Vercel's browser variables.
3. Set these Supabase Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example `mailto:admin@example.com`), and a long random `WEBHOOK_SECRET`.
4. Deploy the included function with `supabase functions deploy web-push --no-verify-jwt`.
5. In **Supabase → Database → Webhooks**, create an `INSERT` webhook for both `public.notifications` and `public.messages`. Send them to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/web-push` with an `x-webhook-secret` header matching the function secret.
6. In **Supabase → Integrations → Cron**, schedule `select public.create_due_work_notifications();` once each morning. Choose a UTC time that matches the desired local delivery time.

Users can then turn device notifications on and choose assignment, work-day, and message alerts from **Profile**. Browser permission is requested only when they press the enable button.

## Fix invitation and password-reset links

In Supabase, open **Authentication → URL Configuration**:

1. Set **Site URL** to the main Vercel app's password setup page: `https://YOUR-PRODUCTION-DOMAIN.vercel.app/update-password` (not localhost and not a Supabase URL).
2. Add the exact main app URL followed by `/**` to **Redirect URLs**.
3. Add `https://*-jacobabbott3-sys.vercel.app/**` for Vercel beta previews.
4. Keep `http://localhost:5173/**` only for local testing.

Invite users from **Authentication → Users → Add user → Send invitation**. Supabase handles their password securely; the app and its administrators never receive it.

## Beta workflow

The `beta` branch is the testing version. Push changes to `beta` and use its Vercel Preview deployment for testing. The main app remains on `main`. When the beta is approved, merge `beta` into `main` in GitHub and Vercel will deploy it to production.
