# Beta 5A Test Checklist

Use this checklist for the existing `beta` branch and beta Supabase environment. Keep the public `main` deployment and production database unchanged until Beta 5A is approved.

## Before deployment

- [ ] Confirm the beta Vercel project is connected to the `beta` branch.
- [ ] Set `VITE_RELEASE_CHANNEL=beta` and `VITE_RELEASE_VERSION=5A` in the beta Vercel environment.
- [ ] Create a database backup from the beta Supabase project.
- [ ] Download or otherwise verify a recoverable backup of the `roadshow-photos` and `resources` storage buckets.
- [ ] Confirm representative beta data exists: a regular show, linked signings, assigned and unassigned contracts, checklist progress, photos, toolbags, resources, chat threads, and at least two active users.

## Apply beta migrations

Apply these files to the beta Supabase project in this exact order before deploying the matching app code:

1. `202609290001_beta_5a_contract_publishing.sql`
2. `202609290002_beta_5a_reliability.sql`
3. `202609290003_beta_5a_chat_performance.sql`

Then verify:

- [ ] Existing shows, signings, assignments, checklists, photos, resources, and chats still load.
- [ ] The only remaining active administrator cannot be deactivated or changed to a driver.
- [ ] A disabled account cannot open operational data or invoke driver/admin workflows.
- [ ] Saving a show or signing either completes fully or leaves the prior data intact after a forced error.
- [ ] Chat opens with a bounded thread list, older messages load in pages, and the top-bar unread badge clears after reading.

## Contract publishing and assignment

- [ ] Create at least three eligible unassigned contracts, including linked signings when available.
- [ ] Select multiple contracts and use **Publish Contracts** once; confirm they appear as one named batch in Availability.
- [ ] Confirm pay, potential bonus, work date, location, and linked signing details are correct.
- [ ] With two test accounts, respond **Available** in a known order and confirm the admin view shows the correct first-response ranks and timestamps.
- [ ] Confirm users can respond only once per opportunity and linked signings are accepted or declined together.
- [ ] Make the final assignment as an admin; confirm Availability closes the response buttons and shows the assigned team, while the assigned work also appears under Contracts.
- [ ] Assign both an in-app user and an outside driver name. Confirm the outside name is visible to admins but does not create an account or directory entry.
- [ ] Confirm assignment notifications are created and the new-contract-batch device notification follows the user’s **Profile → New contract batches** preference.
- [ ] Withdraw one published opportunity and confirm it is hidden without deleting its batch audit history.

## Search, recovery, and editing

- [ ] Search shows, signings, contracts, templates, checklist reviews, users, resources, Red Folder, FAQ, directory, toolbags, feedback, and chats.
- [ ] Confirm accented names match unaccented search text, clearing search restores date order, and no-result messages include the query.
- [ ] Edit and save a show, signing, checklist template, contract template, toolbag template, resource, toolbag assignment, and user access setting.
- [ ] Test a recoverable failed save by temporarily disconnecting the network; confirm entered data/selections remain available for retry.
- [ ] Upload a supported photo near the size limit and a photo wider than 3200 pixels; confirm the upload is readable and oversized dimensions are reduced.

## Mobile and appearance checks

- [ ] On iPhone Safari, test sign-in persistence, navigation, Publish Contracts, availability response, chat, checklist completion, photo zoom/pan, dark mode, and device-notification permission.
- [ ] On Android Chromium, repeat the same workflow and verify system back navigation does not lose an in-progress form.
- [ ] In every color scheme and dark mode, verify green/red actions, selected/unselected availability buttons, search, sort menus, dialogs, and back buttons remain legible.
- [ ] Confirm the Home footer displays **Beta 5A** and no public release label was changed.

## Promotion gate

- [ ] Run `npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` from a clean checkout.
- [ ] Resolve every new error or warning. The three known pre-existing lint warnings must not increase.
- [ ] Record migration completion and test results before merging `beta` into `main`.
- [ ] Apply the same three migrations to production immediately before the approved public app deployment, with fresh production database and storage backups.
