# Driver agreement frontend review — local only

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
- `npm run test:ui`: 44 files, 130 tests passed, including 15 agreement regressions.
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
