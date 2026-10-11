import Capacitor
final class RoadshowBridgeViewController:CAPBridgeViewController {
 var shellStore:ShellStore?
 private var navigationProxy:ShellNavigationDelegate?
 override func capacitorDidLoad() {
  if let webView,let original=webView.navigationDelegate {
   let proxy=ShellNavigationDelegate(forwarding:original,onReset:{[weak self] in self?.shellStore?.suspend()})
   navigationProxy=proxy;webView.navigationDelegate=proxy
  }
  let plugin=RoadshowShellPlugin();plugin.store=shellStore
  bridge?.registerPluginInstance(plugin)
  bridge?.registerPluginInstance(RoadshowWidgetsPlugin())
  bridge?.registerPluginInstance(RoadshowOfflinePlugin())
 }
}
