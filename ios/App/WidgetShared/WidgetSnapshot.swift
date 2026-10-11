import Foundation
struct WidgetAssignment:Codable,Hashable {
 let id:String
 let title:String
 let location:String
 let dateLabel:String
 var isValid:Bool {UUID(uuidString:id) != nil && !title.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty && [title,location,dateLabel].allSatisfy{$0.count<=120 && !$0.unicodeScalars.contains{CharacterSet.controlCharacters.contains($0)}}}
 var url:URL? {URL(string:"roadshow-driver://contract/\(id)")}
}
struct WidgetSnapshot:Codable {
 let version:Int
 let updatedAt:Double
 let expiresAt:Double
 let assignment:WidgetAssignment?
 enum DisplayState {case fresh,stale,expired}
 func isValid(now:Double)->Bool {version==1 && updatedAt.isFinite && expiresAt.isFinite && updatedAt<=now+60 && updatedAt>=now-21600 && expiresAt>updatedAt && expiresAt<=updatedAt+21600 && (assignment?.isValid ?? true)}
 func displayState(now:Double)->DisplayState {now>=expiresAt ? .expired : now>=updatedAt+1800 ? .stale : .fresh}
}
enum WidgetRoute {
 static func parse(_ value:String)->String? {
  guard let url=URLComponents(string:value),url.scheme=="roadshow-driver",url.host=="contract",url.user==nil,url.password==nil,url.port==nil,url.fragment==nil else{return nil}
  let id=String(url.path.dropFirst());guard UUID(uuidString:id) != nil,url.path=="/"+id,url.query==nil || url.query=="tab=checklist" else{return nil}
  return "roadshow-driver://contract/\(id)"+(url.query == nil ? "" : "?tab=checklist")
 }
}
