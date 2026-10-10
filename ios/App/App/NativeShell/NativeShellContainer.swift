import UIKit
import SwiftUI
import Combine
final class NativeShellContainer:UIViewController {
 let store=ShellStore()
 private let bridgeController=RoadshowBridgeViewController()
 private var top:UIHostingController<NativeShellView>!
 private var bottom:UIHostingController<NativeShellView>!
 private var observers:[NSObjectProtocol]=[]
 private var previousLayout:CGSize = .zero
 override func viewDidLoad() {
  super.viewDidLoad();view.backgroundColor = .systemBackground
  bridgeController.shellStore=store
  addChild(bridgeController);view.addSubview(bridgeController.view);bridgeController.didMove(toParent:self)
  top=UIHostingController(rootView:NativeShellView(store:store,position:"top"))
  bottom=UIHostingController(rootView:NativeShellView(store:store,position:"bottom"))
  for controller in [top!,bottom!] {
   addChild(controller);controller.view.backgroundColor = .clear;view.addSubview(controller.view);controller.didMove(toParent:self)
  }
  store.layoutChanged = { [weak self] in self?.applyAppearance();self?.view.setNeedsLayout() }
  observers.append(NotificationCenter.default.addObserver(forName:UIResponder.keyboardWillChangeFrameNotification,object:nil,queue:.main){[weak self] note in
   guard let frame=note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else{return}
   Task { @MainActor [weak self] in
    guard let self else{return}
    let local=self.view.convert(frame,from:nil)
    self.store.keyboardVisible=local.minY < self.view.bounds.maxY-40;self.view.setNeedsLayout()
   }
  })
  observers.append(NotificationCenter.default.addObserver(forName:UIContentSizeCategory.didChangeNotification,object:nil,queue:.main){[weak self] _ in self?.view.setNeedsLayout()})
  applyAppearance()
 }
 override func viewDidLayoutSubviews() {
  super.viewDidLayoutSubviews()
  bridgeController.view.frame=view.bounds
  let safe=view.safeAreaInsets
  let width=max(0,view.bounds.width-safe.left-safe.right-24)
  let show=store.visible
  top.view.isHidden = !show;bottom.view.isHidden = !show || store.keyboardVisible
  func height(_ host:UIHostingController<NativeShellView>)->CGFloat {
   if #available(iOS 16.0,*) {return host.sizeThatFits(in:CGSize(width:width,height:400)).height}
   return host.view.systemLayoutSizeFitting(CGSize(width:width,height:UIView.layoutFittingCompressedSize.height),withHorizontalFittingPriority:.required,verticalFittingPriority:.fittingSizeLevel).height
  }
  let topHeight=show ? max(56,height(top)) : 0
  let bottomHeight=show && !store.keyboardVisible ? max(70,height(bottom)) : 0
  top.view.frame=CGRect(x:safe.left+12,y:safe.top+6,width:width,height:topHeight)
  bottom.view.frame=CGRect(x:safe.left+12,y:view.bounds.height-safe.bottom-bottomHeight-8,width:width,height:bottomHeight)
  let occupied=CGSize(width:show ? safe.top+topHeight+18 : safe.top,height:bottomHeight>0 ? safe.bottom+bottomHeight+20 : safe.bottom)
  // Send every layout while connected: a reconnect needs current geometry even if dimensions stayed identical.
  if previousLayout != occupied || store.gate.state == nil {
   previousLayout=occupied
   store.event?("layout",["top":occupied.width,"bottom":occupied.height])
  }
 }
 private func applyAppearance() {
  overrideUserInterfaceStyle = store.appearance.mode == "dark" ? .dark : store.appearance.mode == "light" ? .light : .unspecified
 }
 func activateShell() {
  guard bridgeController.webView?.isLoading == false else{return}
  bridgeController.bridge?.triggerDocumentJSEvent(eventName:"roadshow:native-active")
 }
 func suspendShell() {store.suspend()}
 deinit {observers.forEach(NotificationCenter.default.removeObserver)}
}
