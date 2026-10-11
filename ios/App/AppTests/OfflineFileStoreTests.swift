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
  try store.replace(["version":1,"owner":owner,"verifiedAt":now,"lastSeenAt":now,"contracts":[:],"links":[],"resources":[:]],generation:g,now:now)
  let pdf=Data("%PDF-fixture".utf8)
  try store.putFile(ref:ref,data:pdf,mime:"application/pdf",generation:g,now:now)
  check(try store.readFile(ref:ref,now:now)["base64"] as? String == pdf.base64EncodedString())
  do{try store.putFile(ref:ref,data:Data(count:20*1024*1024+1),mime:"application/pdf",generation:g,now:now);assertionFailure("oversize accepted")}catch{}
  check(try store.readFile(ref:ref,now:now)["base64"] as? String == pdf.base64EncodedString())
  do{_ = try store.readFile(ref:["kind":"resource","recordId":"../owner"],now:now);assertionFailure("path accepted")}catch{}
  try store.removeFile(ref:ref,generation:g)
  do{_ = try store.readFile(ref:ref,now:now);assertionFailure("removed file readable")}catch{}
  try store.clear()
  do{try store.putFile(ref:ref,data:pdf,mime:"application/pdf",generation:g,now:now);assertionFailure("late file accepted")}catch{}
  print("Offline file assertions passed")
 }
}
