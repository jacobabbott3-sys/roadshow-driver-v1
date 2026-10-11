import Capacitor
import UIKit
@MainActor enum OfflineRuntime {
 static let store:OfflineStore? = try? OfflineStore(root:FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("RoadshowOffline-v1"))
}
@objc(RoadshowOfflinePlugin) public class RoadshowOfflinePlugin:CAPPlugin,CAPBridgedPlugin {
 public let identifier="RoadshowOfflinePlugin"
 public let jsName="RoadshowOffline"
 public let pluginMethods:[CAPPluginMethod] = ["configure","read","replace","clear","usage","readFile","removeFile","manifest","putFile","setAccess","clearAccess"].map{CAPPluginMethod(name:$0,returnType:CAPPluginReturnPromise)}
 private func perform(_ call:CAPPluginCall,configured:Bool=true,_ body:@escaping @MainActor (OfflineStore,String,Double)throws->[String:Any]) {
  Task{@MainActor in do {
   guard UIApplication.shared.applicationState == .active,let store=OfflineRuntime.store else{throw OfflineError.stale}
   let generation=call.getString("generation") ?? ""
   if configured {try store.require(generation)}
   call.resolve(try body(store,generation,floor(Date().timeIntervalSince1970*1000)))
  }catch{call.reject(error.localizedDescription)}}
 }
 @objc func clearAccess(_ call:CAPPluginCall){perform(call){_,_,_ in OfflineCredentialStore.clear();OfflineBackgroundScheduler.cancel();return [:]}}
 @objc func setAccess(_ call:CAPPluginCall){perform(call){store,g,now in
  guard let owner=store.owner,let token=call.getString("token"),token.count<20000,let expires=call.getDouble("expiresAt"),expires>now,let apiKey=call.getString("apiKey"),!apiKey.isEmpty,apiKey.count<10000 else{throw OfflineError.invalid}
  let parts=token.split(separator:".");guard parts.count==3 else{throw OfflineError.invalid}
  var encoded=String(parts[1]).replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/");encoded+=String(repeating:"=",count:(4-encoded.count%4)%4)
  guard let data=Data(base64Encoded:encoded),let claims=try JSONSerialization.jsonObject(with:data) as? [String:Any],claims["sub"] as? String == owner,let exp=claims["exp"] as? Double,expires<=exp*1000 else{throw OfflineError.invalid}
  try store.reverify(now:now,generation:g)
  try OfflineCredentialStore.set(OfflineAccess(owner:owner,token:token,expiresAt:expires,apiKey:apiKey,generation:g));OfflineBackgroundScheduler.schedule();return [:]
 }}
 @objc func configure(_ call:CAPPluginCall){perform(call,configured:false){store,g,_ in let owner=call.getString("owner") ?? "";if OfflineCredentialStore.read()?.owner != owner {OfflineCredentialStore.clear();OfflineBackgroundScheduler.cancel()};try store.configure(owner:owner,generation:g);return [:]}}
 @objc func read(_ call:CAPPluginCall){perform(call){store,_,now in ["snapshot":try store.read(now:now) as Any? ?? NSNull()]}}
 @objc func replace(_ call:CAPPluginCall){perform(call){store,g,now in guard let snapshot=call.getObject("snapshot") else{throw OfflineError.invalid};try store.replace(snapshot,generation:g,now:now);return [:]}}
 @objc func clear(_ call:CAPPluginCall){perform(call,configured:false){store,_,_ in OfflineCredentialStore.clear();OfflineBackgroundScheduler.cancel();try store.clear();return [:]}}
 @objc func usage(_ call:CAPPluginCall){perform(call){store,_,_ in ["bytes":try store.usage(),"limit":OfflinePolicy.limit]}}
 @objc func manifest(_ call:CAPPluginCall){perform(call){store,_,now in ["files":try store.manifest(now:now)]}}
 @objc func readFile(_ call:CAPPluginCall){perform(call){store,_,now in guard let ref=call.getObject("ref") as? [String:String] else{throw OfflineError.invalid};return try store.readFile(ref:ref,now:now)}}
 @objc func putFile(_ call:CAPPluginCall){perform(call){store,g,now in guard let ref=call.getObject("ref") as? [String:String],let mime=call.getString("mime"),let base64=call.getString("base64"),base64.utf8.count<=OfflinePolicy.fileLimit*2,let data=Data(base64Encoded:base64) else{throw OfflineError.invalid};try store.putFile(ref:ref,data:data,mime:mime,generation:g,now:now);return [:]}}
 @objc func removeFile(_ call:CAPPluginCall){perform(call){store,g,_ in guard let ref=call.getObject("ref") as? [String:String] else{throw OfflineError.invalid};try store.removeFile(ref:ref,generation:g);return [:]}}
}
