import Foundation
import WebKit
/// Observe document destruction while preserving Capacitor's complete delegate behavior.
final class ShellNavigationDelegate:NSObject,WKNavigationDelegate {
 private weak var original:WKNavigationDelegate?
 private let onReset:()->Void
 init(forwarding original:WKNavigationDelegate,onReset:@escaping ()->Void){self.original=original;self.onReset=onReset;super.init()}
 func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!){
  onReset();original?.webView?(webView,didStartProvisionalNavigation:navigation)
 }
 func webViewWebContentProcessDidTerminate(_ webView:WKWebView){
  onReset();original?.webViewWebContentProcessDidTerminate?(webView)
 }
 override func responds(to selector:Selector!)->Bool {super.responds(to:selector)||(original?.responds(to:selector) ?? false)}
 override func forwardingTarget(for selector:Selector!)->Any? {
  if original?.responds(to:selector) == true{return original}
  return super.forwardingTarget(for:selector)
 }
}
