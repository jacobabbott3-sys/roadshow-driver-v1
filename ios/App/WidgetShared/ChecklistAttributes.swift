import ActivityKit
import Foundation
@available(iOS 16.2,*)
struct ChecklistAttributes:ActivityAttributes {
 struct ContentState:Codable,Hashable {
  let completed:Int
  let total:Int
  let updatedAt:Double
 }
 let assignmentID:String
 let title:String
 let deadline:Date
 var url:URL? {URL(string:"roadshow-driver://contract/\(assignmentID)?tab=checklist")}
}
