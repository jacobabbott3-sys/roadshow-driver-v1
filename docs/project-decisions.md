# Durable project decisions

Record choices and rationale, not conversation transcripts. Prefer current SQL
and application behavior over superseded historical plans. New choices should
name their source and update the affected product/architecture/workflow document.

| Decision | Rationale and source |
| --- | --- |
| Keep `driver` and `admin`; new accounts are drivers | Existing Auth/profile model; foundation and active-account migrations |
| Active accounts only; preserve final active admin | Safe operational access and recovery; `202609290002_beta_5a_reliability.sql` |
| Admins assign; availability rank never awards work | Preserve human scheduling control; September 29 contract design |
| Linked signings are one availability/assignment unit | Keep linked work consistent; contract design and publishing/clarity RPCs |
| Use **Publish Contracts** and contract wording in UI | Align driver/admin terminology; `5c1fc6d` and clarity migration |
| Full unassignment reopens publication without retiming responses | Preserve response audit/order; `202609290004_beta_5a_contract_clarity.sql` |
| Outside drivers remain display names, not accounts | Mixed teams without invented login/directory privileges; contract design and external-assignee schema |
| One contract per show; preserve checklist review history | Existing consolidation and item-review/template migrations |
| Share photos with assigned teammates/admins through private storage | Cross-device/team viewing without public buckets; `505cfbf` and October 1 photo/resource migration |
| PDF attachments are resources, not images | Correct document viewing/download behavior; `505cfbf` and `resources.file_type` |
| View PDFs inside the app with a bundled renderer and download fallback | Jacob's October 2 request; PDF.js avoids relying on native mobile embedding or exposing documents to third-party viewers |
| `beta` tests; `main` releases; public numbers have no letters | Existing release conventions; README and `vite.config.ts` |
| GitHub is durable truth, with concise routed context | Recreate development without laptop/thread dependency; October 1 cloud design, approved October 2 |
| Codespaces for hands-on work; Codex cloud for delegated PRs | Browser portability while retaining normal review; cloud design |
| Retain Vercel/Supabase; initial migrations are manual | Avoid first-season infrastructure disruption and unreconciled replay; both approved designs |
| Temporary development ports stay private; stable URLs test Auth links | Access control and predictable invitation/reset destinations; cloud design |
| Mobile is monitoring/review/emergency text edits | Desktop browser remains the normal engineering/security workspace; cloud design |

Deferred approaches: automatic assignment, bidding/waitlists/deadlines, external
user invitations, offline checklist synchronization, full-message-content search,
notification diagnostics, backend replacement, self-managed permanent servers,
and migration automation. These require new scoped decisions rather than being
implied by setup work.

Unavailable laptop-only context is not evidence. If a missing prior decision
would change behavior, surface the uncertainty and get the specific requirement;
do not import or invent raw transcript history.

References: [cloud design](superpowers/specs/2026-10-01-cloud-development-design.md),
[contract design](superpowers/specs/2026-09-29-contract-publishing-reliability-design.md),
`supabase/migrations/`, and Git history.
