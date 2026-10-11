import Capacitor
import WidgetKit
import ActivityKit
import UIKit
@MainActor enum WidgetLinkInbox {
 static var pending:String?
 static var changed:(()->Void)?
 static func receive(_ url:URL) {guard let valid=WidgetRoute.parse(url.absoluteString) else{return};pending=valid;changed?()}
}
@objc(RoadshowWidgetsPlugin) public class RoadshowWidgetsPlugin:CAPPlugin,CAPBridgedPlugin {
 public let identifier="RoadshowWidgetsPlugin"
 public let jsName="RoadshowWidgets"
 public let pluginMethods:[CAPPluginMethod]=["configure","suspend","clear","snapshot","activity","status","consumeLink"].map{CAPPluginMethod(name:$0,returnType:CAPPluginReturnPromise)}
 private var connection:String?
 private let ownerKey="roadshow-widget-owner-v1"
 override public func load(){Task{@MainActor [weak self] in WidgetLinkInbox.changed={ [weak self] in self?.notifyListeners("link",data:[:])}}}
 private func perform(_ call:CAPPluginCall,_ body:@escaping @MainActor () async throws->[String:Any]) {
  Task{@MainActor in do{call.resolve(try await body())}catch{call.reject(error.localizedDescription)}}
 }
 @MainActor private func require(_ call:CAPPluginCall) throws {
  guard connection != nil,call.getString("connection")==connection,UIApplication.shared.applicationState == .active else{throw NSError(domain:"RoadshowWidgets",code:2,userInfo:[NSLocalizedDescriptionKey:"Open Roadshow and verify your account first."])}
 }
 @MainActor private func endAll() async {
  if #available(iOS 16.2,*) {for activity in Activity<ChecklistAttributes>.activities {await activity.end(nil,dismissalPolicy:.immediate)}}
 }
 @objc func configure(_ call:CAPPluginCall){perform(call){
  guard let owner=call.getString("owner"),UUID(uuidString:owner) != nil,let connection=call.getString("connection"),UUID(uuidString:connection) != nil,UIApplication.shared.applicationState == .active else{throw self.invalid()}
  if UserDefaults.standard.string(forKey:self.ownerKey) != owner {self.connection=nil;WidgetSnapshotStore.clear();WidgetCenter.shared.reloadAllTimelines();await self.endAll()}
  UserDefaults.standard.set(owner,forKey:self.ownerKey);self.connection=connection
  return self.currentStatus()
 }}
 @objc func suspend(_ call:CAPPluginCall){perform(call){if call.getString("connection")==self.connection {self.connection=nil};return [:]}}
 @objc func clear(_ call:CAPPluginCall){perform(call){self.connection=nil;UserDefaults.standard.removeObject(forKey:self.ownerKey);WidgetSnapshotStore.clear();WidgetCenter.shared.reloadAllTimelines();await self.endAll();return [:]}}
 @objc func snapshot(_ call:CAPPluginCall){perform(call){
  try self.require(call)
  guard let object=call.getObject("snapshot"),JSONSerialization.isValidJSONObject(object),let data=try? JSONSerialization.data(withJSONObject:object),data.count<=4096,let snapshot=try? JSONDecoder().decode(WidgetSnapshot.self,from:data),snapshot.isValid(now:Date().timeIntervalSince1970) else{throw self.invalid()}
  try WidgetSnapshotStore.write(snapshot);WidgetCenter.shared.reloadTimelines(ofKind:"RoadshowNextShow");return [:]
 }}
 @MainActor private func currentStatus()->[String:Any]{
  var result:[String:Any]=["widgetAvailable":WidgetSnapshotStore.file != nil,"activityAvailable":false,"following":""]
  if #available(iOS 16.2,*) {result["activityAvailable"]=ActivityAuthorizationInfo().areActivitiesEnabled;result["following"]=Activity<ChecklistAttributes>.activities.first(where:{$0.activityState == .active || $0.activityState == .stale})?.attributes.assignmentID ?? ""}
  return result
 }
 @objc func status(_ call:CAPPluginCall){perform(call){try self.require(call);return self.currentStatus()}}
 @objc func consumeLink(_ call:CAPPluginCall){perform(call){try self.require(call);let value=WidgetLinkInbox.pending;WidgetLinkInbox.pending=nil;return ["url":value ?? ""]}}
 @objc func activity(_ call:CAPPluginCall){perform(call){
  try self.require(call)
  guard #available(iOS 16.2,*) else{throw self.invalid()}
  let operation=call.getString("operation") ?? ""
  if operation=="stop" {await self.endAll();return self.currentStatus()}
  guard operation=="start" || operation=="update",let id=call.getString("id"),UUID(uuidString:id) != nil,let title=call.getString("title"),!title.isEmpty,title.count<=120,let completed=call.getInt("completed"),let total=call.getInt("total"),total>0,total<=10000,completed>=0,completed<=total else{throw self.invalid()}
  if completed==total {await self.endAll();return self.currentStatus()}
  let now=Date();let state=ChecklistAttributes.ContentState(completed:completed,total:total,updatedAt:now.timeIntervalSince1970)
  if operation=="start" {
   guard ActivityAuthorizationInfo().areActivitiesEnabled else{throw NSError(domain:"RoadshowWidgets",code:3,userInfo:[NSLocalizedDescriptionKey:"Live Activities are disabled in iPhone Settings."])}
   await self.endAll();try self.require(call)
   let attributes=ChecklistAttributes(assignmentID:id,title:title,deadline:now.addingTimeInterval(8*3600))
   _=try Activity.request(attributes:attributes,content:ActivityContent(state:state,staleDate:now.addingTimeInterval(300)),pushType:nil)
  } else {
   for activity in Activity<ChecklistAttributes>.activities where activity.attributes.assignmentID==id {
    if now>=activity.attributes.deadline {await activity.end(nil,dismissalPolicy:.immediate)}
    else {await activity.update(ActivityContent(state:state,staleDate:min(now.addingTimeInterval(300),activity.attributes.deadline)))}
   }
  }
  return self.currentStatus()
 }}
 private func invalid()->NSError {NSError(domain:"RoadshowWidgets",code:4,userInfo:[NSLocalizedDescriptionKey:"Invalid widget or checklist data."])}
}
