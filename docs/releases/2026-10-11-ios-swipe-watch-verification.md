# Swipe Back and Watch feasibility

October 11, 2026. Jacob approved the simple cancellable edge gesture without an
interactive previous-screen preview, and a first read-only Watch experiment.
The accepted refresh change `aca2068` remains in place.

## Implemented navigation

UIKit left-edge gesture commits the existing route-aware Back action. Tab roots,
modal dialogs, native sheets, keyboard entry and unsent/uploading photo drafts
block it. Short, reversed, cancelled and vertical drags do not navigate. Both
native and React sides check the current connection/sequence; a state change
during a gesture cancels it. Back buttons remain unchanged.

- `npm test`: 79 passed.
- `npm run test:ui`: 115 passed in 40 files. Includes repeated submenu swipe
  actions, root/draft denial, existing contract Back/history, dialog/auth gates,
  and photo retry/discard/unmount blocker lifecycle.
- `npm run test:native`: 2 passed.
- Executable Swift ShellState tests passed, including added committed, short,
  reversed, cancelled and vertical gesture cases plus modal/suspension gates.
- `npm run ios:sync`: TypeScript/web build and sync passed.
- `npm run lint`: zero errors, existing three-warning baseline only.
- Signed generic iOS Debug build: BUILD SUCCEEDED, existing personal signing.
- Installed on Hoid: bundle location
  `A6CBA21F-B58F-446F-B10A-74109EA475D5/App.app`.
- Launch command timed out after 20 seconds; launch was not confirmed. Device
  inspection showed the unlock screen. Actual device gestures,
  cancellation, Settings/detail navigation and horizontal-content interaction
  remain unverified; fixture checks are not a substitute for finger testing.

## Watch signing probe — blocked before integration

`devicectl list devices` and `xctrace list devices` listed Hoid but no Apple Watch.
The user reports Series 11; pairing and watchOS version are not yet verified.
Xcode includes watchOS 27.2 SDK. A throwaway minimal SwiftUI Watch target was
created in `/tmp/roadshow-watch-probe`, using the installed Xcode Watch template
settings, existing team and proposed bundle ID
`com.jacobabbott.roadshowdriver.watchkitapp`.

A signed generic watchOS build failed: no matching provisioning profile; Xcode
requested `-allowProvisioningUpdates` to generate one. That flag was not used.
No provisioning access, credentials, agreements, Developer Mode, project target
or companion integration was added. This is not evidence that Personal Team
cannot support the Watch; exact-device signing remains unverified.

Next prerequisite: the paired Watch must appear in Xcode, and Jacob must authorize
or perform creation of its development profile with the existing account.
The intended next-show/date/venue/checklist/Last-updated companion and its cached
state fixtures are not implemented or tested yet. Authentication stays on iPhone
in the proposed design; no backend credentials should be sent to Watch.

No remote publication, paid service, backend mutation, live test upload or change
to the user's signing/icon edits occurred.
