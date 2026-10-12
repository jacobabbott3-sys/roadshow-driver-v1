import Foundation
struct WatchWork:Codable,Equatable {
 let title:String;let venue:String;let dateLabel:String;let completed:Int;let total:Int
 var valid:Bool { !title.isEmpty && [title,venue,dateLabel].allSatisfy{$0.count<=160 && !$0.unicodeScalars.contains{CharacterSet.controlCharacters.contains($0)}} && total>=0 && total<=10000 && completed>=0 && completed<=total }
}
struct WatchSnapshot:Codable,Equatable {
 let version:Int;let revision:Int64;let owner:String?;let updatedAt:Double;let expiresAt:Double;let work:WatchWork?
 func valid(now:Double)->Bool {
  version==1 && revision>0 && updatedAt.isFinite && expiresAt.isFinite && updatedAt<=now+60 && expiresAt>=updatedAt && expiresAt<=updatedAt+21600 && (owner.map{UUID(uuidString:$0) != nil} ?? (work==nil)) && (work?.valid ?? true)
 }
 func readable(now:Double)->Bool {valid(now:now) && owner != nil && now>=updatedAt && now<expiresAt}
 static func formatDate(_ value:String)->String {
  let input=value.trimmingCharacters(in:.whitespaces)
  let iso=ISO8601DateFormatter();var date=iso.date(from:input)
  if date==nil {iso.formatOptions=[.withInternetDateTime,.withFractionalSeconds];date=iso.date(from:input)}
  if date==nil {
   let parser=DateFormatter();parser.locale=Locale(identifier:"en_US_POSIX");parser.isLenient=false
   for format in ["yyyy-MM-dd HH:mm:ss","yyyy-MM-dd HH:mm","yyyy-MM-dd"] {parser.dateFormat=format;if let parsed=parser.date(from:input){date=parsed;break}}
  }
  guard let date else{return input}
  let display=DateFormatter();display.dateStyle = .medium;display.timeStyle = input.count>10 ? .short : .none
  return display.string(from:date)
 }
 static func make(_ source:[String:Any]?,revision:Int64,now:Double)->WatchSnapshot {
  let cleared=WatchSnapshot(version:1,revision:revision,owner:nil,updatedAt:now,expiresAt:now,work:nil)
  guard let source,let owner=source["owner"] as? String,let rows=source["contracts"] as? [String:[String:Any]],let verified=source["verifiedAt"] as? Double else{return cleared}
  let eligible=rows.values.filter{row in guard let c=row["contract"] as? [String:Any],let status=c["status"] as? String else{return false};return !["approved","bonus_earned","bonus_not_earned"].contains(status)}.sorted{a,b in
   func key(_ row:[String:Any])->String {let c=row["contract"] as? [String:Any] ?? [:];let s=c["show"] as? [String:Any] ?? [:];return ((s["event_type"] as? String)=="signing" ? (s["setup_at"] as? String ?? s["signing_at"] as? String ?? s["starts_on"] as? String) : ((c["service_date"] as? String ?? "")+" "+(c["service_time"] as? String ?? ""))) ?? ""}
   if key(a) != key(b){return key(a)<key(b)}
   return ((a["contract"] as? [String:Any])?["id"] as? String ?? "") < ((b["contract"] as? [String:Any])?["id"] as? String ?? "")
  }
  var work:WatchWork?;var stamp=verified/1000
  if let row=eligible.first,let c=row["contract"] as? [String:Any],let show=c["show"] as? [String:Any] {
   stamp=(row["fetchedAt"] as? Double ?? verified)/1000
   let signing=show["event_type"] as? String == "signing"
   let date=signing ? (show["setup_at"] as? String ?? show["signing_at"] as? String ?? show["starts_on"] as? String ?? "") : (c["service_date"] as? String ?? "") + " " + (c["service_time"] as? String ?? "")
   let sections=(row["checklist"] as? [String:Any])?["sections"] as? [[String:Any]] ?? []
   let items=sections.flatMap{$0["items"] as? [[String:Any]] ?? []}
   func short(_ s:String)->String {String(s.unicodeScalars.filter{!CharacterSet.controlCharacters.contains($0)}.map(String.init).joined().prefix(160))}
   work=WatchWork(title:short(signing ? (show["artist"] as? String ?? show["name"] as? String ?? "Show") : (show["name"] as? String ?? "Show")),venue:short(show["venue_name"] as? String ?? [show["city"] as? String,show["state"] as? String].compactMap{$0}.joined(separator:", ")),dateLabel:short(formatDate(date)),completed:items.filter{($0["response"] as? [String:Any])?["completed"] as? Bool == true}.count,total:items.count)
  }
  let expiry=min(stamp+21600,verified/1000+604800)
  guard stamp<=now,expiry>now else{return cleared}
  let result=WatchSnapshot(version:1,revision:revision,owner:owner,updatedAt:stamp,expiresAt:expiry,work:work)
  return result.valid(now:now) ? result : cleared
 }
}
struct WatchInbox {
 private(set) var snapshot:WatchSnapshot?
 private var revisionFloor:Int64
 init(snapshot:WatchSnapshot?=nil,revisionFloor:Int64=0){self.snapshot=snapshot;self.revisionFloor=max(revisionFloor,snapshot?.revision ?? 0)}
 mutating func receive(_ next:WatchSnapshot,now:Double)->Bool {
  guard next.valid(now:now),next.revision>revisionFloor else{return false}
  snapshot=next;revisionFloor=next.revision;return true
 }
}
