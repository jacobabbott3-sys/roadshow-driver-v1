import Foundation
@main struct ShellStateTests {
 static func main() throws {
  let driver=["home","contracts","resources","profile"]
  func state(_ sequence:Int=1,_ connection:String="a",_ visible:Bool=true) -> ShellState {
   ShellState(version:1,connection:connection,sequence:sequence,visible:visible,tabs:driver,selected:"home",canGoBack:false,unreadChats:120,unreadNotifications:0,modalOpen:false)
  }
  var gate=ShellGate()
  assert(!gate.accept(state()))
  gate.connect("a")
  assert(gate.accept(state()))
  assert(gate.state?.unreadChats == 99)
  assert(gate.actionAllowed("contracts"))
  assert(!gate.actionAllowed("home"))
  assert(!gate.actionAllowed("admin"))
  assert(!gate.actionAllowed("https://example.com"))
  assert(!gate.accept(state()))
  gate.suspend()
  assert(!gate.actionAllowed("contracts"))
  assert(!gate.accept(state(2)))
  gate.connect("b")
  assert(!gate.accept(state(3)))
  assert(gate.accept(state(1,"b")))
  gate.disconnect("a")
  assert(gate.actionAllowed("contracts"))
  gate.disconnect("b")
  assert(gate.state == nil)
  var malformed=state();malformed.tabs=["admin"];assert(!malformed.isValid)
  malformed=state();malformed.unreadChats = -1;assert(!malformed.isValid)
  print("ShellState: 17 assertions passed")
 }
}
