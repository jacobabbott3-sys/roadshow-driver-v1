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
  for color in ["forest","blue","purple","rust"] {
   assert(1.05/(luminance(ShellPalette.rgb(color,dark:false))+0.05)>=4.5)
   assert((luminance(ShellPalette.rgb(color,dark:true))+0.05)/(luminance((0.11,0.11,0.12))+0.05)>=4.5)
   let appearance=ShellAppearance(mode:"dark",haptics:false,color:color)
   assert(appearance.isValid)
   let restored=try JSONDecoder().decode(ShellAppearance.self,from:JSONEncoder().encode(appearance))
   assert(restored.accent == color)
  }
  let legacy=try JSONDecoder().decode(ShellAppearance.self,from:Data(#"{"mode":"dark","haptics":false}"#.utf8))
  assert(legacy.accent == "forest" && legacy.mode == "dark" && !legacy.haptics)
  assert(!ShellAppearance(mode:"system",haptics:true,color:"invalid").isValid)
  assert(ShellSwipe.commits(ended:true,distance:140,vertical:10,velocity:40,width:400))
  assert(ShellSwipe.commits(ended:true,distance:35,vertical:4,velocity:750,width:400))
  for (ended,x,y,v) in [(false,200.0,0.0,900.0),(true,20.0,0.0,100.0),(true,150.0,0.0,-100.0),(true,100.0,200.0,900.0)] {
   assert(!ShellSwipe.commits(ended:ended,distance:x,vertical:y,velocity:v,width:400))
  }
  gate.connect("gesture");var swipe=state(1,"gesture");swipe.canSwipeBack=true
  assert(gate.accept(swipe));assert(gate.actionAllowed("swipeBack"))
  swipe.sequence=2;swipe.modalOpen=true;assert(gate.accept(swipe));assert(!gate.actionAllowed("swipeBack"))
  gate.suspend();assert(!gate.actionAllowed("swipeBack"))
  print("Shell swipe completion/cancellation and modal gates passed")
  print("ShellState: 35 assertions passed, including four palette contrasts and persistence")
 }
}
