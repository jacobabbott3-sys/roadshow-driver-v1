import SwiftUI
struct NativeShellView:View {
 @ObservedObject var store:ShellStore
 @Environment(\.colorScheme) private var colorScheme
 private var accent:Color {
  let rgb=ShellPalette.rgb(store.appearance.accent,dark:colorScheme == .dark)
  return Color(red:rgb.0,green:rgb.1,blue:rgb.2)
 }
 var body:some View {
  HStack {
   if store.gate.state?.canGoBack == true {
    Button {store.action("back")} label:{Image(systemName:"chevron.left").frame(width:44,height:44)}
     .accessibilityLabel("Back").modifier(SystemGlassButton())
   }
   Spacer()
   Menu {
    Section {
     Button {store.action("notifications")} label:{Label(badgeLabel("Notifications",store.gate.state?.unreadNotifications ?? 0),systemImage:"bell")}
     Button {store.action("chat")} label:{Label(badgeLabel("Chat",store.gate.state?.unreadChats ?? 0),systemImage:"bubble.left.and.bubble.right")}
    }
    Section("Quick access") {
     Button {store.action("availability")} label:{Label("Availability",systemImage:"calendar")}
     Button {store.action("redFolder")} label:{Label("Red Folder",systemImage:"folder")}
     Button {store.action("toolbag")} label:{Label("My Toolbag",systemImage:"wrench.and.screwdriver")}
    }
    Button {store.sheet="appearance"} label:{Label("Appearance",systemImage:"circle.lefthalf.filled")}
   } label:{
    Image(systemName:"ellipsis").frame(width:44,height:44)
     .overlay(alignment:.topTrailing){if unread>0 {Circle().fill(.red).frame(width:9,height:9).accessibilityHidden(true)}}
   }.accessibilityLabel(unread>0 ? "More, \(unread) unread updates" : "More")
    .modifier(SystemGlassButton())
  }.tint(accent)
   .sheet(isPresented:Binding(get:{store.sheet != nil},set:{if !$0 {store.sheet=nil}})) {appearanceSheet}
 }
 private var unread:Int {(store.gate.state?.unreadChats ?? 0)+(store.gate.state?.unreadNotifications ?? 0)}
 private func badgeLabel(_ name:String,_ count:Int)->String {count>0 ? "\(name) · \(count >= 99 ? "99+" : String(count)) unread" : name}
 @ViewBuilder private var appearanceSheet:some View {
  if #available(iOS 16.0,*) {appearanceForm.presentationDetents([.medium,.large]).presentationDragIndicator(.visible)}
  else {appearanceForm}
 }
 private var appearanceForm:some View {
  NavigationView {
   Form {
    Section("This iPhone") {
     Picker("Appearance",selection:Binding(get:{store.appearance.mode},set:{store.updateAppearance(ShellAppearance(mode:$0,haptics:store.appearance.haptics,color:store.appearance.accent))})) {
      Text("System").tag("system");Text("Light").tag("light");Text("Dark").tag("dark")
     }.pickerStyle(.segmented)
     Picker("Color",selection:Binding(get:{store.appearance.accent},set:{store.updateAppearance(ShellAppearance(mode:store.appearance.mode,haptics:store.appearance.haptics,color:$0))})) {
      Text("Forest").tag("forest");Text("Road blue").tag("blue");Text("Stage purple").tag("purple");Text("Warm rust").tag("rust")
     }
     Toggle("Haptics",isOn:Binding(get:{store.appearance.haptics},set:{store.updateAppearance(ShellAppearance(mode:store.appearance.mode,haptics:$0,color:store.appearance.accent))}))
    }
    Section {Text("These settings apply only to this iPhone.").font(.footnote).foregroundStyle(.secondary)}
   }.navigationTitle("Appearance")
    .toolbar {ToolbarItem(placement:.confirmationAction){Button("Done"){store.sheet=nil}}}
  }.navigationViewStyle(.stack).tint(accent)
 }
}
private struct SystemGlassButton:ViewModifier {
 @Environment(\.accessibilityReduceTransparency) private var opaque
 @ViewBuilder func body(content:Content)->some View {
  if #available(iOS 26.0,*),!opaque {content.buttonStyle(.glass).buttonBorderShape(.circle)}
  else {content.buttonStyle(.bordered).buttonBorderShape(.capsule).background(Color(uiColor:.secondarySystemBackground),in:Circle())}
 }
}
