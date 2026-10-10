import UIKit
import SwiftUI
final class NativeShellContainer:UIViewController,UITabBarDelegate {
 let store=ShellStore()
 private let bridgeController=RoadshowBridgeViewController()
 private var top:UIHostingController<NativeShellView>!
 private let bottom=UITabBar()
 private var tabIDs:[String]=[]
 private var observers:[NSObjectProtocol]=[]
 private var previousLayout:CGSize = .zero
 override func viewDidLoad() {
  super.viewDidLoad();view.backgroundColor = .systemBackground
  bridgeController.shellStore=store
  addChild(bridgeController);view.addSubview(bridgeController.view);bridgeController.didMove(toParent:self)
  top=UIHostingController(rootView:NativeShellView(store:store))
  addChild(top);top.view.backgroundColor = .clear;view.addSubview(top.view);top.didMove(toParent:self)
  bottom.delegate=self;view.addSubview(bottom)
  // Keep UIKit's standard tab appearance and interaction: it owns the glass lens.
  store.layoutChanged = { [weak self] in self?.applyAppearance();self?.syncTabs();self?.view.setNeedsLayout() }
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
 private func syncTabs() {
  let ids=store.gate.state?.tabs ?? []
  if ids != tabIDs {
   tabIDs=ids
   let titles=["home":"Home","contracts":"Contracts","resources":"Resources","admin":"Admin","profile":"Profile"]
   let symbols=["home":"house","contracts":"briefcase","resources":"folder","admin":"checkmark.shield","profile":"person.crop.circle"]
   bottom.setItems(ids.enumerated().map { index,id in
    let symbol=symbols[id] ?? "circle"
    let item=UITabBarItem(title:titles[id],image:UIImage(systemName:symbol),selectedImage:UIImage(systemName:symbol+".fill"))
    item.tag=index;item.accessibilityLabel=titles[id];return item
   },animated:false)
  }
  if let selected=store.gate.state?.selected,let index=tabIDs.firstIndex(of:selected){bottom.selectedItem=bottom.items?[index]}
  else {bottom.selectedItem=nil}
 }
 func tabBar(_ tabBar:UITabBar,didSelect item:UITabBarItem) {
  guard tabIDs.indices.contains(item.tag) else{return}
  store.action(tabIDs[item.tag]);syncTabs()
 }
 override func viewDidLayoutSubviews() {
  super.viewDidLayoutSubviews();bridgeController.view.frame=view.bounds
  let safe=view.safeAreaInsets
  let width=max(0,view.bounds.width-safe.left-safe.right-24)
  let show=store.visible
  top.view.isHidden = !show;bottom.isHidden = !show || store.keyboardVisible
  let topHeight:CGFloat=show ? 52 : 0
  top.view.frame=CGRect(x:safe.left+12,y:safe.top+6,width:width,height:topHeight)
  let bottomHeight:CGFloat=show && !store.keyboardVisible ? max(49,bottom.sizeThatFits(view.bounds.size).height-safe.bottom)+safe.bottom : 0
  bottom.frame=CGRect(x:0,y:view.bounds.height-bottomHeight,width:view.bounds.width,height:bottomHeight)
  let occupied=CGSize(width:show ? safe.top+topHeight+14 : safe.top,height:bottomHeight>0 ? bottomHeight+12 : safe.bottom)
  if previousLayout != occupied || store.gate.state == nil {
   previousLayout=occupied;store.event?("layout",["top":occupied.width,"bottom":occupied.height])
  }
 }
 override func traitCollectionDidChange(_ previousTraitCollection:UITraitCollection?) {
  super.traitCollectionDidChange(previousTraitCollection)
  if traitCollection.hasDifferentColorAppearance(comparedTo:previousTraitCollection){applyAccent()}
 }
 private func applyAppearance() {
  overrideUserInterfaceStyle = store.appearance.mode == "dark" ? .dark : store.appearance.mode == "light" ? .light : .unspecified
  applyAccent()
 }
 private func applyAccent() {
  let rgb=ShellPalette.rgb(store.appearance.accent,dark:traitCollection.userInterfaceStyle == .dark)
  bottom.tintColor=UIColor(red:rgb.0,green:rgb.1,blue:rgb.2,alpha:1)
 }
 func activateShell() {
  guard bridgeController.webView?.isLoading == false else{return}
  bridgeController.bridge?.triggerDocumentJSEvent(eventName:"roadshow:native-active")
 }
 func suspendShell() {store.suspend()}
 deinit {observers.forEach(NotificationCenter.default.removeObserver)}
}
