import Foundation
// Call on the main actor in the app: one writer for bridge and background tasks.
final class OfflineStore {
 let root:URL
 private(set) var owner:String?
 private(set) var generation:String?
 private let fm=FileManager.default
 init(root:URL) throws {
  self.root=root
  try fm.createDirectory(at:root,withIntermediateDirectories:true)
  guard !(try root.resourceValues(forKeys:[.isSymbolicLinkKey])).isSymbolicLink! else{throw OfflineError.invalid}
  try protect(root)
 }
 func protect(_ url:URL)throws {
  var resource=url;var values=URLResourceValues();values.isExcludedFromBackup=true;try resource.setResourceValues(values)
  #if os(iOS)
  try fm.setAttributes([.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication],ofItemAtPath:url.path)
  #endif
 }
 func configure(owner:String,generation:String)throws {
  guard UUID(uuidString:owner) != nil,UUID(uuidString:generation) != nil else{throw OfflineError.invalid}
  let previous=(try? String(contentsOf:root.appendingPathComponent("owner"),encoding:.utf8))
  if previous != owner {try clear()}
  self.owner=owner;self.generation=generation
  try Data(owner.utf8).write(to:root.appendingPathComponent("owner"),options:.atomic);try protect(root.appendingPathComponent("owner"))
 }
 func require(_ generation:String)throws {guard owner != nil,self.generation==generation else{throw OfflineError.stale}}
 func clear()throws {
  owner=nil;generation=nil
  for url in try fm.contentsOfDirectory(at:root,includingPropertiesForKeys:nil){try fm.removeItem(at:url)}
 }
 func read(now:Double)throws->[String:Any]? {
  let file=root.appendingPathComponent("snapshot.json")
  guard fm.fileExists(atPath:file.path) else{return nil}
  guard !(try file.resourceValues(forKeys:[.isSymbolicLinkKey])).isSymbolicLink! else{throw OfflineError.invalid}
  guard let value=try? JSONSerialization.jsonObject(with:Data(contentsOf:file)) as? [String:Any],OfflinePolicy.readable(value,owner:owner,now:now) else{return nil}
  var updated=value;updated["lastSeenAt"]=now
  try JSONSerialization.data(withJSONObject:updated).write(to:file,options:.atomic);try protect(file)
  return updated
 }
 func replace(_ value:[String:Any],generation:String,now:Double)throws {
  try require(generation)
  guard OfflinePolicy.readable(value,owner:owner,now:now) else{throw OfflineError.invalid}
  let data=try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys])
  let file=root.appendingPathComponent("snapshot.json")
  let old=(try? file.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0
  guard try usage()-old+data.count<=OfflinePolicy.limit else{throw OfflineError.full}
  try data.write(to:file,options:.atomic);try protect(file)
 }
 func usage()throws->Int {
  try fm.contentsOfDirectory(at:root,includingPropertiesForKeys:[.fileSizeKey]).reduce(0){sum,url in sum+((try? url.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0)}
 }
}
