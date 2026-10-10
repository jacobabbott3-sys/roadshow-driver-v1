import Foundation
struct ShellState: Codable {
 var version:Int; var connection:String; var sequence:Int; var visible:Bool
 var tabs:[String]; var selected:String?; var canGoBack:Bool
 var unreadChats:Int; var unreadNotifications:Int; var modalOpen:Bool
 static let driverTabs=["home","contracts","resources","profile"]
 static let adminTabs=["home","contracts","resources","admin","profile"]
 var isValid:Bool {
  version == 1 && !connection.isEmpty && connection.count <= 100 && sequence >= 0 &&
  (tabs == Self.driverTabs || tabs == Self.adminTabs) &&
  (selected == nil || tabs.contains(selected!)) && unreadChats >= 0 && unreadNotifications >= 0
 }
}
struct ShellGate {
 private(set) var connection:String?; private(set) var state:ShellState?
 mutating func connect(_ id:String) {connection=id;state=nil}
 mutating func disconnect(_ id:String) {if id == connection {suspend()}}
 mutating func suspend() {connection=nil;state=nil}
 mutating func accept(_ next:ShellState)->Bool {
  guard next.isValid, next.connection == connection, next.sequence > (state?.sequence ?? -1) else{return false}
  var bounded=next;bounded.unreadChats=min(99,next.unreadChats);bounded.unreadNotifications=min(99,next.unreadNotifications)
  state=bounded;return true
 }
 func actionAllowed(_ action:String)->Bool {
  guard let s=state,s.visible,!s.modalOpen else{return false}
  if s.tabs.contains(action) {return action != s.selected}
  if action == "back" {return s.canGoBack}
  return ["chat","notifications","availability","redFolder","toolbag"].contains(action)
 }
}
struct ShellAppearance:Codable {
 var mode:String="system";var haptics:Bool=true
 var isValid:Bool {["system","light","dark"].contains(mode)}
}

enum ShellPalette {
 static let light=(0.12,0.48,0.32)
 static let dark=(0.41,0.84,0.60)
}
