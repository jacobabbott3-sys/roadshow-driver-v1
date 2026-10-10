import Capacitor
import Foundation
@objc(RoadshowShellPlugin) public class RoadshowShellPlugin:CAPPlugin,CAPBridgedPlugin {
 public let identifier="RoadshowShellPlugin"
 public let jsName="RoadshowShell"
 public let pluginMethods:[CAPPluginMethod] = ["connect","setState","disconnect","setAppearance","showAppearance"].map {CAPPluginMethod(name:$0,returnType:CAPPluginReturnPromise)}
 var store:ShellStore?
 @objc func connect(_ call:CAPPluginCall) {
  guard let connection=call.getString("connection"),!connection.isEmpty,connection.count<=100 else {call.reject("Invalid connection");return}
  DispatchQueue.main.async { [weak self] in
   guard let self,let store=self.store else{call.reject("Native shell unavailable");return}
   store.event = { [weak self] name,payload in self?.notifyListeners(name,data:payload) }
   store.connect(connection)
   call.resolve(["version":1,"connection":connection,"appearance":["mode":store.appearance.mode,"haptics":store.appearance.haptics,"color":store.appearance.accent]])
  }
 }
 @objc func setState(_ call:CAPPluginCall) {
  guard let object=call.getObject("state"),JSONSerialization.isValidJSONObject(object),let data=try? JSONSerialization.data(withJSONObject:object),let state=try? JSONDecoder().decode(ShellState.self,from:data),state.isValid else{call.reject("Invalid shell state");return}
  DispatchQueue.main.async { [weak self] in
   guard self?.store?.accept(state) == true else{call.reject("Stale shell state");return};call.resolve()
  }
 }
 @objc func disconnect(_ call:CAPPluginCall) {
  let connection=call.getString("connection") ?? ""
  DispatchQueue.main.async { [weak self] in self?.store?.disconnect(connection);call.resolve() }
 }
 @objc func setAppearance(_ call:CAPPluginCall) {
  guard let object=call.getObject("appearance"),let mode=object["mode"] as? String,let haptics=object["haptics"] as? Bool else{call.reject("Invalid appearance");return}
  let appearance=ShellAppearance(mode:mode,haptics:haptics,color:object["color"] as? String)
  guard appearance.isValid else{call.reject("Invalid appearance");return}
  DispatchQueue.main.async { [weak self] in self?.store?.updateAppearance(appearance);call.resolve() }
 }
 @objc func showAppearance(_ call:CAPPluginCall) {
  DispatchQueue.main.async { [weak self] in
   guard let store=self?.store,store.visible else{call.reject("Shell is not ready");return}
   store.sheet="appearance";call.resolve()
  }
 }
}
