import Foundation
@main struct OfflineStoreTests {
 static func check(_ value:Bool){assert(value)}
 static func main() throws {
  let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer {try? FileManager.default.removeItem(at:root)}
  let store=try OfflineStore(root:root), owner="11111111-1111-4111-8111-111111111111", generation=UUID().uuidString
  let now=Date().timeIntervalSince1970*1000
  let snapshot:[String:Any] = ["version":1,"owner":owner,"verifiedAt":now,"lastSeenAt":now,"contracts":[:],"links":[],"resources":[:]]
  try store.configure(owner:owner,generation:generation)
  try store.replace(snapshot,generation:generation,now:now)
  check((try store.read(now:now)) != nil)
  check((try store.read(now:now+604800000)) == nil)
  check((try store.read(now:now-1)) == nil)
  do {try store.replace(["version":2],generation:generation,now:now);assertionFailure("invalid snapshot accepted")}catch{}
  check((try store.read(now:now)) != nil)
  check((try store.read(now:now+1)) != nil)
  check((try store.read(now:now)) == nil)
  try store.clear()
  do {try store.replace(snapshot,generation:generation,now:now);assertionFailure("stale generation accepted")}catch{}
  check((try store.read(now:now)) == nil)
  print("Offline store assertions passed")
 }
}
