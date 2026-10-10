import AppKit
import WebKit
@main struct ShellNavigationTests {
 @MainActor static func main() {
  _ = NSApplication.shared
  var resets=0
  final class Delegate:NSObject,WKNavigationDelegate {
   var starts=0;var terminations=0;var finishes=0
   func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!){starts+=1}
   func webViewWebContentProcessDidTerminate(_ webView:WKWebView){terminations+=1}
   func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){finishes+=1}
  }
  let original=Delegate();let proxy=ShellNavigationDelegate(forwarding:original,onReset:{resets+=1});let web=WKWebView()
  proxy.webView(web,didStartProvisionalNavigation:nil);assert(resets==1&&original.starts==1)
  proxy.webViewWebContentProcessDidTerminate(web);assert(resets==2&&original.terminations==1)
  let finish=NSSelectorFromString("webView:didFinishNavigation:")
  assert(proxy.responds(to:finish));assert((proxy.forwardingTarget(for:finish) as? Delegate) === original)
  print("ShellNavigation: reload/termination reset and delegate forwarding passed")
 }
}
