import SwiftUI
import WatchConnectivity
@MainActor final class WatchReceiver:NSObject,ObservableObject,WCSessionDelegate {
 @Published private(set) var inbox=WatchInbox()
 private let file:URL
 private let watermarkKey="roadshow-watch-inbox-revision-v1"
 override init(){
  let root=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("RoadshowWatch",isDirectory:true)
  try? FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
  var protectedRoot=root;var values=URLResourceValues();values.isExcludedFromBackup=true;try? protectedRoot.setResourceValues(values)
  file=root.appendingPathComponent("snapshot.json")
  super.init()
  inbox=WatchInbox(revisionFloor:Int64(UserDefaults.standard.double(forKey:watermarkKey)))
  if let data=try? Data(contentsOf:file),let saved=try? JSONDecoder().decode(WatchSnapshot.self,from:data),saved.revision==Int64(UserDefaults.standard.double(forKey:watermarkKey)){inbox=WatchInbox(snapshot:saved)}
  WCSession.default.delegate=self;WCSession.default.activate()
 }
 func refresh(){if WCSession.default.activationState == .activated && WCSession.default.isReachable {WCSession.default.sendMessage(["refresh":true],replyHandler:nil,errorHandler:nil)}}
 private func receive(_ data:Data){
  guard data.count<=8192,let next=try? JSONDecoder().decode(WatchSnapshot.self,from:data),inbox.receive(next,now:Date().timeIntervalSince1970) else{return}
  UserDefaults.standard.set(Double(next.revision),forKey:watermarkKey)
  try? data.write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
  objectWillChange.send()
 }
 nonisolated func session(_ session:WCSession,activationDidCompleteWith activationState:WCSessionActivationState,error:Error?){
  if let data=session.receivedApplicationContext["snapshot"] as? Data {Task{@MainActor in self.receive(data)}}
  Task{@MainActor in self.refresh()}
 }
 nonisolated func session(_ session:WCSession,didReceiveApplicationContext applicationContext:[String:Any]){if let data=applicationContext["snapshot"] as? Data {Task{@MainActor in self.receive(data)}}}
 nonisolated func session(_ session:WCSession,didReceiveMessageData messageData:Data){Task{@MainActor in self.receive(messageData)}}
}
@main struct RoadshowWatchApp:App {
 @StateObject private var receiver=WatchReceiver()
 @Environment(\.scenePhase) private var phase
 var body:some Scene {WindowGroup {
  TimelineView(.periodic(from:.now,by:30)){context in
   ScrollView {VStack(alignment:.leading,spacing:10){
    Text("ROADSHOW").font(.caption).foregroundStyle(.secondary)
    if let snapshot=receiver.inbox.snapshot,snapshot.readable(now:context.date.timeIntervalSince1970) {
     if let work=snapshot.work {
      Text(work.title).font(.headline)
      Text(work.dateLabel).font(.subheadline)
      Text(work.venue).font(.subheadline).foregroundStyle(.secondary)
      if work.total>0 {ProgressView(value:Double(work.completed),total:Double(work.total));Text("\(work.completed) of \(work.total) tasks").font(.caption)}
      else {Text("No checklist tasks").font(.caption)}
     } else {Text("No assigned work").font(.headline)}
     Text(context.date.timeIntervalSince1970-snapshot.updatedAt>=1800 ? "Saved copy · May be out of date" : "Saved from iPhone").font(.caption2).foregroundStyle(.secondary)
     Text("Last updated \(Date(timeIntervalSince1970:snapshot.updatedAt).formatted(date:.abbreviated,time:.shortened))").font(.caption2)
    } else {Text("Open Roadshow on iPhone").font(.headline);Text("Connect to your iPhone to get a current assignment.").font(.caption).foregroundStyle(.secondary)}
   }.frame(maxWidth:.infinity,alignment:.leading).padding()}
  }.onChange(of:phase){_,value in if value == .active {receiver.refresh()}}
 }}
}
