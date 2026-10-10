# Roadshow Driver — Apple-style native presentation

Date: October 10, 2026 (America/Denver)
Status: Written spec awaiting Jacob's review. Conversational first-phase design approved.

## Intent and success

Jacob wants his installed personal iPhone app to feel like an Apple app: neutral
glass, green highlights, native controls and tactile feedback. Preserve the
working Public 5 workflows and real account. Success means navigation, appearance
and common presentation feel native without losing form state, account protection,
readability or access to existing functions.

The baseline is local `feat/ios-personal-public`, commit
`bbbdd20ce20d2c64342f17de3222bdeeaca71099`, in `roadshow-ios-personal`.
Installation, login and brief background/resume already passed on Jacob's iPhone
17 Pro, iOS 27.2. User-owned signing edits in the Xcode project remain uncommitted
and must be preserved. This continues the approved exception to the repository's
beta-first rule; it does not adopt the other task's beta work.

## Scope and sequencing

Phase one includes native glass navigation and utility controls, native quick-access
and appearance sheets, restrained haptics, smoother presentation, and native-only
visual refinement of the existing React content. This is a hybrid app, not a
rewrite of every screen in SwiftUI.

Closed-app push is excluded at Jacob's request to retain free Personal Team
signing. Do not add notification permissions, local reminders as a substitute,
APNs, background polling, or backend delivery work. Existing in-app notifications
remain. Widgets and Dynamic Island/Live Activities are separate future work;
their free-signing feasibility is not established by this design.

Keep the same bundle ID, public configuration guard and seven-day reinstall
workflow. No new capabilities or signing identities are required for this phase.
No paid enrollment, push, merge, deployment, backend mutation, or production test
records. No offline support, location tracking or new account data storage.

## Approach

Chosen: a native shell around one persistent Capacitor web view, with native-only
content styling. This gives genuine platform materials and controls while keeping
business behavior in the tested React routes.

Alternatives considered: CSS-only glass would be cheaper but would not provide
the requested native material/controls; a full SwiftUI rewrite would duplicate
the workflows and substantially expand the regression surface. Neither is the
chosen implementation.

## Visual design

- Neutral grouped backgrounds, system typography and clear hierarchy; green
  highlights for selection and primary actions. Retain the Roadshow truck identity.
- Real system Liquid Glass on supported iOS for the floating bottom navigation
  and compact utility controls. Keep content cards legible and mostly opaque;
  glass is for controls rather than every surface.
- Native SF Symbols with text labels. Driver tabs: Home, Contracts, Resources,
  Profile. Admin additionally receives Admin. Preserve the existing order.
- Utility access to Chat, Notifications and a More menu. More presents shortcuts
  to Availability, Red Folder and My Toolbag, plus Appearance. These open existing
  routes; the native layer does not recreate their data or business logic.
- Native quick-access sheet uses standard dismissal, safe areas and presentation
  detents. Appearance uses native System/Light/Dark choices. Existing assignment,
  publishing, PDF and photo dialogs stay in React and receive visual refinement;
  do not describe these retained dialogs as native SwiftUI sheets.
- Short platform transitions for shell selection/sheet presentation, never a
  second animation over a retained form or loading screen. Selection haptic only
  on a user-initiated tab change; none for automatic route synchronization, every
  keystroke, polling, or failed actions. Provide a local haptics toggle.

## Native and web boundary

Extend SceneDelegate's root containment so a native shell owns a single existing
CAPBridgeViewController plus native controls. Do not create one web view per tab:
that would duplicate sessions, subscriptions and navigation state. Preserve
Capacitor scene event forwarding and the existing refresh lifecycle.

A small local Capacitor plugin carries typed presentation state and navigation
events. React remains the authority for the current route, authenticated active
account, role, modal visibility and unread counts. Swift owns rendering native
controls and local presentation preferences. No tokens, passwords, signed URLs,
chat bodies or contract contents cross this bridge.

Bridge state includes protocol version, sequence number, whether protected chrome
may be visible, allowed tab identifiers, selected tab, unread counts and whether
a web modal is open. Events use fixed action identifiers mapped in React to an
allowlist of existing routes. Do not accept executable JavaScript, arbitrary URLs
or arbitrary navigation paths from event payloads. Validate count bounds and
ignore stale/out-of-order state. A route event never performs a business mutation.

