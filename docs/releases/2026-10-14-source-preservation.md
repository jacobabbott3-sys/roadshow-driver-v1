# Roadshow recovery source preservation

Local source inspected on October 14, 2026. Application HEAD before preservation:
`7b7198a29621ab9d9e5dd96547949058607659fd`, branch
`review/frontend-exact-agreement`.

## Scope and comparison

Compared against supplied main `950a2628a517ce067b0167382e5aafe4fd02b9ea`:
204 files, 8,834 insertions, 286 deletions before this packaging/documentation commit.
Main is an ancestor. All changed paths were inventoried; the complete binary diff
is retained in the local task evidence. This is a preservation/scope review, not
an exhaustive independent approval of every inherited implementation.

The candidate contains 39 commits after main, including inherited Capacitor/iOS
shell, account verification, saved offline contracts/files/background reads,
photo capture, settings, widgets/Live Activity, Watch and swipe-back work.
104 changed paths are under ios/ or src/native/. Shared web changes also include
startup, unread badges, PDF handling, Auth routing and contract readers. It is not
an agreement-only patch. No Supabase source differs from the supplied main.
Native source remains preserved; no installed app was changed.

Against supplied beta `a02f5521b703931b3dfa6747e6bd1d79af3d5772`, the tree differs
in 238 files (8,782 insertions, 2,975 deletions). Merge base is
`5c49d1487df9c1a746457d9a54e6f315a697e732`. Beta has later database and frontend
work absent here. Do not interpret this comparison as authorization to delete,
replay, reconstruct or apply database code. No remote fetch was performed;
origin/main and origin/beta tracking refs are absent in this checkout.

The preservation commit records the existing .vercelignore allowlist and existing
.gitignore additions without changing application behavior. The existing trailing
.env* rule also masks the earlier .env.example exception for new untracked files;
the tracked placeholder remains tracked. No environment file contents were read.

## Fresh verification

Tests ran from a git-archive source snapshot in the new task workspace, with no
local environment files. Existing installed dependencies were copied; no npm ci
or fresh dependency resolution was performed. Node v24.19.0 matches .nvmrc;
npm 11.17.0 differs from pinned npm 11.5.2. This is not clean-install evidence.

- npm test: 79 passed, zero failures.
- npm run test:ui: 45 files / 150 tests passed. Existing jsdom navigation notice.
- npm run test:native: 2 passed.
- npm run build: TypeScript and Vite passed.
- npm run lint: zero errors, same three baseline warnings.
- git diff --check: passed for full candidate and working changes.
- Swift offline store, file and background fixture harnesses passed.
- Swift Watch projection/progress/account switch/clear/ordering/expiry/rollback/
  persistence fixtures passed.

Initial UI invocation was blocked by a dependency symlink pointing outside the
writable workspace; copying dependencies fixed it. Swift checks initially hit
restricted cache writes and a default SDK/compiler mismatch. Reruns used writable
/tmp module caches and the existing Xcode-beta developer directory; no source,
credentials, global toolchain selection or device installation changed.

A separate source package was assembled using gitignore-compatible evaluation of
.vercelignore. Its 192 files include tests/fixtures/offline/valid.json, and exclude
.env.local, .vercel/project.json, native files and local build output. Recreating
PDF assets and running the full TypeScript/Vite build on that package passed.
This validates local packaging; it is not a Vercel deployment or npm-ci test.

## External evidence and open acceptance

The parent reports that Jacob deployed the recovery and verified HTTP 200 and
byte-identical index-Bc3e2kXe.js on the custom domain and recovery deployment,
using production backend myraoovepjwhkafzdppq. This task did not repeat that check.
The environment-free local build is not expected to reproduce that bundle hash.

Actual authenticated driver/admin version review, signing and checklist submission
remain unverified. Inherited editing/reassignment/revision workflows can still
conflict with agreement guards. Local mocks and Swift fixtures do not establish
production integration, live authorization or physical-device acceptance.
No database operation, blocked SQL reconstruction, credential read/change,
Vercel CLI operation, remote publication or external communication was performed.
Existing Vercel 403 and separate database-repair restrictions remain binding.

## Minimal proposed review-publication step

After parent approval explicitly covers the possible automatic preview deployment,
publish only this preserved feature branch for source review, with no merge or
promotion. Confirm the preview target/environment through authorized access first.
A draft PR into beta is the repository default, but the divergent beta history and
inherited native scope must be resolved before treating that PR as mergeable.
Do not replace main, reset beta, or selectively discard inherited source as part of
preservation. A separately approved integration decision can choose a beta-based
frontend patch or explicit whole-candidate review. Live acceptance remains open.
