import SwiftUI
import WidgetKit
import ActivityKit
struct NextShowEntry:TimelineEntry {let date:Date;let snapshot:WidgetSnapshot?}
struct NextShowProvider:TimelineProvider {
 func placeholder(in context:Context)->NextShowEntry {NextShowEntry(date:Date(),snapshot:nil)}
 func getSnapshot(in context:Context,completion:@escaping(NextShowEntry)->Void){completion(NextShowEntry(date:Date(),snapshot:WidgetSnapshotStore.read()))}
 func getTimeline(in context:Context,completion:@escaping(Timeline<NextShowEntry>)->Void){
  let now=Date();let snapshot=WidgetSnapshotStore.read()
  var entries=[NextShowEntry(date:now,snapshot:snapshot)]
  if let snapshot {for timestamp in [snapshot.updatedAt+1800,snapshot.expiresAt] where timestamp>now.timeIntervalSince1970 {entries.append(NextShowEntry(date:Date(timeIntervalSince1970:timestamp),snapshot:snapshot))}}
  completion(Timeline(entries:entries,policy:.after(now.addingTimeInterval(1800))))
 }
}
struct NextShowView:View {
 let entry:NextShowEntry
 var body:some View {
  let snapshot=entry.snapshot
  let expired=snapshot?.displayState(now:entry.date.timeIntervalSince1970) == .expired
  VStack(alignment:.leading,spacing:7){
   Label("ROADSHOW",systemImage:"truck.box.fill").font(.caption2.bold()).foregroundStyle(.secondary)
   if let snapshot,!expired,let item=snapshot.assignment {
    Text(item.title).font(.headline).lineLimit(2).privacySensitive()
    Text(item.dateLabel).font(.caption).lineLimit(2).privacySensitive()
    Text(item.location).font(.caption).foregroundStyle(.secondary).lineLimit(1).privacySensitive()
    Spacer(minLength:0)
    if snapshot.displayState(now:entry.date.timeIntervalSince1970) == .stale {Text("Open app to refresh").font(.caption2)}
    else {Text("Updated \(Date(timeIntervalSince1970:snapshot.updatedAt),style:.relative) ago").font(.caption2).foregroundStyle(.secondary)}
   } else {
    Text(snapshot != nil && !expired ? "No active assignment" : "Open Roadshow").font(.headline)
    Text("Open the app to refresh your next show.").font(.caption).foregroundStyle(.secondary)
   }
  }.frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
   .widgetURL(!expired ? snapshot?.assignment?.url : nil)
 }
}
struct NextShowWidget:Widget {
 let kind="RoadshowNextShow"
 var body:some WidgetConfiguration {
  StaticConfiguration(kind:kind,provider:NextShowProvider()){entry in
   if #available(iOS 17.0,*) {NextShowView(entry:entry).containerBackground(.fill.tertiary,for:.widget)}
   else {NextShowView(entry:entry).padding().background(Color(uiColor:.secondarySystemBackground))}
  }.configurationDisplayName("Next show").description("Your next assigned show, refreshed when you use Roadshow.").supportedFamilies([.systemSmall,.systemMedium])
 }
}
struct ChecklistLiveActivity:Widget {
 var body:some WidgetConfiguration {
  ActivityConfiguration(for:ChecklistAttributes.self){context in
   VStack(alignment:.leading,spacing:8){
    Label("ROADSHOW CHECKLIST",systemImage:"checklist").font(.caption.bold())
    Text(context.attributes.title).font(.headline).lineLimit(2).privacySensitive()
    ProgressView(value:Double(context.state.completed),total:Double(max(1,context.state.total)))
    HStack{Text("\(context.state.completed) of \(context.state.total) complete");Spacer();Text(context.isStale ? "Open to refresh" : "Open checklist")}.font(.caption)
   }.padding().widgetURL(context.attributes.url)
  } dynamicIsland:{context in
   DynamicIsland {
    DynamicIslandExpandedRegion(.leading){Image(systemName:"checklist")}
    DynamicIslandExpandedRegion(.trailing){Text("\(context.state.completed)/\(context.state.total)").monospacedDigit()}
    DynamicIslandExpandedRegion(.bottom){
     VStack(alignment:.leading){Text(context.attributes.title).font(.headline).lineLimit(1).privacySensitive();ProgressView(value:Double(context.state.completed),total:Double(max(1,context.state.total)));Text(context.isStale ? "Open Roadshow to refresh" : "Open checklist").font(.caption)}
    }
   } compactLeading:{Image(systemName:"checklist")} compactTrailing:{Text("\(context.state.completed)/\(context.state.total)").font(.caption).monospacedDigit()} minimal:{Image(systemName:"checklist")}
   .widgetURL(context.attributes.url)
  }
 }
}
@main struct RoadshowWidgets:WidgetBundle {var body:some Widget {NextShowWidget();ChecklistLiveActivity()}}
