import Foundation
import WatchConnectivity
@MainActor final class WatchPhone:NSObject,WCSessionDelegate {
 static let shared=WatchPhone()
 private var observer:NSObjectProtocol?
 private let revisionKey="roadshow-watch-revision-v1"
 func start(){
  guard WCSession.isSupported() else{return}
  WCSession.default.delegate=self;WCSession.default.activate()
  observer=NotificationCenter.default.addObserver(forName:Notification.Name("RoadshowOfflineChanged"),object:nil,queue:.main){[weak self] _ in Task{@MainActor in self?.publish()}}
 }
 func publish(){
  let session=WCSession.default
  guard session.activationState == .activated,session.isPaired else{return}
  let now=Date().timeIntervalSince1970
  let revision=max(Int64(now*1000),Int64(UserDefaults.standard.double(forKey:revisionKey))+1)
  UserDefaults.standard.set(Double(revision),forKey:revisionKey)
  let source=try? OfflineRuntime.store?.read(now:floor(now*1000))
  let payload=WatchSnapshot.make(source,revision:revision,now:now)
  guard payload.valid(now:now),let data=try? JSONEncoder().encode(payload) else{return}
  try? session.updateApplicationContext(["snapshot":data])
  if session.isReachable {session.sendMessageData(data,replyHandler:nil,errorHandler:nil)}
 }
 nonisolated func session(_ session:WCSession,activationDidCompleteWith activationState:WCSessionActivationState,error:Error?){Task{@MainActor in self.publish()}}
 nonisolated func sessionDidBecomeInactive(_ session:WCSession){}
 nonisolated func sessionDidDeactivate(_ session:WCSession){session.activate()}
 nonisolated func sessionWatchStateDidChange(_ session:WCSession){Task{@MainActor in self.publish()}}
 nonisolated func session(_ session:WCSession,didReceiveMessage message:[String:Any]){if message["refresh"] as? Bool == true {Task{@MainActor in self.publish()}}}
}
