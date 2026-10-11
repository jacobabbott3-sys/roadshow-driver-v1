import Foundation
@main struct OfflineFileStoreTests {
 static func check(_ value:Bool){assert(value)}
 static func main() throws {
  let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer{try? FileManager.default.removeItem(at:root)}
  let store=try OfflineStore(root:root),owner="11111111-1111-4111-8111-111111111111",g=UUID().uuidString
  let ref=["kind":"resource","recordId":"22222222-2222-4222-8222-222222222222"]
  let now=Date().timeIntervalSince1970*1000
  try store.configure(owner:owner,generation:g)
  try store.replace(["version":1,"owner":owner,"verifiedAt":now,"lastSeenAt":now,"contracts":[:],"links":[],"resources":[ref["recordId"]!:["resource":["id":ref["recordId"]!,"kind":"handbook","title":"Fixture guide","content":NSNull(),"file_path":"guide.pdf","file_type":"pdf"],"fetchedAt":now]]],generation:g,now:now)
  let pdf=Data("%PDF-fixture".utf8)
  try store.putFile(ref:ref,data:pdf,mime:"application/pdf",generation:g,now:now)
  check(try store.readFile(ref:ref,now:now)["base64"] as? String == pdf.base64EncodedString())
  do{try store.putFile(ref:ref,data:Data(count:20*1024*1024+1),mime:"application/pdf",generation:g,now:now);assertionFailure("oversize accepted")}catch{}
  check(try store.readFile(ref:ref,now:now)["base64"] as? String == pdf.base64EncodedString())
  do{_ = try store.readFile(ref:["kind":"resource","recordId":"../owner"],now:now);assertionFailure("path accepted")}catch{}
  do{try store.putFile(ref:ref,data:Data("<html>".utf8),mime:"application/pdf",generation:g,now:now);assertionFailure("wrong bytes accepted")}catch{}
  let ballast=root.appendingPathComponent("ballast")
  _ = FileManager.default.createFile(atPath:ballast.path,contents:Data())
  let handle=try FileHandle(forWritingTo:ballast);try handle.truncate(atOffset:250*1024*1024);try handle.close()
  do{try store.putFile(ref:ref,data:pdf,mime:"application/pdf",generation:g,now:now);assertionFailure("quota exceeded")}catch{}
  check(try store.readFile(ref:ref,now:now)["base64"] as? String == pdf.base64EncodedString())
  try FileManager.default.removeItem(at:ballast)
  var limit=Data("%PDF-".utf8);limit.append(Data(count:20*1024*1024-5))
  try store.putFile(ref:ref,data:limit,mime:"application/pdf",generation:g,now:now)
  check(try store.readFile(ref:ref,now:now)["bytes"] as? Int == 20*1024*1024)
  let snapshot:[String:Any] = ["version":1,"owner":owner,"verifiedAt":now,"lastSeenAt":now,"contracts":[:],"links":[],"resources":[:]]
  try store.replace(snapshot,generation:g,now:now)
  do{_ = try store.readFile(ref:ref,now:now);assertionFailure("revoked file readable")}catch{}
  try store.removeFile(ref:ref,generation:g)
  do{_ = try store.readFile(ref:ref,now:now);assertionFailure("removed file readable")}catch{}
  try store.clear()
  do{try store.putFile(ref:ref,data:pdf,mime:"application/pdf",generation:g,now:now);assertionFailure("late file accepted")}catch{}
  print("Offline file assertions passed")
 }
}
