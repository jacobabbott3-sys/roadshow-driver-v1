# Personal Watch companion: implementation and verification

October 12, 2026. Existing `feat/ios-personal-public` checkout. The accepted refresh
fix and guarded swipe-back remain unchanged.

## Signing

Jacob authorized Xcode to create the Watch development profile using the existing
Apple account. Retrying the minimal target with `-allowProvisioningUpdates` succeeded.
The integrated iPhone and Watch targets then built using that profile without
further provisioning flags. The embedded Watch profile has development enabled
and expires October 19, 2026 at 00:41:39 UTC. Deep/strict codesign verification passed
for the final package. This verifies local development
signing, not installation or operation on the Series 11. No paid membership, new
credentials, Developer Mode changes, agreements or unrelated capabilities were used.

## Implemented

A minimal SwiftUI Watch companion shows next assigned work, date/venue, checklist
counts/progress and Last updated. iPhone WatchConnectivity projects the existing
owned snapshot, never the broader administrator memory cache. Six-hour expiry and
30-minute stale marking follow the existing widget limits. Resending does not
renew fetched time. A disconnected Watch may retain its bounded copy until a new
account/clear envelope arrives or it expires; immediate remote revocation is not
claimed. No account mutation or backend API exists on Watch.

## Checks

- `npm test`: 79 passed.
- `npm run test:ui`: 115 passed in 40 files.
- `npm run test:native`: 2 passed.
- `npm run ios:sync`: TypeScript/web build and native sync passed.
- `npm run lint`: zero errors, only the three existing warnings.
- `node scripts/test-offline-native.mjs`: all store/file/background assertions passed.
- `node scripts/test-watch-native.mjs`: synthetic projection, checklist progress,
  ownership switch, clear, out-of-order delivery, restart watermark, expiry, clock
  rollback, serialization and preserved fetched-time assertions passed.
- Signed Watch and combined iOS+embedded Watch builds succeeded.

## Device status and remaining acceptance

Xcode/devicectl/xctrace enumerate Hoid (iOS 27.2) only. No Watch or simulator runtime
is listed. User reports Series 11; pairing, watchOS and Watch Developer Mode remain
unverified. Final iPhone package installation succeeded at bundle location
`B9EEDBE5-5A31-4C02-9390-7CE9C5C5DE73/App.app`. Launch of the preceding
integrated package timed out after 15 seconds;
DeviceHub showed Hoid's locked passcode screen. No unlock was attempted.

Physical Watch install, live WatchConnectivity delivery, visual fit, offline expiry,
real account-switch clearing and user acceptance remain pending. Unlock Hoid and
the paired Watch and make the Watch available to Xcode; stop for separate approval
if Developer Mode or another security action is requested.

Existing iPhone signing/icon/config changes were preserved. The new target's local
team selection is also kept out of the source commit. No remote publication or
backend writes were performed.

## Installation failure follow-up

Jacob reports that Roadshow appears in the iPhone Watch app, but Install reverts
back to Install with no displayed error. Read-only inspection confirmed shell
access and Hoid connected; devicectl/xctrace still list no Watch destination.
The supported pairing-list command returned an ArgumentParser validation error,
so it did not establish pairing or watchOS version.

The final embedded Watch bundle has matching companion/bundle identifiers,
watchOS platform, device family 4, minimum watchOS 11, and valid signatures. Its
embedded development profile contains exactly one ProvisionedDevices entry:
Hoid's iPhone UDID. It contains no Watch UDID. This is a concrete device-coverage
gap and the leading installation-failure hypothesis; no Watch installer rejection
log has yet been captured, so it is not claimed as a confirmed sole root cause.
A generic signed build was insufficient to establish Watch device eligibility.

Xcode UI/Console inspection was blocked because the Mac is locked. No repeated
installation, signing change, code change or security-setting change was attempted
in this diagnosis. Next: unlock the Mac and keep the paired Watch nearby/unlocked,
verify it appears as a destination, then use the already approved free-account
profile workflow for that actual Watch. Pause separately if Developer Mode or any
other new security approval is required. This does not establish that free signing
is unsupported.
