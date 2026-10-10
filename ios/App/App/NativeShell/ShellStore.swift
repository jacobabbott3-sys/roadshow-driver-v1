import SwiftUI
import UIKit
@MainActor final class ShellStore:ObservableObject {
 @Published var gate=ShellGate()
 @Published var appearance=ShellAppearance()
 @Published var sheet:String?
 @Published var keyboardVisible=false
 var event:((String,[String:Any])->Void)?
 var layoutChanged:(()->Void)?
 private let key="roadshow-native-appearance-v1"
 init() {
  if let data=UserDefaults.standard.data(forKey:key),let saved=try? JSONDecoder().decode(ShellAppearance.self,from:data),saved.isValid {appearance=saved}
 }
 var visible:Bool {gate.state?.visible == true && gate.state?.modalOpen == false}
 func connect(_ connection:String) {gate.connect(connection);sheet=nil;layoutChanged?()}
 func accept(_ state:ShellState)->Bool {
  guard gate.accept(state) else{return false}
  if !visible {sheet=nil};layoutChanged?();return true
 }
 func disconnect(_ connection:String) {gate.disconnect(connection);if gate.connection == nil {sheet=nil};layoutChanged?()}
 func suspend() {gate.suspend();sheet=nil;layoutChanged?();event?("readiness",["ready":false])}
 func action(_ action:String) {
  guard gate.actionAllowed(action),let connection=gate.connection else{return}
  if appearance.haptics && (gate.state?.tabs.contains(action) == true) {UISelectionFeedbackGenerator().selectionChanged()}
  sheet=nil;event?("action",["action":action,"connection":connection])
 }
 func updateAppearance(_ next:ShellAppearance) {
  guard next.isValid else{return}
  appearance=next
  if let data=try? JSONEncoder().encode(next) {UserDefaults.standard.set(data,forKey:key)}
  event?("appearanceChanged",["appearance":["mode":next.mode,"haptics":next.haptics]])
  layoutChanged?()
 }
}
