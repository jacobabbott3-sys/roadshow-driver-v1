import Foundation
struct OfflineAccess:Codable {let owner:String;let token:String;let expiresAt:Double;let apiKey:String;let generation:String}
enum OfflineReadError:Error {case inactive,unavailable}
final class OfflineCompletion {
 private var finished=false;private let callback:(Bool)->Void
 init(_ callback:@escaping(Bool)->Void){self.callback=callback}
 func finish(_ success:Bool){guard !finished else{return};finished=true;callback(success)}
}
final class OfflineBackgroundReader {
 typealias Transport=(URLRequest) async throws -> (Data,HTTPURLResponse)
 let transport:Transport
 init(transport:@escaping Transport){self.transport=transport}
 private func rows(_ table:String,_ query:[String:String],access:OfflineAccess) async throws->[[String:Any]] {
  var result:[[String:Any]]=[]
  for _ in 0..<250 {
   try Task.checkCancellation()
   var url=URLComponents(string:"https://myraoovepjwhkafzdppq.supabase.co/rest/v1/\(table)")!
   url.queryItems=(query.merging(["offset":String(result.count),"limit":"200"]){a,_ in a}).map{URLQueryItem(name:$0.key,value:$0.value)}
   var request=URLRequest(url:url.url!);request.timeoutInterval=20
   request.setValue("Bearer \(access.token)",forHTTPHeaderField:"Authorization");request.setValue(access.apiKey,forHTTPHeaderField:"apikey");request.setValue("count=exact",forHTTPHeaderField:"Prefer")
   let (data,response)=try await transport(request)
   guard (200..<300).contains(response.statusCode),data.count<=20*1024*1024,let countText=response.value(forHTTPHeaderField:"Content-Range")?.split(separator:"/").last,let total=Int(countText),let page=try JSONSerialization.jsonObject(with:data) as? [[String:Any]] else{throw OfflineReadError.unavailable}
   result+=page
   if result.count==total{return result}
   guard !page.isEmpty,result.count<total else{throw OfflineReadError.unavailable}
  }
  throw OfflineReadError.unavailable
 }
 func snapshot(access:OfflineAccess,now:Double,resources:[String:Any]) async throws->[String:Any]? {
  guard access.expiresAt>now,UUID(uuidString:access.owner) != nil else{return nil}
  let profiles=try await rows("profiles",["select":"id,is_active","id":"eq.\(access.owner)"],access:access)
  guard profiles.count==1,profiles[0]["id"] as? String == access.owner else{throw OfflineReadError.unavailable}
  guard profiles[0]["is_active"] as? Bool == true else{throw OfflineReadError.inactive}
  let primary=try await rows("contracts",["select":"id","driver_id":"eq.\(access.owner)","order":"id"],access:access)
  let linked=try await rows("contract_drivers",["select":"contract_id","driver_id":"eq.\(access.owner)","order":"contract_id"],access:access)
  let ids=Set(primary.compactMap{$0["id"] as? String}+linked.compactMap{$0["contract_id"] as? String})
  guard ids.allSatisfy({UUID(uuidString:$0) != nil}) else{throw OfflineReadError.unavailable}
  let fields="id,driver_id,contract_drivers(driver_id),kind,service_date,service_time,status,contract_pay,bonus_pay,document_path,terms,signed_at,signature_name,admin_signed_at,admin_signature_name,admin_note,show:shows(id,name,starts_on,ends_on,city,state,address,bin_count,meals_included,lodging_included,details_unlock_at,event_type,artist,venue_name,signing_at,setup_at,per_diem,lodging_name,lodging_address,lodging_phone,lodging_confirmation,lodging_check_in,lodging_check_out,lodging_notes,is_test,test_owner)"
  var contracts:[String:Any]=[:],showIDs=Set<String>()
  for id in ids.sorted() {
   let records=try await rows("contracts",["select":fields,"id":"eq.\(id)"],access:access)
   guard records.count<=1 else{throw OfflineReadError.unavailable}
   guard var contract=records.first,let show=contract["show"] as? [String:Any],show["is_test"] as? Bool == false else{continue}
   let drivers=contract["contract_drivers"] as? [[String:Any]] ?? []
   guard contract["driver_id"] as? String == access.owner || drivers.contains(where:{$0["driver_id"] as? String == access.owner}) else{continue}
   contract.removeValue(forKey:"driver_id");contract.removeValue(forKey:"contract_drivers")
   let assigned=try await rows("contract_checklists",["select":"id,template_id","contract_id":"eq.\(id)"],access:access)
   guard assigned.count<=1 else{throw OfflineReadError.unavailable}
   var checklist:[String:Any] = ["id":NSNull(),"sections":[]]
   if let assignment=assigned.first,let checklistID=assignment["id"] as? String,let template=assignment["template_id"] as? String {
    var sections=try await rows("checklist_sections",["select":"id,title,position,items:checklist_items(id,title,instructions,required,photo_required,position)","template_id":"eq.\(template)","order":"position"],access:access)
    let responses=try await rows("checklist_responses",["select":"id,item_id,completed,note,review_status,review_note,reviewed_at,reviewer:profiles!checklist_responses_reviewed_by_fkey(full_name)","contract_checklist_id":"eq.\(checklistID)","order":"id"],access:access)
    for index in sections.indices {
     let items=(sections[index]["items"] as? [[String:Any]] ?? []).sorted{($0["position"] as? Int ?? 0)<($1["position"] as? Int ?? 0)}.map{item -> [String:Any] in
      var item=item;var response=responses.first{$0["item_id"] as? String == item["id"] as? String};response?.removeValue(forKey:"item_id");item["response"]=response as Any? ?? NSNull();return item
     };sections[index]["items"]=items
    }
    checklist=["id":checklistID,"sections":sections]
   }
   contracts[id] = ["contract":contract,"checklist":checklist,"fetchedAt":now]
   if let showID=show["id"] as? String {showIDs.insert(showID)}
  }
  let links=try await rows("show_links",["select":"show_id,linked_show_id","order":"show_id,linked_show_id"],access:access).filter{showIDs.contains($0["show_id"] as? String ?? "")&&showIDs.contains($0["linked_show_id"] as? String ?? "")}
  try Task.checkCancellation()
  return ["version":1,"owner":access.owner,"verifiedAt":now,"lastSeenAt":now,"contracts":contracts,"links":links,"resources":resources]
 }
}
