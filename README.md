# Roadshow Driver

Mobile-first operations app for roadshow drivers and administrators, built with React, Vite, TypeScript, and Supabase.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and anonymous key.
3. Apply `supabase/migrations/202608170001_phase_one_foundation.sql` in the Supabase SQL editor or with the Supabase CLI.
4. Run `pnpm dev`.

New accounts receive the `driver` role. Promote the initial administrator from the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-id>';
```

The browser only receives the public anonymous key. Never add the Supabase service-role key to a `VITE_` variable. Passwords remain in Supabase Auth and are never stored or exposed in application tables.

## Phase 1 scope

- Supabase authentication and password recovery
- Driver/admin profiles and protected routing
- Responsive sidebar and mobile bottom navigation
- Home shell and route placeholders
- Core schema, relationships, indexes, and row-level security
- Private storage buckets prepared for contract files, checklist photos, and resources
