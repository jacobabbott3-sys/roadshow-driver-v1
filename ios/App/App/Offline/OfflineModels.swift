import Foundation
import CoreFoundation
enum OfflineError:Error,LocalizedError {
 case invalid,expired,full,stale
 var errorDescription:String? {switch self {case .invalid:return "Invalid saved data.";case .expired:return "Connect to refresh offline access.";case .full:return "Offline storage is full. Remove a download and try again.";case .stale:return "Account changed. Open Roadshow and try again."}}
}
enum OfflinePolicy {
 static let lease:Double=604800000
 static let limit=250*1024*1024
 static let fileLimit=20*1024*1024
 static func uuid(_ value:Any?)->Bool {guard let value=value as? String else{return false};return UUID(uuidString:value) != nil}
 static func number(_ value:Any?)->Bool {guard let value=value as? NSNumber,CFGetTypeID(value) != CFBooleanGetTypeID() else{return false};return value.doubleValue.isFinite}
 static func boolean(_ value:Any?)->Bool {guard let value=value as? NSNumber else{return false};return CFGetTypeID(value)==CFBooleanGetTypeID()}
 static func date(_ value:Any?)->Bool {
  guard let value=value as? String,value.range(of:"^\\d{4}-\\d{2}-\\d{2}$",options:.regularExpression) != nil else{return false}
  let formatter=DateFormatter();formatter.locale=Locale(identifier:"en_US_POSIX");formatter.timeZone=TimeZone(secondsFromGMT:0);formatter.dateFormat="yyyy-MM-dd";formatter.isLenient=false
  guard let parsed=formatter.date(from:value) else{return false};return formatter.string(from:parsed)==value
 }
 static func instant(_ value:Any?)->Bool {guard let value=value as? String else{return false};if date(value){return true};let formatter=ISO8601DateFormatter();formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds];if formatter.date(from:value) != nil{return true};formatter.formatOptions=[.withInternetDateTime];return formatter.date(from:value) != nil}
 static func optional(_ object:[String:Any],_ keys:[String],_ test:(Any?)->Bool)->Bool {keys.allSatisfy{object[$0]==nil || object[$0] is NSNull || test(object[$0])}}
 static func contract(_ c:[String:Any])->Bool {
  guard uuid(c["id"]),["setup","teardown"].contains(c["kind"] as? String ?? ""),let status=c["status"] as? String,!status.isEmpty,date(c["service_date"]),let show=c["show"] as? [String:Any],uuid(show["id"]),show["name"] is String,show["city"] is String,date(show["starts_on"]),date(show["ends_on"]),show["is_test"] as? Bool == false,["show","signing"].contains(show["event_type"] as? String ?? "") else{return false}
  return optional(c,["service_time","document_path","terms","signature_name","admin_signature_name","admin_note"],{$0 is String}) && optional(c,["contract_pay","bonus_pay"],number) && optional(c,["signed_at","admin_signed_at"],instant) && optional(show,["state","address","artist","venue_name","lodging_name","lodging_address","lodging_phone","lodging_confirmation","lodging_notes","test_owner"],{$0 is String}) && optional(show,["bin_count","per_diem"],number) && optional(show,["meals_included","lodging_included"],boolean) && optional(show,["details_unlock_at","signing_at","setup_at","lodging_check_in","lodging_check_out"],instant)
 }
 static func response(_ value:Any?)->Bool {
  if value==nil || value is NSNull{return true}
  guard let value=value as? [String:Any],uuid(value["id"]),boolean(value["completed"]),optional(value,["note","review_status","review_note"],{$0 is String}),optional(value,["reviewed_at"],instant) else{return false}
  return value["reviewer"]==nil || value["reviewer"] is NSNull || (value["reviewer"] as? [String:Any])?["full_name"] is String
 }
 static func valid(_ object:[String:Any])->Bool {
  let keys:Set<String>=["version","owner","verifiedAt","lastSeenAt","contracts","links","resources"]
  guard Set(object.keys)==keys,object["version"] as? Int == 1,uuid(object["owner"]),let verified=object["verifiedAt"] as? Double,verified>0,let seen=object["lastSeenAt"] as? Double,seen>0,let contracts=object["contracts"] as? [String:[String:Any]],let resources=object["resources"] as? [String:[String:Any]],let links=object["links"] as? [[String:String]] else{return false}
  for (id,saved) in contracts {
   guard uuid(id),let c=saved["contract"] as? [String:Any],c["id"] as? String == id,contract(c),let checklist=saved["checklist"] as? [String:Any],checklist["id"] is NSNull || uuid(checklist["id"]),let sections=checklist["sections"] as? [[String:Any]],number(saved["fetchedAt"]) else{return false}
   for section in sections {
    guard uuid(section["id"]),section["title"] is String,number(section["position"]),let items=section["items"] as? [[String:Any]] else{return false}
    for item in items {guard uuid(item["id"]),item["title"] is String,optional(item,["instructions"],{$0 is String}),boolean(item["required"]),boolean(item["photo_required"]),number(item["position"]),response(item["response"]) else{return false}}
   }
  }
  for (id,saved) in resources {guard uuid(id),number(saved["fetchedAt"]),let resource=saved["resource"] as? [String:Any],resource["id"] as? String == id,resource["kind"] as? String == "handbook",resource["title"] is String,optional(resource,["content","file_path"],{$0 is String}),optional(resource,["file_type"],{["pdf","image"].contains($0 as? String ?? "")}) else{return false}}
  return links.allSatisfy{uuid($0["show_id"])&&uuid($0["linked_show_id"])}&&safe(object)
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
