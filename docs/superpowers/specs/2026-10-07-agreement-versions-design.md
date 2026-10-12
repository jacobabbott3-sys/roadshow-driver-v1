# Agreement versions — reconstructed Beta 6A design

Reconstructed October 7 from Jacob's approved requirements and current beta
`c439a0f`; **not recovered Mac files**. The checkpoint is recorded separately.
The approved seven stages can proceed without reapproval of this reconstruction.

## Behavior

Every issued agreement stores immutable full terms, base pay, potential bonus,
per diem, work identity, schedule, entitlements, checklist sections/items,
instructions, required/photo flags, and their real source IDs. Null amounts and
zero remain distinct. Driver and admin acceptance belong to the same version,
authenticated account, server time, and (for driver acceptance) a real assignment
period. Either role may sign first. Any active assigned account, including an
admin assigned as a driver or a trainee, can be the driver signer.

Pay, bonus, full terms, document identity, per diem, meals/lodging entitlement,
work name/type/artist/venue/address/city/state/bin count, show dates, service
date/time, signing/setup times, linked work, and checklist content changes issue
a new version and require both signatures again. Signing follows reviewed version
IDs; stale requests cannot accept another version. Typed legal names are evidence
alongside account identity, not a replacement for authentication.

Jacob confirmed on October 7: **all hotel details and check-in/check-out dates
remain operational edits**, including hotel name/address. Ordinary admin notes,
contact/confirmation details, and details-unlock timing do not reopen signatures.
Historical copies retain what was accepted; current operational information may
differ and must not be presented as the accepted historical copy.

Changing a signed agreement or removing/replacing its accepting driver requires
an explicit before/after consequence preview and confirmation. Both signatures
reopen. Nonsigner roster changes do not reopen. Retained roster members keep
assignment-period identity; a returning driver receives a new period. Old
signatures never count for the new assignment. Full unassignment preserves
published response ordering and reopens availability through existing behavior.

Checklist progress, response IDs and photos survive revisions. Issued template
content cannot change beneath a signature. Template editing preserves matching
IDs/flags/responses; changes to issued content use the same confirmed revision
boundary. An older deactivated template remains valid for an ordinary save.

New submissions and final decisions require current driver acceptance. Draft
checklist work may continue while signatures are pending. Never label an unsigned
revision accepted. An active former signer may read only their own historical
receipt, without restoring current contract/show/team/chat access. Legacy
signatures without snapshots are labeled “Historical accepted copy unavailable”;
no inferred historical text or signer identity is generated.

Removal and revision notices are recipient-only, in-app only. They have an
explicit device-push exclusion, no email path, and historical-receipt links.

## Architecture and security

Add immutable agreement versions, signatures, and assignment periods with
restricting foreign keys and recipient-scoped reads. Current version pointer and
legacy display columns are maintained only through authorized RPCs. No client
supplied timestamps or freely settable session flags authorize evidence writes.
Revoke implicit PUBLIC execution of new functions, qualify object names and
fix search paths. Old signing/edit/template/assignment RPCs and direct writes
must fail closed when they would bypass version review.

Use one canonical server mutation path for preview and commit. Preview rolls back
all proposed writes, returns exact normalized resulting content and consequences,
and binds a token to both pre-state and requested payload. Commit locks in a
consistent order, recomputes and rejects stale tokens atomically. Duplicate
signing is idempotent; edits/roster changes serialize with signing. Do not add a
general evidence erasure path; beta test reset is denied once evidence exists
unless a separately scoped exception is explicitly implemented and tested.

## Boundaries

Public 5/main unchanged. No push, PR, merge, deployment, live SQL/data, real notices,
secrets or settings changes. Beta and public share Supabase: synthetic disposable
database tests only. Migrations are forward-only review artifacts, not applied
state. Remote publication may trigger Vercel previews and requires separate
specific approval if enabled. Future rollout needs compatible public/frontend
sequencing and explicit live authorization.

## Verification

Real PostgreSQL role/RLS and write-denial tests, signing order/retries/staleness,
assignment return/removal/trainees, normalization and JSON null, template bypass,
source IDs/responses, former-recipient privacy, operational gates, and push
exclusion. Fresh per-stage independent reviews plus whole-branch review. Full
unit/UI/build/lint remain required; distinguish SQL emulation from live Supabase,
and report any concurrency guarantees not exercised by the runtime.
