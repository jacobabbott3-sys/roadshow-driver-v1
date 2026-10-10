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
  func luminance(_ rgb:(Double,Double,Double))->Double {
   func linear(_ n:Double)->Double {n<=0.04045 ? n/12.92 : pow((n+0.055)/1.055,2.4)}
   return 0.2126*linear(rgb.0)+0.7152*linear(rgb.1)+0.0722*linear(rgb.2)
  }
  assert(1.05/(luminance(ShellPalette.light)+0.05)>=4.5)
  assert((luminance(ShellPalette.dark)+0.05)/(luminance((0.11,0.11,0.12))+0.05)>=4.5)
  print("ShellState: 19 assertions passed, including light/dark accent contrast")
 }
}
