# Native refresh follow-up

October 11, 2026, local personal Public 5 build, existing signing.

## Diagnosis and changes

Verified the prior installed bundle location matched the Settings submenu install.
Observed its global “Up to date / Last updated” strip on Hoid. Native chrome has
Back and More, not a separate refresh action. Full refresh/status information now
appears only in Settings → Status. The saved read-only safety label is below saved
content and does not show the updating/timestamp strip.

Every route change previously requested the full owned snapshot. That trigger is
removed; launch, foreground account verification, saved mutations and the existing
five-minute timer remain. Administrator contract views also lost their live results
on remount. A failing revisit test demonstrated the loss before implementation.
Account-scoped memory now retains those results while new reads complete. Cached
results do not enable mutations, bypass profile verification, or persist to disk.
Owner changes/signout/inactivity clear the memory, and late previous-generation
writes cannot restore it. Home, contract lists/details/checklists and linked signing
views opt into named memory queries. Uncached content still requires its first
network read; protected non-saved screens still require account verification.

## Verification

- npm test: 79 passed.
- npm run test:ui: 113 passed in 40 files. Includes delayed revisit, verification
  gating, account switch, cache clearing/late writes, route versus mutation trigger,
  Status refresh and hidden global strip coverage.
- npm run build: passed; ios:sync also rebuilt successfully.
- npm run lint: no errors; only the existing three warnings.
- npm run test:native: 2 passed.
- node scripts/test-offline-native.mjs: store, file, background assertions passed.
- Signed Debug iOS Xcode build: BUILD SUCCEEDED with existing signing.
- devicectl installation and launch both succeeded on Hoid for the first refresh
  build. After retaining the read-only footer during updates, the final rebuild
  was also installed successfully: `78FCB873-D4BC-4CAB-8E57-D7C2C573413F/App.app`.
  Final relaunch was deferred to avoid interrupting concurrent device use.

Full post-install tab/submenu visual coverage remains pending: DeviceHub showed
the installed Home view, but repeated screen changes outside Roadshow interrupted
controlled navigation. No elapsed-time claim is made from these screenshots.
No security settings, backend data, migrations, remote publication or live test
uploads were changed. Existing signing/icon/config edits remain outside this change.
