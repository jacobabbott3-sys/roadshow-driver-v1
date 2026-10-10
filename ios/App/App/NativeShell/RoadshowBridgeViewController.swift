import Capacitor
final class RoadshowBridgeViewController:CAPBridgeViewController {
 var shellStore:ShellStore?
 override func capacitorDidLoad() {
  let plugin=RoadshowShellPlugin();plugin.store=shellStore
  bridge?.registerPluginInstance(plugin)
 }
}
