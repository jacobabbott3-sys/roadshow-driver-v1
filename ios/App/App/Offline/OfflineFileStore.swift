import Foundation
extension OfflineStore {
 func fileURL(_ ref:[String:String])throws->URL {
  guard let kind=ref["kind"],["resource","contract-document","contract-photo"].contains(kind),let id=ref["recordId"],UUID(uuidString:id) != nil else{throw OfflineError.invalid}
  let contract=ref["contractId"] ?? ""
  if kind != "resource" && UUID(uuidString:contract)==nil {throw OfflineError.invalid}
  let url=root.appendingPathComponent("file-\(kind)-\(contract)-\(id).json")
  if FileManager.default.fileExists(atPath:url.path),(try url.resourceValues(forKeys:[.isSymbolicLinkKey])).isSymbolicLink==true {throw OfflineError.invalid}
  return url
 }
 func putFile(ref:[String:String],data:Data,mime:String,generation:String,now:Double)throws {
  try require(generation)
  guard try read(now:now) != nil else{throw OfflineError.expired}
  guard data.count<=OfflinePolicy.fileLimit else{throw OfflineError.full}
  let valid = (mime=="application/pdf" && data.starts(with:Data("%PDF-".utf8))) || (mime=="image/jpeg" && data.starts(with:[0xff,0xd8,0xff])) || (mime=="image/png" && data.starts(with:[0x89,0x50,0x4e,0x47])) || (mime=="image/webp" && data.starts(with:Data("RIFF".utf8)) && data.dropFirst(8).starts(with:Data("WEBP".utf8)))
  guard valid else{throw OfflineError.invalid}
  let url=try fileURL(ref),object:[String:Any] = ["ref":ref,"mime":mime,"bytes":data.count,"fetchedAt":now,"validator":NSNull(),"base64":data.base64EncodedString()]
  let encoded=try JSONSerialization.data(withJSONObject:object)
  let old=(try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0
  guard try usage()-old+encoded.count<=OfflinePolicy.limit else{throw OfflineError.full}
  try encoded.write(to:url,options:.atomic);try protect(url)
 }
 func readFile(ref:[String:String],now:Double)throws->[String:Any] {
  guard try read(now:now) != nil else{throw OfflineError.expired}
  let data=try Data(contentsOf:fileURL(ref))
  guard data.count<=OfflinePolicy.fileLimit*2,let result=try JSONSerialization.jsonObject(with:data) as? [String:Any],result["ref"] as? [String:String]==ref else{throw OfflineError.invalid}
  return result
 }
 func removeFile(ref:[String:String],generation:String)throws {
  try require(generation);let url=try fileURL(ref)
  if FileManager.default.fileExists(atPath:url.path){try FileManager.default.removeItem(at:url)}
 }
 func manifest(now:Double)throws->[[String:Any]] {
  guard try read(now:now) != nil else{return []}
  return try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:[.isSymbolicLinkKey]).filter{$0.lastPathComponent.hasPrefix("file-")}.compactMap{url in
   guard (try url.resourceValues(forKeys:[.isSymbolicLinkKey])).isSymbolicLink != true,let object=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any] else{return nil}
   return object.filter{$0.key != "base64"}
  }
 }
}
