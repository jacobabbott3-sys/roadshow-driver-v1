import Foundation
@main struct WidgetSnapshotTests {
 static func main() throws {
  let item=WidgetAssignment(id:"11111111-1111-4111-8111-111111111111",title:"Syracuse",location:"NY",dateLabel:"Oct 10")
  let snapshot=WidgetSnapshot(version:1,updatedAt:1000,expiresAt:22600,assignment:item)
  assert(snapshot.isValid(now:1000));assert(snapshot.displayState(now:2801) == .stale);assert(snapshot.displayState(now:22600) == .expired)
  assert(!WidgetSnapshot(version:1,updatedAt:1000,expiresAt:100000,assignment:item).isValid(now:1000))
  assert(!WidgetAssignment(id:"bad",title:"Show",location:"NY",dateLabel:"Today").isValid)
  assert(!WidgetAssignment(id:item.id,title:String(repeating:"x",count:121),location:"NY",dateLabel:"Today").isValid)
  assert(WidgetRoute.parse("roadshow-driver://contract/\(item.id)?tab=checklist") != nil)
  assert(WidgetRoute.parse("roadshow-driver://contract/\(item.id)?evil=1") == nil)
  assert(WidgetRoute.parse("https://contract/\(item.id)") == nil)
  assert(WidgetRoute.parse("roadshow-driver://contract/\(item.id)/extra") == nil)
  let decoded=try JSONDecoder().decode(WidgetSnapshot.self,from:JSONEncoder().encode(snapshot));assert(decoded.assignment?.id==item.id)
  print("Widget snapshot: 11 validation, expiry and deep-link assertions passed")
 }
}
