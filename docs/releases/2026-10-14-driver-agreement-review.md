# Driver and admin agreement frontend review — local only

## Current status after admin integration

The latest local follow-up adds explicit admin acceptance using the existing
versioned review UI and removes the legacy direct signature-write path. It resolves
the admin-signing blocker identified in the earlier whole-candidate assessment
below. Historical statements about that blocker describe the earlier commit;
see the final section for current scope, verification and remaining requirements.
No publication or live signing has occurred.

## Feasibility and base

The Public 6 native candidate at b22e12e38565edd3e1ff24ebc2b977c47586796e
already contains version display, explicit acceptance, stale-version handling,
and offline protection. Its broader Beta 6A port also contains later-schema
queries and RPCs, so promoting it wholesale is not a minimal compatibility fix.

This work instead starts at 5c3bf70ae1bcf4f7893b413e8a9d24467add3da0, the committed
native Public 5 base, on local branch `review/frontend-exact-agreement`. A separate
bare repository and worktree inside task-4 avoid modifying either existing native
checkout's Git metadata or dirty files. The default beta/PR workflow is superseded
here by the explicit local-review-only request. No PR, push, deployment or install.

## Changes and evidence

- Reuse AgreementCopy, AgreementSigning and agreement response types from the
  Public 6 candidate. Preserve supplied legal text and pinned checklist text.
- Replace ContractDetailPage's old driver signing form/RPC with that review flow.
  Keep its private document download control, verified-live mutation guard and
  saved-change refresh event. Expose the Contract tab on signing assignments.
- Port only the two existing review/accept wrappers. Surface Supabase error
  messages and pass the exact displayed version; no fallback or automatic accept.
- Require legal name and explicit acknowledgment. Reset consent across contracts,
  roles and versions; reject attempts while loading, busy or in an error state.
- Do not add history navigation or APIs, revision/preview/commit APIs, acceptance
  gates, archived checklist queries, native snapshot changes or database changes.

Authoritative source inspected (not executed): commit
`a02f5521b703931b3dfa6747e6bd1d79af3d5772`, files
`supabase/migrations/202610070001_beta_6a_agreement_storage.sql` and
`supabase/migrations/202610070002_beta_6a_agreement_signing.sql`.
The existing RPC arguments are:

- review: `target_contract`
- accept: `target_contract`, `expected_version`, `acceptance_role`, `legal_name`

The getter can issue an agreement. No hosted getter, acceptance or database API
was called during this task. All regression tests use fixtures/mocks.

## Verification

- `npm test`: 79 passed.
- `npm run test:ui`: 45 files, 150 tests passed, including driver/admin agreement regressions.
- `npm run build`: passed (TypeScript and Vite).
- `npm run lint`: zero errors, the three documented baseline warnings.
- `npm run test:native`: 2 passed.
- `git diff --check`: passed.

Coverage includes full terms/pay/checklist rendering, exact RPC argument names,
explicit acceptance of the displayed version, changed version/text and consent
reset, failed initial review, failed refresh after rejection, native offline
blocking, legacy evidence without silent acceptance, and both show/signing page
integration with no legacy RPC fallback.

Node v24.19.0 matches the Node 24 requirement. Available npm is 11.17.0 rather than
the pinned 11.5.2. No installation was performed: existing node_modules were copied
into this isolated worktree. package.json and package-lock.json are identical to
the candidate supplying those dependencies. Thus these results are not a fresh
`npm ci` reproducibility check. UI tests emit the existing jsdom navigation notice.
No live browser, device signing, Xcode archive, provisioning or installation tested.

## Remaining review requirements and compatibility

The reported production state has only the agreement storage and signing changes
applied. This task did not re-verify hosted state. An independent integrated review
must establish effective API/permission behavior, agreement issuance side effects,
existing record compatibility and end-to-end acceptance before publication.

Checklist submission remains unresolved. This patch deliberately retains the old
checklist flow; successful driver acceptance does not prove submission works.
Existing admin signature updates in adminData.ts still write signature fields
and may be rejected by the installed guard. Admin workflows are not repaired by
this driver-only candidate. Agreement changes that require later backend behavior
can continue to reject; this client does not manufacture replacement versions.

The installed old iPhone binary continues using its bundled old frontend and its
signing RPC is incompatible with the reported production behavior. Neither a
local diff nor a website promotion updates that native bundle. This patch keeps
the Public 5 native identity, origin guard, offline cache format and permissions;
compatibility is source-level only, pending independently approved integration,
native packaging and physical-device verification. Do not replace the installed
app or promote the broader Public 6 candidate based on these local checks alone.

No blocked migration was retried or replaced, and no SQL workaround was created.
Publication remains on hold until an independently reviewed integrated recovery
plan is approved.


## Independent local code review follow-up

