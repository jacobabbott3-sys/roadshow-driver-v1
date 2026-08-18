# Roadshow Driver

Mobile-first operations app for roadshow drivers and administrators, built with React, Vite, TypeScript, and Supabase.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and anonymous key.
3. Apply the SQL files in `supabase/migrations` in filename order using the Supabase SQL editor or CLI.
4. Run `pnpm dev`.

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
