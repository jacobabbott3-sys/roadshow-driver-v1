import Foundation
@main struct WatchSnapshotTests {
 static func main()throws {
  let now=1_800_000_000.0,owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222"
  let work=WatchWork(title:"Fixture show",venue:"Denver",dateLabel:"Oct 12",completed:1,total:3)
  func value(_ revision:Int64,_ account:String?=owner,_ content:WatchWork?=work)->WatchSnapshot {WatchSnapshot(version:1,revision:revision,owner:account,updatedAt:now,expiresAt:now+21600,work:content)}
  var inbox=WatchInbox();assert(inbox.receive(value(1),now:now));assert(inbox.snapshot?.readable(now:now+10)==true)
  assert(inbox.snapshot?.readable(now:now+21600)==false);assert(inbox.snapshot?.readable(now:now-10)==false)
  assert(inbox.receive(value(2,other),now:now));assert(inbox.snapshot?.owner==other)
  assert(!inbox.receive(value(1),now:now));assert(inbox.snapshot?.owner==other)
  let clear=WatchSnapshot.make(nil,revision:3,now:now);assert(inbox.receive(clear,now:now));assert(inbox.snapshot?.readable(now:now)==false)
  assert(!inbox.receive(value(2,owner),now:now));assert(!inbox.receive(value(3),now:now))
  assert(!value(4,"not-an-account").valid(now:now));assert(!value(4,nil,work).valid(now:now))
  assert(!value(4,owner,WatchWork(title:"Bad",venue:"",dateLabel:"",completed:5,total:2)).valid(now:now))
  assert(!value(4).valid(now:now-120))
  let contract:[String:Any]=["status":"assigned","service_date":"2027-01-15","service_time":"09:00","show":["name":"Fixture","city":"Denver","event_type":"show"]]
  let checklist:[String:Any]=["sections":[["items":[["response":["completed":true]],["response":["completed":false]]]]]]
  let row:[String:Any]=["fetchedAt":now*1000,"contract":contract,"checklist":checklist]
  let saved:[String:Any]=["owner":owner,"verifiedAt":now*1000,"contracts":["a":row]]
  let projected=WatchSnapshot.make(saved,revision:4,now:now)
  assert(projected.work?.title=="Fixture" && projected.work?.completed==1 && projected.work?.total==2)
  assert(projected.updatedAt==now && projected.expiresAt==now+21600)
  assert(WatchSnapshot.make(saved,revision:6,now:now+300).updatedAt==now)
  var invalid=saved;invalid["owner"]="bad-owner";assert(WatchSnapshot.make(invalid,revision:7,now:now).owner==nil)
  assert(WatchSnapshot.make(saved,revision:5,now:now+21601).owner==nil)
  var restarted=WatchInbox(revisionFloor:10);assert(!restarted.receive(value(9),now:now));assert(restarted.receive(value(11),now:now))
  let data=try JSONEncoder().encode(projected);let restored=try JSONDecoder().decode(WatchSnapshot.self,from:data)
  assert(restored==projected);assert(!String(data:data,encoding:.utf8)!.contains("token"))
  print("Watch snapshot: projection, progress, account switch, clear, ordering, expiry, rollback and persistence fixtures passed")
 }
}