A separate reviewer inspected exact candidate commit
`56c0cb60181c822e6c1495d942611de32fb9cd13` and the source definitions above.
They identified three P2 frontend findings: acceptance continuations could invoke
the issuing getter after review unmounted/disabled; the shared async hook could
let an older response replace a newer review; and the port dropped the prior
missing-terms signing prerequisite.

The follow-up replaces only the agreement loader with a latest-request guard,
invalidates request/lifecycle scopes on cleanup, checks the scope before any
acceptance follow-up getter/callback, and restores the prerequisite against the
displayed version's terms. Five additional mocked regressions cover late success
and rejection after disabling, StrictMode response ordering, and null/empty terms.
The three lifecycle/ordering cases failed before the fix and passed afterward.

The independent reviewer rechecked the follow-up diff and confirmed all three
findings resolved, with no new actionable findings. They confirmed the displayed
and accepted version are drawn from the same object and found no hidden dependency
on later migrations. The reviewer performed read-only source review, not live or
device testing. The implementer reran the full UI suite, build and lint, with the
results above; the 79 unit and 2 native pipeline passes are from the initial run.
This review does not approve publication or establish hosted compatibility.

## Whole-candidate compatibility assessment after reported database test

Assessed application source at `31e04022d0c80339517f14c3e3b33497ff11ffbb`,
including inherited web/native code, against local baseline definitions plus the
two agreement definitions. The parent task reports independently reading a new
production ledger entry `fix_submit_my_checklist_agreement_context`, version
`20261014024529`, and its function definition. Jacob's independent agent reports
a production database-level rollback test covering driver agreement load/sign,
eight required items, submission, admin signing, legacy-signing rejection and
post-acceptance terms-edit rejection. No frontend build/commit, real driver
session, browser flow or installed app was tested by that report. This task did
not query hosted data or execute any database function. The new evidence updates
the earlier database-submission uncertainty; it does not establish app integration.

| Surface/dependency | New patch or inherited | Local compatibility finding | Release assessment |
| --- | --- | --- | --- |
| Driver agreement review/accept | New patch | Only `get_contract_agreement(target_contract)` and `accept_contract_agreement(target_contract, expected_version, acceptance_role, legal_name)`; response fields match the two source definitions. | Source-compatible; mocked tests pass, actual app/session untested. |
| Archived checklist columns | Inherited checklist readers unchanged | No `archived` queries in candidate TS/TSX or native background readers. Uses baseline sections/items fields. | No later archival-schema dependency found. |
| Agreement notification fields | Inherited notifications unchanged | No `agreement_notice_key`. `communications.ts` reads baseline notification fields and calls baseline `ensure_my_due_notifications`. | No agreement-notices migration dependency found; live grants/behavior unverified. |
| Current acceptance helpers | New review plus inherited checklist controls | No `current_driver_acceptance`, `contract_acceptance_gate` or current-agreement column query. Checklist submission UI still checks `signed_at`. | No later acceptance-gates dependency; do not claim current-version-aware checklist gating. |
| Preview/commit/revision APIs | Inherited admin editing unchanged | No `preview_agreement_change` or `commit_agreement_change`. Older save, assignment and template paths remain. Agreement field/show edits can conflict with installed agreement guards or cause acceptance rejection; no reviewed-revision UI exists here. | Whole-app workflow compatibility remains unresolved; no bypass or backend replacement proposed. |
| Onboarding | Inherited Auth/Profile | No onboarding RPC or onboarding-column reference. Uses Supabase Auth and baseline explicit profile fields. | No later onboarding dependency found; real Auth/session integration untested. |
| Checklist submit | Inherited `driverData.ts:243` | Calls `submit_my_checklist` with `target_contract_id`. Parent reports the repaired function retains active-account, required-item and assignment/signature checks. Client has no new schema dependency. | Reported database-level success; this candidate's browser/native submission flow still untested. |
| Admin signing | Inherited `adminData.ts:369`, `AdminShowsPage.tsx:274` | Still directly updates `admin_signature_name` and `admin_signed_at` after the show-save operation. ContractDetailPage does not expose the reusable component's admin role. Direct writes conflict with the agreement guard. | **Release blocker for a complete app repair.** Database RPC admin-signing success does not cover this path. The show save may complete before its separate signature request fails. |
| Native saved views/Watch/widgets | Inherited | Baseline snapshot v1 and explicit baseline columns; no agreement issuance in background readers. Patched signing mounts only in verified live review. | No later-schema dependency found; installed binary is unchanged and not validated by these tests. |
| Remaining RPCs/tables | Inherited | Inventoried all 31 literal runtime RPC names in `src`; every name has a definition in baseline migration source plus the two agreement files. Reviewed direct table reads/writes and native REST reader. | No additional named missing-RPC dependency found; source existence is not proof of production grants, effective replacements, RLS or complete behavior. |