Mount the React bridge under BrowserRouter and AuthProvider. Preserve
ProtectedRoute/AdminRoute as the final authority. Hide protected native controls
on login/recovery, logout, inactive or unverified account state, and web startup
failure. Clear badges when identity changes. Admin controls are only presentation;
they never grant authorization. Bridge absence/failure must leave usable web
navigation: hide the old chrome only after the native readiness handshake, and
restore it on bridge teardown/failure. Native scene transitions temporarily hide
protected chrome until React supplies a fresh verified state on resume.

Map nested contracts/signing groups to Contracts, resource routes to Resources,
and admin routes to Admin. Chat, Notifications and Availability remain utility
destinations without a misleading selected tab. Repeated selection of the active
tab does not reload the web view or discard page state. Tab selection navigates
through React Router and retains the existing back-stack semantics. Supply an
accessible native Back control on non-root routes where in-app history permits it;
when cold-opening a detail route, use its parent route as the safe fallback.

Extract existing TopBar unread-data subscriptions into a reusable data hook so
native controls and web fallback share one subscription/polling path, not two.
Do not change frequency, backend queries or delivery semantics.

## Layout, appearance and accessibility

Native controls report measured occupied bounds to the web layout. Assign safe
area/keyboard inset ownership explicitly so native and CSS padding do not double
count. A web modal/viewer temporarily hides or disables shell chrome and occupies
the usable viewport; restore chrome after dismissal. While editing, keep inputs
and submit actions above the keyboard and collapse bottom controls if necessary.
Native controls must not cover web content or intercept its scroll gestures.

All content refinements are gated by the native marker. Preserve ordinary web
rendering and existing account-synced appearance behavior. The iPhone shell and
native content share a device-local appearance preference, default System, with
Light/Dark overrides and fixed green accent. The native Profile presentation must
make this local scope clear and replace conflicting theme/accent controls with
the native Appearance entry; retain unrelated settings, including confetti.
Choosing native appearance must not write the account's web theme to Supabase.
Apply the preference before first paint and react to OS changes while open.

Use availability checks for Liquid Glass APIs with conventional system material
fallback on older supported iOS; retain the current deployment minimum unless a
separately explained requirement makes that impossible. Reduce Transparency uses
opaque/high-contrast surfaces. Reduce Motion removes optional motion. Native and
web controls support VoiceOver, visible focus, semantic labels, selected states,
at least 44-point targets and larger accessibility text without clipping. Badges
have meaningful spoken labels and do not communicate unread state by color alone.

## Verification and acceptance

Use fixture/mocked accounts for role, inactivity, errors and backend mutations.
Add regression tests before implementing bridge authorization and lifecycle
behavior. Cover handshake success/failure; driver/admin tab visibility; revoked
or unverified account state; logout; malformed/stale messages; route mapping;
back behavior; badge reset; single subscription ownership; modal/keyboard state;
and unchanged web fallback. Cover native preference changes without account writes.

Run the repository unit/UI/build/lint checks and native build-pipeline tests.
Preserve the known three web lint warnings; report native dependency warnings
separately. Run guarded ios:sync and unsigned compilation before a user-assisted
device install with the existing signing setup.

On the phone verify genuine glass rendering over scrolling content, four/five-tab
layouts, native sheets/menu dismissal, haptics, login/logout/resume, nested routes,
retained form input, PDF/image modal access, keyboard, notch/home indicator,
portrait/landscape, VoiceOver, large text, light/dark changes and both accessibility
reductions. Test with fixtures wherever writing would otherwise affect real work.
No claim of complete device acceptance until each result is recorded. A missing
simulator runtime does not count as successful simulator testing.

## Delivery and rollback

Keep local source commits separate from user-owned signing changes; preserve the
working installed build until compilation and source checks pass. Reinstall over
the same bundle ID to retain app data. Document the final native/source/device
results and known gaps in the personal-build notes. Rollback rebuilds the prior
Public 5 native source using preserved local signing/configuration; no database
rollback is involved. Do not delete/revert unrelated files or the user's signing.

## References and review

- [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)
- Existing `AppShell`, `TopBar`, `App`, `AuthContext`, `ProtectedRoute`, native lifecycle
  and configuration adapters, plus `ios/App/App/SceneDelegate.swift`.

Self-review: checked scope, native/web ownership, role/auth boundaries, theme
consistency, fallback behavior, acceptance and rollback. Written-spec approval
precedes the implementation plan; this document does not authorize backend or
new signing actions.
