export type NativeTab = 'home'|'contracts'|'resources'|'admin'|'profile';
export type ShellAction = NativeTab|'chat'|'notifications'|'availability'|'redFolder'|'toolbag'|'back';
export type ShellAppearance = {mode:'system'|'light'|'dark'; haptics:boolean; color:'forest'|'blue'|'purple'|'rust'};
export type ShellState = {version:1; connection:string; sequence:number; visible:boolean; tabs:NativeTab[]; selected:NativeTab|null; canGoBack:boolean; unreadChats:number; unreadNotifications:number; modalOpen:boolean};
const routes: Record<Exclude<ShellAction,'back'>,string> = {home:'/',contracts:'/contracts',resources:'/resources',admin:'/admin',profile:'/profile',chat:'/chat',notifications:'/notifications',availability:'/availability',redFolder:'/resources/red-folder',toolbag:'/resources/toolbag'};
export function actionRoute(action: unknown): string|null {return typeof action==='string' && Object.hasOwn(routes,action) ? routes[action as keyof typeof routes] : null;}
export function tabsForRole(role: string): NativeTab[] {return role==='admin' ? ['home','contracts','resources','admin','profile'] : ['home','contracts','resources','profile'];}
export function selectedTab(path: string): NativeTab|null {
 if(path==='/') return 'home';
 if(/^\/(contracts|signing-groups)(\/|$)/.test(path)) return 'contracts';
 for(const tab of ['resources','admin','profile'] as const) if(path===`/${tab}`||path.startsWith(`/${tab}/`)) return tab;
 return null;
}
export function parentRoute(path: string): string {const tab=selectedTab(path);return tab && path!==routes[tab] ? routes[tab] : '/';}
export function parseAppearance(value: unknown): ShellAppearance|null {
 if(!value||typeof value!=='object') return null;
 const v=value as Record<string,unknown>;
 const color=v.color??'forest';
 return ['system','light','dark'].includes(String(v.mode)) && typeof v.haptics==='boolean' && ['forest','blue','purple','rust'].includes(String(color)) ? {mode:v.mode as ShellAppearance['mode'],haptics:v.haptics,color:color as ShellAppearance['color']} : null;
}
export function parseShellState(value: unknown): ShellState|null {
 if(!value||typeof value!=='object')return null;
 const v=value as ShellState;
 if(v.version!==1 || typeof v.connection!=='string' || !v.connection || v.connection.length>100 || !Number.isSafeInteger(v.sequence)||v.sequence<0) return null;
 if(typeof v.visible!=='boolean'||typeof v.canGoBack!=='boolean'||typeof v.modalOpen!=='boolean')return null;
 if(!Array.isArray(v.tabs)||![tabsForRole('driver'),tabsForRole('admin')].some(t=>JSON.stringify(t)===JSON.stringify(v.tabs)))return null;
 if(v.selected!==null&&!v.tabs.includes(v.selected))return null;
 if(![v.unreadChats,v.unreadNotifications].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
 return {...v,unreadChats:Math.min(99,v.unreadChats),unreadNotifications:Math.min(99,v.unreadNotifications)};
}
export function validLayout(value: unknown): value is {top:number;bottom:number} {
 if(!value||typeof value!=='object') return false;
 const v=value as {top:number;bottom:number};
 return [v.top,v.bottom].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=600);
}