The new driver patch itself remains a feasible frontend-only compatibility unit.
It cannot be labeled a complete integrated recovery release while the inherited
admin-signing path is incompatible. A separately scoped frontend change could
route explicit admin review through the existing versioned acceptance API and
remove the legacy direct-write path; that change is not present or tested here.
Agreement editing/reassignment behavior also needs a defined, independently
reviewed scope rather than assuming later migrations are available.

A safe local mock check for this candidate is:

```sh
npm run test:ui -- src/components/AgreementSigning.test.tsx src/components/AgreementCopy.test.tsx src/lib/agreementData.test.tsx src/pages/ContractDetailAgreement.test.tsx
```

These 20 tests mock the issuing/accepting APIs and prove only the covered client
behavior. A future mock integration test should drive the actual admin route and
fail on any direct signature-field write; the existing component-level admin-role
test does not establish that the application routes admins through it. No new tests
or application changes were made for this documentation-only audit. Do not treat
the reported database rollback test as frontend end-to-end acceptance. Publication
remains on hold pending a tested, compatible integrated release.


## Admin integration follow-up — current application candidate

- Both Shows & Contracts and Signings now link to
  `/admin/contracts/:id/agreement`, under the existing active-admin route guard.
  This reuses ContractDetailPage with an explicit admin-review prop, opens the
  Contract tab and passes `acceptanceRole="admin"` to AgreementSigning. An additional
  active-admin/user/loading check gates the review component, alongside the
  existing verified-live native mutation guard. Driver routes remain driver-role.
- The administrator sees the issued agreement content/version and must enter a
  legal name and explicitly acknowledge it. The existing displayed-version binding,
  changed-version consent reset, missing-terms guard and late-response protections
  apply to admin acceptance too. No silent signing or fallback is introduced.
- Removed `adminSignContract`, the edit-form signature input/state and its automatic
  post-save call. The show-save payload and all unrelated save/edit/assignment
  behavior are unchanged. Old drafts may retain an inert extra signature-name
  property, but it is neither used for signing nor included in the save payload.
- No new RPC, column, schema, permission or dependency is required. The earlier
  inventory of 31 existing RPC names still applies. The reported database-only
  repair/test remains external evidence, not an app integration test.

New role/route/entry/save tests were written first. They failed against the earlier
candidate for absent review links, absent admin-role review and the old signature
input/direct-write save path, then passed after implementation. Additional mocked
regressions cover actual AdminRoute enforcement, stale admin rejection with new
content and fresh consent, API error display, late success/rejection after role
revocation, and legacy saved drafts without implicit signature writes. Existing
driver tests remain intact.

A separate reviewer inspected the admin integration diff from `f73532f` and found
no actionable findings. They confirmed active-admin gating, explicit role/version
binding, no direct signature writes, inert legacy draft fields and no dependency
on later migrations. This was a read-only source review, not a live test.

Fresh verification after the admin change:

- `npm test`: 79 passed.
- `npm run test:ui`: 45 files, 150 tests passed.
- `npm run test:native`: 2 passed.
- `npm run build`: TypeScript and Vite passed.
- `npm run lint`: zero errors, exactly the three baseline warnings.
- `git diff --check`: passed.

No installation was performed; the previously documented copied-dependency and
npm-version caveat still applies. Local logs are retained beside the worktree.

### Current compatibility and remaining acceptance requirements

| Area | Current status |
| --- | --- |
| Driver exact-version signing | Locally implemented and mocked; actual session flow unverified. |
| Admin exact-version signing | Direct-write blocker removed; explicit guarded version acceptance locally implemented and mocked. |
| Missing later-schema fields/APIs | None introduced by either signing change. |
| Checklist submission | Existing call unchanged; database-level repair/success reported externally, application flow unverified. |
| Admin editing/reassignment/revisions | Unchanged inherited workflows; can still conflict with agreement guards. No preview/commit integration or backend substitute added. |
| Native installed app | Unchanged old bundle; local source/mocked checks do not update or validate it. |

Before any publication, the independently reviewed recovery plan must identify
this exact candidate/build and target backend and verify the actual app sequence:
active assigned driver reviews/signs the displayed version, completes required
items and submits the checklist, then an active admin uses the new review route
to accept the displayed version. Include stale-version/API-error handling and
unauthorized/inactive access rejection. The database rollback report alone does
not cover these screens or session/routing behavior. Outstanding edit/reassignment
limitations must be explicitly resolved or accepted in the release scope; these
local signing fixes are not a claim of complete app repair.

For a fixture-only client check, include `src/pages/AdminAgreementEntry.test.tsx`
and `src/pages/ContractDetailAgreement.test.tsx` with the agreement component/API
tests in the earlier mock command. For native release acceptance, a separately
approved package and physical-device check are still needed; nothing was installed,
pushed or deployed here. No database code or workaround was created.
