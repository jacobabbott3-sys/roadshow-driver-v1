# Next show widget and active checklist Live Activity — proposed design

Jacob selected “Next show + active checklist” on October 10. This document
records the investigation; extensions and capabilities are not yet implemented.

## Experience

A small/medium Home Screen widget shows the next assigned show/signing, date,
city and last-refresh time. It opens that assignment in the app after the usual
authentication/profile verification. Empty, signed-out and stale states are
explicit. Reuse the same selection rules as Home, including signing setup dates;
first extract and test that selector rather than reimplementing it in Swift.

An optional “Follow checklist” action on the driver's own eligible contract
starts one Live Activity. Compact Dynamic Island shows completed/total; expanded
and Lock Screen views show the show name and progress with “Open checklist”.
No checkbox can be changed from the Lock Screen in the first version. Admin
viewing another driver's checklist never gains editing or activity privileges.
Stopping, completing, signing out or losing account eligibility ends the activity.
Start only on explicit action, never merely by visiting a show. Check system Live
Activity permission and show an unobtrusive unavailable state when disabled.

## Architecture and privacy

Add one SwiftUI WidgetKit extension containing the widget and ActivityKit UI.
Keep the existing Capacitor view and React authorization authoritative. Introduce
a separate validated snapshot bridge; do not overload the navigation protocol,
which currently carries no business content. Send only the assignment ID, bounded
show/location labels, date, completed/total and refresh/expiry timestamps after
verified reads. Never send auth tokens, photos, PDFs, private notes or checklist
answers to the extension. Activity payloads remain within Apple's size limit.

Share the minimal widget snapshot through an App Group with an atomic file,
cleared on explicit logout/account change/inactivation. Display freshness and
expire old snapshots instead of implying continuous synchronization. Avoid
networking or separate credential storage in the extension. Widget timelines
advance display states; they do not fetch new assignments. Refresh snapshots
when the app verifies the account and loads current data; request a timeline
reload, subject to system scheduling. Mark sensitive widget fields with the
platform's privacy APIs. Device lock-screen visibility is explicitly opt-in.

Add an allowlisted app URL route for opening the specific contract. Queue a cold
launch link until auth verification completes, then let the existing service/RLS
check access. Reject arbitrary URLs, paths and malformed IDs. Activity progress
updates only after a successful authoritative checklist response, not optimistically.
If synchronization fails, keep the last confirmed count and mark it stale.

## Confirmed platform limits and remaining verification

Apple's current iOS capability table marks App Groups as supported for the
Apple Developer column (as well as ADP/ADEP); push notifications are not marked
for that free column. Therefore paid membership is not assumed necessary for
the local-only design. Actual Personal Team extension/App Group provisioning
still needs a device signing check; no capability or profile was created here.

Apple documents that Live Activities cannot access the network themselves.
ActivityKit app updates or ActivityKit push notifications supply fresh content.
This design has no push infrastructure and promises no closed-app server updates.
A Live Activity can remain active for at most eight hours; a completed activity
may remain on the Lock Screen for up to four additional hours. Use a stale date
and a same-session deadline; do not represent an entire multi-day show as one
continuous activity. End immediately on logout where the app is running.
Previously displayed data cannot be remotely withdrawn while this local-only
app is not running, so snapshot expiry and limited content are necessary.

## Implementation sequence and acceptance

1. Test shared next-assignment/progress selectors and bounded snapshot schema.
2. Add extension, App Group snapshot lifecycle, safe deep-link routing and widget.
3. Add explicit start/update/end ActivityKit integration and native failure states.
4. Compile unsigned, then let Jacob handle any signing/security prompts; test the
   provisioned extension on his phone before claiming Personal Team support.
5. Verify signed-out/empty/stale/role-change cases, cold links, successful versus
   failed checklist saves, completion/logout, Dynamic Island modes, device lock,
   reduced motion, VoiceOver and large text. No production mutations for testing
   unless separately authorized with an appropriate disposable assignment.

Sources consulted October 10, 2026:
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension
- https://developer.apple.com/help/account/reference/supported-capabilities-ios
