import Foundation
enum OfflineError:Error,LocalizedError {
 case invalid,expired,full,stale
 var errorDescription:String? {switch self {case .invalid:return "Invalid saved data.";case .expired:return "Connect to refresh offline access.";case .full:return "Offline storage is full. Remove a download and try again.";case .stale:return "Account changed. Open Roadshow and try again."}}
}
enum OfflinePolicy {
 static let lease:Double=604800000
 static let limit=250*1024*1024
 static let fileLimit=20*1024*1024
 static func valid(_ object:[String:Any])->Bool {
  let keys:Set<String>=["version","owner","verifiedAt","lastSeenAt","contracts","links","resources"]
  guard Set(object.keys)==keys,object["version"] as? Int == 1,let owner=object["owner"] as? String,UUID(uuidString:owner) != nil,let verified=object["verifiedAt"] as? Double,verified>0,let seen=object["lastSeenAt"] as? Double,seen>0,let contracts=object["contracts"] as? [String:[String:Any]],object["resources"] is [String:[String:Any]],object["links"] is [[String:String]] else{return false}
  for (id,saved) in contracts {
   guard UUID(uuidString:id) != nil,let contract=saved["contract"] as? [String:Any],contract["id"] as? String == id,let show=contract["show"] as? [String:Any],show["is_test"] as? Bool == false,saved["checklist"] is [String:Any],saved["fetchedAt"] is Double else{return false}
  }
  return safe(object)
 }
 static func safe(_ value:Any)->Bool {
  if let object=value as? [String:Any] {return object.allSatisfy{!["__proto__","prototype","constructor","signed_url","access_token","refresh_token","password"].contains($0.key)&&safe($0.value)}}
  if let array=value as? [Any] {return array.count<=50000&&array.allSatisfy{safe($0)}}
  if let string=value as? String {return string.count<=200000}
  return value is NSNumber || value is NSNull
 }
 static func readable(_ object:[String:Any],owner:String?,now:Double)->Bool {
  guard valid(object),let owner,object["owner"] as? String == owner,let verified=object["verifiedAt"] as? Double,let seen=object["lastSeenAt"] as? Double else{return false}
  return now>=seen&&now>=verified&&now-verified<lease
 }
}
