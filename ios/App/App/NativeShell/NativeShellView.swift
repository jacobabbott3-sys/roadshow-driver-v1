import SwiftUI
private let roadshowGreen=Color(red:0.12,green:0.48,blue:0.32)
struct NativeShellView:View {
 @ObservedObject var store:ShellStore
 let position:String
 @Environment(\.accessibilityReduceTransparency) private var opaque
 @Environment(\.accessibilityReduceMotion) private var reduceMotion
 var body:some View {
  Group {
   if position == "top" {topBar} else {tabBar}
  }
  .tint(roadshowGreen)
  .padding(6)
  .modifier(ShellGlass(opaque:opaque))
  .animation(reduceMotion ? nil : .easeInOut(duration:0.18),value:store.gate.state?.selected)
  .sheet(item:Binding(get:{position == "top" ? store.sheet.map {SheetChoice(id:$0)} : nil},set:{store.sheet=$0?.id})) { choice in
   sheetContent(choice.id)
  }
 }
 private var topBar:some View {
  HStack(spacing:8) {
   if store.gate.state?.canGoBack == true {iconButton("Back","chevron.left","back",0)}
   Text("Roadshow").font(.headline).lineLimit(1).minimumScaleFactor(0.8)
   Spacer(minLength:4)
   iconButton("Notifications","bell","notifications",store.gate.state?.unreadNotifications ?? 0)
   iconButton("Chat","bubble.left.and.bubble.right","chat",store.gate.state?.unreadChats ?? 0)
   Button {store.sheet="quick"} label:{Image(systemName:"ellipsis").frame(minWidth:44,minHeight:44)}.accessibilityLabel("More options")
  }.padding(.horizontal,8)
 }
 private var tabBar:some View {
  HStack(alignment:.center,spacing:2) {
   ForEach(store.gate.state?.tabs ?? [],id:\.self) { tab in
    let selected=store.gate.state?.selected == tab
    Button {store.action(tab)} label:{
     VStack(spacing:4) {
      Image(systemName:symbol(tab)).font(.system(size:21,weight:selected ? .semibold : .regular))
      Text(title(tab)).font(.caption2).fontWeight(selected ? .semibold : .medium).lineLimit(2).multilineTextAlignment(.center)
     }.frame(maxWidth:.infinity,minHeight:48).padding(.vertical,5)
      .foregroundStyle(selected ? roadshowGreen : Color.primary)
      .background(selected ? roadshowGreen.opacity(0.12) : Color.clear,in:RoundedRectangle(cornerRadius:24))
    }.buttonStyle(.plain).accessibilityLabel(title(tab)).accessibilityAddTraits(selected ? .isSelected : [])
   }
  }
 }
 private func iconButton(_ name:String,_ symbol:String,_ action:String,_ count:Int)->some View {
  Button {store.action(action)} label:{
   Image(systemName:symbol).font(.body).frame(minWidth:44,minHeight:44)
    .overlay(alignment:.topTrailing){if count>0 {Text(count>=99 ? "99+" : "\(count)").font(.caption2.bold()).foregroundStyle(.white).padding(3).background(.red,in:Capsule()).accessibilityHidden(true)}}
  }.accessibilityLabel(count>0 ? "\(name), \(count) unread" : name)
 }
 @ViewBuilder private func sheetContent(_ id:String)->some View {
  if #available(iOS 16.0,*) {
   sheetBody(id).presentationDetents([.medium,.large]).presentationDragIndicator(.visible)
  } else {sheetBody(id)}
 }
 private func sheetBody(_ id:String)->some View {
  NavigationView {
   Form {
    if id == "quick" {
     Section("Quick access") {
      shortcut("Availability","calendar","availability")
      shortcut("Red Folder","folder.fill","redFolder")
      shortcut("My Toolbag","wrench.and.screwdriver","toolbag")
     }
     Section {Button {store.sheet="appearance"} label:{Label("Appearance",systemImage: "circle.lefthalf.filled")}}
    } else {
     Section("This iPhone") {
      Picker("Appearance",selection:Binding(get:{store.appearance.mode},set:{store.updateAppearance(ShellAppearance(mode:$0,haptics:store.appearance.haptics))})) {
       Text("System").tag("system");Text("Light").tag("light");Text("Dark").tag("dark")
      }.pickerStyle(.segmented)
      Toggle("Haptics",isOn:Binding(get:{store.appearance.haptics},set:{store.updateAppearance(ShellAppearance(mode:store.appearance.mode,haptics:$0))}))
     }
     Section {Text("These settings apply only to this iPhone. Your website appearance stays unchanged.").font(.footnote).foregroundStyle(.secondary)}
    }
   }.navigationTitle(id == "quick" ? "Quick access" : "Appearance")
    .toolbar {ToolbarItem(placement:.confirmationAction){Button("Done"){store.sheet=nil}}}
  }.navigationViewStyle(.stack).tint(roadshowGreen)
 }
 private func shortcut(_ name:String,_ icon:String,_ action:String)->some View {Button{store.action(action)}label:{Label(name,systemImage:icon)}}
 private func title(_ tab:String)->String { ["home":"Home","contracts":"Contracts","resources":"Resources","admin":"Admin","profile":"Profile"][tab] ?? tab }
 private func symbol(_ tab:String)->String {["home":"house","contracts":"briefcase","resources":"folder","admin":"checkmark.shield","profile":"person.crop.circle"][tab] ?? "circle"}
}
private struct SheetChoice:Identifiable {let id:String}
private struct ShellGlass:ViewModifier {
 let opaque:Bool
 @ViewBuilder func body(content:Content)->some View {
  if opaque {content.background(Color(uiColor:.secondarySystemBackground),in:RoundedRectangle(cornerRadius:30))}
  else if #available(iOS 26.0,*) {content.glassEffect(.regular,in:.rect(cornerRadius:30))}
  else {content.background(.regularMaterial,in:RoundedRectangle(cornerRadius:30))}
 }
}
