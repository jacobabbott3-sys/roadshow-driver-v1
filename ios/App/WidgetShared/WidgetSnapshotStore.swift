import Foundation
struct WidgetSnapshotStore {
 static let group="group.com.jacobabbott.roadshowdriver.widgets"
 static var file:URL? {FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:group)?.appendingPathComponent("next-assignment.json")}
 static func read()->WidgetSnapshot? {
  guard let file,let data=try? Data(contentsOf:file),data.count<=4096,let snapshot=try? JSONDecoder().decode(WidgetSnapshot.self,from:data),snapshot.isValid(now:Date().timeIntervalSince1970) else{return nil};return snapshot
 }
 static func write(_ snapshot:WidgetSnapshot) throws {
  guard let file else{throw NSError(domain:"RoadshowWidgets",code:1,userInfo:[NSLocalizedDescriptionKey:"Widgets need App Group signing in Xcode."])}
  try JSONEncoder().encode(snapshot).write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
 }
 static func clear() {if let file {try? FileManager.default.removeItem(at:file)}}
}
