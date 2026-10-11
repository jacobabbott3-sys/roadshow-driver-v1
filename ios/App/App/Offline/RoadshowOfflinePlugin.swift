import Capacitor
import UIKit
@MainActor enum OfflineRuntime {
 static let store:OfflineStore? = try? OfflineStore(root:FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("RoadshowOffline-v1"))
}
@objc(RoadshowOfflinePlugin) public class RoadshowOfflinePlugin:CAPPlugin,CAPBridgedPlugin {
 public let identifier="RoadshowOfflinePlugin"
 public let jsName="RoadshowOffline"
 public let pluginMethods:[CAPPluginMethod] = ["configure","read","replace","clear","usage","readFile","removeFile","manifest"].map{CAPPluginMethod(name:$0,returnType:CAPPluginReturnPromise)}
 private func perform(_ call:CAPPluginCall,configured:Bool=true,_ body:@escaping @MainActor (OfflineStore,String,Double)throws->[String:Any]) {
  Task{@MainActor in do {
   guard UIApplication.shared.applicationState == .active,let store=OfflineRuntime.store else{throw OfflineError.stale}
   let generation=call.getString("generation") ?? ""
   if configured {try store.require(generation)}
   call.resolve(try body(store,generation,Date().timeIntervalSince1970*1000))
  }catch{call.reject(error.localizedDescription)}}
 }
 @objc func configure(_ call:CAPPluginCall){perform(call,configured:false){store,g,_ in try store.configure(owner:call.getString("owner") ?? "",generation:g);return [:]}}
 @objc func read(_ call:CAPPluginCall){perform(call){store,_,now in ["snapshot":try store.read(now:now) as Any? ?? NSNull()]}}
 @objc func replace(_ call:CAPPluginCall){perform(call){store,g,now in guard let snapshot=call.getObject("snapshot") else{throw OfflineError.invalid};try store.replace(snapshot,generation:g,now:now);return [:]}}
 @objc func clear(_ call:CAPPluginCall){perform(call,configured:false){store,_,_ in try store.clear();return [:]}}
 @objc func usage(_ call:CAPPluginCall){perform(call){store,_,_ in ["bytes":try store.usage(),"limit":OfflinePolicy.limit]}}
 @objc func manifest(_ call:CAPPluginCall){perform(call){store,_,now in ["files":try store.manifest(now:now)]}}
 @objc func readFile(_ call:CAPPluginCall){perform(call){store,_,now in guard let ref=call.getObject("ref") as? [String:String] else{throw OfflineError.invalid};return try store.readFile(ref:ref,now:now)}}
 @objc func removeFile(_ call:CAPPluginCall){perform(call){store,g,_ in guard let ref=call.getObject("ref") as? [String:String] else{throw OfflineError.invalid};try store.removeFile(ref:ref,generation:g);return [:]}}
}
