# Current release and development state

Updated October 5, 2026. Baseline source: `beta` at
`016c4c15c7878c569ec768caf5eb38109cacba3c`. This is a repository-status record,
not a claim that the matching database/deployment has been verified.

| Item | State |
| --- | --- |
| Shared testing release | Beta 5A |
| Public release | Public 5 live; approved and verified October 5 |
| Latest baseline commits | `016c4c1` cloud design; `505cfbf` photo/PDF fixes; `5c1fc6d` contract clarity |
| Backend/hosting | Supabase + Vercel retained |
| Database/deployment evidence | Production schema checks passed 27/27 on October 5; fresh backups explicitly waived by Jacob for Public 5 |
| Cloud rollout | PR #6 merged with passing CI/preview checks; fresh Codespace/cloud-trial/second-browser acceptance pending |

## Public 5 release

Jacob authorized publishing beta as Public 5 on October 5. The public build
default is now `5`; beta remains `5A`. Vercel has no release-label overrides; `main` builds Public 5 and `beta`
builds Beta 5A using the verified branch defaults.

At inspection, `main` (`9bd5775`, prior PR #5) and `beta` (`016c4c1`) have
identical source trees, including all five Beta 5A migrations. PR #6 adds the
in-app PDF viewer and cloud setup without changing SQL. This does not prove that
the actual production database matches the committed migrations.

Jacob explicitly waived fresh database/storage backups for this frontend-only
release on October 5. PR #6 is merged into beta (`443f4f1`); the approved
beta-to-main Public 5 promotion merged in PR #7 (`590049f`).
The public domain redirects to `https://www.roadshowdriver.com/login`, verified
with title **Roadshow Driver · Public 5**. The stable beta hostname remains
**Roadshow Driver · Beta 5A**.
Live mobile/RLS/Auth acceptance has not been recorded as passed. Production was deployed from main; no environment-variable edits were required.

Release-preparation checks: clean `npm ci` with Node 24.19.0/npm 11.5.2;
44 unit tests and 40 UI tests passed; build passed; lint has zero errors and
the same three baseline warnings. The release assertion now expects Public 5.

Supabase dashboard sign-in succeeded on October 5. In Roadshow's production
project (`myraoovepjwhkafzdppq`), read-only catalog comparisons passed all 27
checks: 21 expected function bodies (whitespace-normalized hashes and security
definer), five release tables, PDF resource column, two chat indexes, private
photo/resource buckets, and expected photo policy presence/active-user checks.
These checks show the required schema artifacts are present, not full live RLS
or device acceptance. No migration or application-data mutation was executed.
The Free plan has no scheduled backups. A fresh recoverable database/storage
backup has not been established; Jacob explicitly waived this prerequisite for
Public 5. This exception does not change the backup requirement for future
releases. PR #6's three GitHub checks passed before integration.

## Beta 5A committed behavior

Contract publication batches, server-timed response order, admin-controlled
internal/external assignment, reversible published assignments, active-account
authorization/final-admin protection, atomic show/signing saves, recovery screens,
consistent operational search, lazy routes, bounded chat/unread reads, and
cross-device photo upload/shared viewing/PDF attachments. See [product](product.md).

## Required Beta 5A migration order

On an existing environment, verify actual applied state first and apply only
reviewed missing files. These are code dependencies, not an instruction to rerun
all files. Required artifacts from all five files passed read-only production
schema checks; migration-ledger history and full live acceptance remain unverified:

1. `202609290001_beta_5a_contract_publishing.sql`
2. `202609290002_beta_5a_reliability.sql`
3. `202609290003_beta_5a_chat_performance.sql`
4. `202609290004_beta_5a_contract_clarity.sql`
5. `202610010001_beta_5a_photo_resource_uploads.sql`

Keep production unchanged until approved public promotion. Migration-history
reconciliation/automation is deferred. Use [workflow](development-workflow.md)
and the [Beta 5A checklist](releases/beta-5a-test-checklist.md).

## Verification baseline and known issues

Node 24.19.0 / npm 11.5.2 in the cloud checkout: baseline UI tests 35/35 and
production build pass. The initial UTC unit run failed two Mountain-time fixture
tests; making their timezone explicit allows all 44 unit tests to pass without
changing app date behavior. This portability correction accompanies the setup PR.

Lint has zero errors and exactly three existing warnings:

| Location | Rule / reason |
| --- | --- |
| `src/context/AuthContext.tsx:136` | `react-refresh/only-export-components`: hook exported with component |
| `src/hooks/useAsync.ts:2` | `react-hooks/exhaustive-deps`: nonliteral dependency list |
| `src/hooks/useAsync.ts:2` | `react-hooks/exhaustive-deps`: missing `load` dependency |

Do not increase this warning baseline or add suppressions. Live mobile, Auth,
storage permissions, and migration results remain acceptance checks, not inferred
from passing source/mocked tests. No further live issues are confirmed here.

## Implementation verification

The feature branch passes 44 unit and 40 UI tests, clean installation, production
build, and lint with the same three warnings. Real Chromium renders multipage
PDFs at desktop/phone widths and JPEG2000 scans; iPhone Safari, actual private
Supabase access, migrations, and fresh Codespaces remain pending acceptance.

## Immediate priorities

Review cloud setup PR; configure repository-scoped beta client secrets; verify a
fresh Codespace/private preview; run fresh Codex documentation and application
trials; complete another-desktop acceptance with the laptop off. Jacob selected
an in-app PDF viewer as the first application change. It is implemented on
`chore/cloud-development` with page/zoom/close/download controls and renewed
private links; merged and deployed in Public 5. Live mobile/security acceptance
remains pending.
Public 5 promotion completed through PR #7 on October 5.

Viewer follow-up: internal PDF table-of-contents links are not yet wired to the
single-page reader. Use the previous/next-page controls; this is a deferred minor
review finding, not a blocker for in-app viewing.

Evidence and unfinished account steps: [cloud verification](releases/cloud-development-verification.md).
