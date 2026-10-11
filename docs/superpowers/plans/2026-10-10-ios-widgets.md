# iPhone widgets and Live Activity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Ship a next-assignment widget and explicitly started checklist Live Activity.
**Architecture:** React verifies account/assignment eligibility and sends minimal bounded snapshots through a separate native plugin. WidgetKit reads an expiring App Group file; ActivityKit displays confirmed totals. No extension credentials or push.
**Tech Stack:** React, Capacitor 8, SwiftUI, WidgetKit, ActivityKit. App remains iOS 15; extension iOS 16.2+.
**Spec:** ../specs/2026-10-10-ios-widgets-live-activity-design.md

## Global constraints
No backend mutations, credential access, enrollment, push or new security prompts accepted by the agent. Preserve user signing/icon edits. Native-only integration; web release unchanged. Widget expiry 6h, stale 30m. Live Activity stale after 5m, maximum session 8h. One activity at a time, no background network promises.

## Review focus
- Admin read access must not become assignment ownership: test primary and linked driver filtering.
- Stale async results after logout/account switch must not repopulate shared storage: test generation invalidation.
- Cold URLs cannot bypass verified auth: test strict ID/route parsing and delayed navigation.
- Failed checklist writes cannot produce optimistic progress: fetch authoritative responses only.
- Completed, deleted or unassigned contracts must end a followed activity; test eligibility/termination.

### Task 1 — minimal data and routing
Files: src/native/widgetModel.ts, widgetModel.test.ts; src/lib/nextAssignment.ts; HomePage.tsx; widgetData.ts.
Interfaces: nextAssignment(rows), assignmentDate(row); ownAssignments(rows,userID), widgetSnapshot(rows,now), checklistProgress(items), widgetRoute(url).
- [x] Write tests for ownership, selection, signing dates, payload whitelist, links and completion.
- [x] Run node test; observe missing implementation failure.
- [x] Implement pure helpers and minimal read-only query; refactor Home to shared selector.
- [x] Run unit suite and commit.

### Task 2 — native extension and snapshot lifecycle
Files: ios/App/WidgetShared/WidgetSnapshot.swift, ChecklistAttributes.swift; RoadshowWidgets/RoadshowWidgets.swift, Info.plist, entitlements; App/NativeShell/RoadshowWidgetsPlugin.swift; project config.
Interfaces: configure(connection,owner), suspend(connection), clear(), snapshot(connection,snapshot), activity(connection,operation,snapshot), status(connection), consumeLink(connection).
- [x] Add Swift validation/expiry/link tests; run RED.
- [x] Implement shared Codable model, atomic file storage, WidgetKit timeline, ActivityKit UI and plugin.
- [x] Add extension embedding, app URL and live activity metadata, App Group entitlements without provisioning.
- [x] Run Swift model tests and unsigned device build; commit agent-owned changes only.

### Task 3 — verified React bridge and controls
Files: widgetPlugin.ts, WidgetBridge.tsx, useWidgets.ts, FollowChecklist.tsx; App.tsx; ContractDetailPage.tsx; SceneDelegate.swift.
- [x] Add tests for identity/lifecycle invalidation and explicit start/stop UI.
- [x] Implement serialized bridge, verified refresh, owned assignments and authoritative progress; add following controls with privacy explanation.
- [x] Route cold/warm links only after verification; stop on completion/logout; preserve stale timestamp on network failure.
- [x] Run unit/UI/native tests, lint, web build, guarded sync, unsigned iOS build.
- [x] Fresh final reviewer; address material findings with regression tests.
- [x] Present concrete signing setup if required; install only with existing/approved provisioning. Document exact remaining device acceptance.

Implementation and review complete; commit and device installation are finalized in
the build record. User device acceptance remains distinct from automated checks.
