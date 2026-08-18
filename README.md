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

If Phase 1 is already deployed, run only `202608170002_driver_experience.sql` before deploying the Phase 2 application code.
