import Foundation
@main struct OfflineBackgroundTests {
 static func main() async throws {
  let owner="11111111-1111-4111-8111-111111111111",now=1000000000.0
  var calls=0
  let expired=OfflineAccess(owner:owner,token:"fixture",expiresAt:now-1,apiKey:"fixture",generation:UUID().uuidString)
  let reader=OfflineBackgroundReader { request in calls+=1;return (Data("[]".utf8),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:["Content-Range":"*/0"])!) }
  let skipped=try await reader.snapshot(access:expired,now:now,resources:[:]);assert(skipped==nil&&calls==0)
  let access=OfflineAccess(owner:owner,token:"fixture",expiresAt:now+100000,apiKey:"fixture",generation:UUID().uuidString)
  do{_ = try await reader.snapshot(access:access,now:now,resources:[:]);assertionFailure("missing profile accepted")}catch{}
  let inactive=OfflineBackgroundReader { request in
   (Data("[{\"id\":\"\(owner)\",\"is_active\":false}]".utf8),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:["Content-Range":"0-0/1"])!)
  }
  do{_ = try await inactive.snapshot(access:access,now:now,resources:[:]);assertionFailure("inactive accepted")}catch OfflineReadError.inactive{}catch{throw error}
  let partial=OfflineBackgroundReader { request in
   let body=request.url!.path.hasSuffix("profiles") ? "[{\"id\":\"\(owner)\",\"is_active\":true}]" : "[]"
   return (Data(body.utf8),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:[:])!)
  }
  do{_ = try await partial.snapshot(access:access,now:now,resources:[:]);assertionFailure("partial response accepted")}catch{}
  var completions=0;let completion=OfflineCompletion{_ in completions+=1};completion.finish(false);completion.finish(true);assert(completions==1)
  print("Offline background assertions passed")
 }
}
