import Foundation
import BackgroundTasks
@MainActor enum OfflineBackgroundScheduler {
 static let identifier="com.jacobabbott.roadshowdriver.refresh"
 static func register(){BGTaskScheduler.shared.register(forTaskWithIdentifier:identifier,using:nil){task in
  guard let task=task as? BGAppRefreshTask else{task.setTaskCompleted(success:false);return}
  Task{@MainActor in run(task)}
 }}
 static func schedule(){guard OfflineCredentialStore.read() != nil else{return};let request=BGAppRefreshTaskRequest(identifier:identifier);request.earliestBeginDate=Date(timeIntervalSinceNow:1800);try? BGTaskScheduler.shared.submit(request)}
 static func cancel(){BGTaskScheduler.shared.cancel(taskRequestWithIdentifier:identifier)}
 private static func run(_ task:BGAppRefreshTask){
  let completion=OfflineCompletion{task.setTaskCompleted(success:$0)}
  let work=Task{@MainActor in
   defer{schedule()}
   guard let access=OfflineCredentialStore.read(),access.expiresAt>floor(Date().timeIntervalSince1970*1000),let store=OfflineRuntime.store else{completion.finish(false);return}
   let config=URLSessionConfiguration.ephemeral;config.urlCache=nil;config.requestCachePolicy = .reloadIgnoringLocalCacheData
   let session=URLSession(configuration:config);defer{session.invalidateAndCancel()}
   do{
    if store.generation==nil {try store.configure(owner:access.owner,generation:access.generation)}
    try store.require(access.generation)
    let old=try store.read(now:floor(Date().timeIntervalSince1970*1000))
    let reader=OfflineBackgroundReader{request in let (data,response)=try await session.data(for:request);guard let response=response as? HTTPURLResponse else{throw OfflineReadError.unavailable};return(data,response)}
    guard let snapshot=try await reader.snapshot(access:access,now:floor(Date().timeIntervalSince1970*1000),resources:old?["resources"] as? [String:Any] ?? [:]) else{completion.finish(false);return}
    try Task.checkCancellation();try store.require(access.generation)
    try store.reverify(now:floor(Date().timeIntervalSince1970*1000),generation:access.generation)
    try store.replace(snapshot,generation:access.generation,now:floor(Date().timeIntervalSince1970*1000));completion.finish(true)
   }catch OfflineReadError.inactive {
    if store.generation==access.generation {try? store.clear();OfflineCredentialStore.clear();cancel()};completion.finish(false)
   }catch{completion.finish(false)}
  }
  task.expirationHandler={work.cancel()}
 }
}
