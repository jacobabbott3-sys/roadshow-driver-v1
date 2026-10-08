# Beta 6A dependency audit — October 7, 2026

Base: remote beta `c439a0fe43b202667436decd6b17861e5a5bd1e0`.
Node 24.19.0; npm 11.5.2. This is fresh cloud evidence, independent of the
unavailable Mac and the paused parallel task.

`npm ci` succeeded. Before changes: unit 46/46, UI 40/40, build passed,
lint zero errors / three recorded baseline warnings. `npm audit --json`
reported three high affected packages; `npm audit --omit=dev --json` reported
zero vulnerabilities. All affected lockfile entries are development dependencies.

| Package | Before → after | Path / exposure | Advisory / fixed range |
| --- | --- | --- | --- |
| brace-expansion | 1.1.18 → 1.1.21; 5.0.9 → 5.0.12 | Transitive: ESLint → minimatch 3; typescript-eslint → typescript-estree → minimatch 10. Lint input processing, development only. | [nested groups](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [comma parts](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p), [quadratic work](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). Latest fixes ≥1.1.21 and ≥5.0.12. |
| js-yaml | 4.3.1 → 4.3.2 | Transitive: ESLint → eslintrc. Development configuration parsing. | [empty merge denial of service](https://github.com/advisories/GHSA-2883-xcg3-v3hh); affected ≥4,<4.3.2. |
| source-map-js | 1.2.1 → 1.2.2 | Transitive: Vite → PostCSS; jsdom → dom-selector → css-tree. Build/test processing. | [indexed offset denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); affected ≥1,<1.2.2. |
| Vite | 7.3.6 → 7.3.7 | Direct development dependency. Network-accessible development server on non-Windows systems. | [filesystem allow bypass](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22), disclosed October 6; 7.x affected through 7.3.6, patched 7.3.7. Registry audit did not yet report this advisory. |

All fixes fit existing parent ranges; Vite remains major 7 with a declared
`^7.3.7` floor. Only these five lockfile entries and Vite's declared floor change.
Commands: `npm update brace-expansion js-yaml source-map-js` and
`npm install --save-dev 'vite@^7.3.7'`. No forced audit fix or major upgrade.
No live environment, credential, deployment, or branch setting changes.

After-change verification is recorded in the reconstruction verification record.
