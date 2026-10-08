# Beta 6A local verification and review — October 7, 2026

Reconstructed implementation on `feat/beta-6a-agreement-reconstruction`, based on
remote beta `c439a0fe43b202667436decd6b17861e5a5bd1e0`. Main/Public 5 remains
`950a2628a517ce067b0167382e5aafe4fd02b9ea`. Both remote tips were rechecked after
implementation and remained unchanged. No push, PR, merge, deployment, live
SQL/data/notification mutation, credentials, or settings change occurred.

## Evidence

Node 24.19.0 / npm 11.5.2. Baseline: 46 unit, 40 UI, build passed,
lint zero errors and three existing warnings. After scoped dependency fixes:
the same counts/checks passed; registry audit zero, including production-only.
Vite 7.3.7 also fixes the primary advisory absent from the registry result.
See [audit](beta-6a-dependency-audit.md).

Final exact commands and results are recorded below after clean installation.

| Check | Result |
| --- | --- |
| `npm ci` | Passed with declared toolchain |
| `npm test` | 48 passed |
| `npm run test:ui` | 49 passed |
| `npm run test:sql` | 86 real PostgreSQL checks passed with synthetic data |
| `npm run build` | Passed |
| `VITE_RELEASE_CHANNEL=beta npm run build` | Passed; beta fallback 6A, public fallback 5 retained |
| `npm run lint` | Zero errors, same three recorded baseline warnings |
| `npm audit --json` | Zero reported vulnerabilities |
| `npm audit --omit=dev --json` | Zero reported production vulnerabilities |

The SQL harness uses pinned PGlite 0.5.8 and an in-memory database. It replays
repository migrations **only there**, with synthetic identities, real roles/RLS,
minimal Auth/storage boundary stubs, and native UUID support in place of
pgcrypto extension installation. It has no backend URL or credential input.
Run `AGREEMENT_STAGE=1|2|3|4|6 npm run test:sql` for stage-limited coverage.
This is stronger than SQL text assertions, but is single-session PostgreSQL,
not a hosted Supabase service or multi-session concurrency test.

Covered: both signing orders and assigned-admin driver eligibility; stale and
idempotent acceptance; authenticated identity; immutable evidence/FKs/deletion;
legacy evidence without invented copies; unrelated/inactive/unassigned denial;
removal/return and distinct assignment periods; full accepting-signer
unassignment, reopened publication and unchanged response IDs/times/order; nonsigner changes; exact normalized
preview/commit equality, stale-token rollback and replay; JSON null and zero;
deactivated pinned templates; preserved item/response IDs, flags/instructions and
completed progress; old/direct write denial; recipient-only removal/revision
notices without current-contract access; transitive linked work; current driver
acceptance gates; allowed draft RPCs while pending; direct terminal-status INSERT
and response-write denial. UI tests exercise full copy, legal-name/acknowledgment,
version/contract consent reset, stale review, admin signing, legacy evidence,
canceled preview without commit, stale commit propagation and receipt-only links.
An isolated mock executes the actual Edge handler and proves both notice kinds
return before server configuration or push-client creation; ordinary kinds still
follow the existing path. It never sends a device notification.

## Independent reviews and corrections

| Stage | Review findings resolved |
| --- | --- |
| Dependency | Compatible scoped development fixes approved; no forced upgrade |
| 1: Storage | INSERT signatures, cross-contract version pointer, signature-period binding, deletion of legacy evidence protected |
| 2: Signing | Nullable-lead authorization leak denied; original legacy names/times preserved in immutable evidence; both orders and assigned admin exercised |
| 3: Revisions | Legacy roster/link bypasses, checklist/item reparenting, unsupported initial-create preview, normalization/null handling and checklist lock coverage corrected |
| 4: Notices | Own-recipient restrictive RLS, no current-contract link, legacy-only lead removal and retained-signer revision probes passed |
| 5: UI | Fresh consent per contract/version/role, linked identity details, admin Signings review route, signing without optional custom terms, behavior tests and inactive pinned template options corrected |
| 6: Gates | Direct update tests use NEW version; archived sections excluded consistently; current driver gate protects old operational RPCs |
| Whole branch | Cycle-safe transitive linked component snapshots/guards; direct approved-state INSERT denied; direct checklist progress/delete paths forced through guarded RPCs; pending acceptance shown beside preserved checklist progress |

Fresh whole-branch reviewer independently reran the final 86 SQL checks and six focused
UI tests, inspected corrected paths, and found no further material defects.
A final coverage review added the full-unassignment regression; both the
implementer and reviewer ran the final 86-check SQL suite successfully. The early stage-1 commit's transaction-binding extension initially failed due
to a test-context error; the following test commit corrected the harness and
reran it successfully. Intermediate reports are not final verification evidence.
A direct review-metadata finding was withdrawn after PostgreSQL demonstrated
that historical column grants already deny that write; completed/delete paths
were still strengthened. Review does not establish live deployment safety.

## Decisions and limitations

- Jacob selected all hotel fields and stay dates as operational, without new
  signatures. Schedule, accepted work identity, entitlements, terms/pay, links and
  issued checklist content are versioned; hotel/unlock/admin notes are operational.
- Legacy roster changes conservatively reopen signing when historical signer
  identity is unavailable. No guessed authenticated signer or historical copy.
- Initial creation uses existing atomic RPCs, without claiming a creation preview;
  attaching a new signing to an already issued/signed linked unit requires creating
  it unlinked first, then a reviewed edit. Reviewed edits preserve actual source IDs.
- No native postgres/docker/Supabase stack or multi-session test runtime was
  available. Actual simultaneous signing/edit/assignment behavior, deadlock/race
  freedom and cross-connection snapshots remain **unverified**. Shared advisory
  and row locks are implemented and reviewed, not concurrency-tested here.
- No live Auth/storage/webhook/Deno deployment or device/Safari/other-desktop
  browser acceptance was performed. These are pending checklist items.
- Beta and public share Supabase. Old Public 5 signing and submission flows will
  fail closed after these migrations until a compatible frontend is rolled out.
  A beta-only migration rollout is unsafe. See [rollout checklist](beta-6a-test-checklist.md).

## Publication hold

Read-only Vercel project listing found `roadshow-driver-v1`; project-settings
read returned **403 forbidden**: the connected identity lacks access to the
project scope. Vercel CLI is unavailable. No alternate identity, credential or
setting was used. Automatic preview behavior could not be freshly verified.
Feature pushes/draft PRs therefore remain held. Before any publication, verify
settings with authorized access and obtain Jacob's specific approval if an
automatic preview can use the shared live backend. Do not edit settings to avoid
this boundary. Live rollout remains a separate approval.
