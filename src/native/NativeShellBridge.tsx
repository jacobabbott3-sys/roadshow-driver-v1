import { useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { useLocation,useNavigate,useNavigationType } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { isNativeApp } from '../lib/nativePlatform';
import { useUnreadBadges } from '../hooks/useUnreadBadges';
import { actionRoute,parentRoute,parseAppearance,selectedTab,tabsForRole,validLayout,type ShellState } from './shellProtocol';
import { shellPlugin } from './shellPlugin';
import { ShellPresentationContext } from './useShellPresentation';

function bounded<T>(promise:Promise<T>):Promise<T>{return new Promise((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error('Native shell timeout')),3000);promise.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});}
export function NativeShellBridge({children}:{children:ReactNode}){
 const auth=useAuth();const native=isNativeApp();const location=useLocation();const navigate=useNavigate();const navigationType=useNavigationType();
 const allowed=!!auth.user && auth.profile?.id===auth.user.id && auth.profile.is_active && !auth.loading && (!native||auth.nativeProfileVerified);
 const publicRoute=/^\/(login|forgot-password|update-password|auth)(\/|$)/.test(location.pathname);
 const visible=allowed&&!publicRoute;
 const badges=useUnreadBadges(allowed?auth.user?.id:undefined);
 const [connection,setConnection]=useState<string|null>(null);const [ready,setReady]=useState(false);const [epoch,setEpoch]=useState(0);
 const [modals,setModals]=useState<Set<string>>(()=>new Set());
 const setModalOpen=useCallback((owner:string,open:boolean)=>setModals(previous=>{if(previous.has(owner)===open)return previous;const next=new Set(previous);if(open)next.add(owner);else next.delete(owner);return next;}),[]);
 const latest=useRef({visible,role:auth.profile?.role,path:location.pathname,modalOpen:modals.size>0});
 latest.current={visible,role:auth.profile?.role,path:location.pathname,modalOpen:modals.size>0};
 const navigateRef=useRef(navigate);navigateRef.current=navigate;
 const activeConnection=useRef<string|null>(null);const failRef=useRef<()=>void>(()=>{});const sequence=useRef(0);const queue=useRef(Promise.resolve());
 // Keep the router's real entry keys, including search/hash/state. Unknown POPs
 // reset our known range; native Back never invents a forward history entry.
 const history=useRef({entries:[location],index:0});
 useEffect(()=>{
  const h=history.current;
  if(h.entries[h.index]?.key===location.key)return;
  if(navigationType==='POP'){
   const index=h.entries.findIndex(entry=>entry.key===location.key);
   history.current=index<0?{entries:[location],index:0}:{...h,index};
  }else if(navigationType==='REPLACE'){
   h.entries[h.index]=location;
  }else{
   history.current={entries:[...h.entries.slice(0,h.index+1),location],index:h.index+1};
  }
 },[location,navigationType]);
 useEffect(()=>{
  if(!native)return;
  let alive=true;let suspended=false;let awaitingActive=false;const id=crypto.randomUUID();const handles:PluginListenerHandle[]=[];
  const fail=()=>{if(!alive)return;activeConnection.current=null;setConnection(null);setReady(false);delete document.documentElement.dataset.nativeShell;void shellPlugin.disconnect({connection:id}).catch(()=>{});};
  failRef.current=fail;
  const pause=()=>{suspended=true;awaitingActive=true;fail();};
  const active=()=>{pause();awaitingActive=false;};
  const refreshed=()=>{if(alive&&suspended&&!awaitingActive){suspended=false;setEpoch(n=>n+1);}};
  document.addEventListener('pause',pause);document.addEventListener('resume',pause);document.addEventListener('roadshow:native-active',active);document.addEventListener('roadshow:profile-refreshed',refreshed);
  const listen=async(name:string,fn:(value:unknown)=>void)=>{const handle=await shellPlugin.addListener(name,value=>{if(alive)fn(value);});if(alive)handles.push(handle);else void handle.remove();};
  void (async()=>{
   await bounded(Promise.all([
    listen('action',value=>{
     if(!value||typeof value!=='object')return;const event=value as {action?:unknown;connection?:unknown};const now=latest.current;
     if(activeConnection.current!==id||event.connection!==id||!now.visible||now.modalOpen)return;
     if(event.action==='back'){const h=history.current;const previous=h.entries[h.index-1];if(previous&&!/^\/(login|forgot-password|update-password|auth)(\/|$)/.test(previous.pathname))navigateRef.current(-1);else navigateRef.current(parentRoute(now.path),{replace:true});return;}
     const target=actionRoute(event.action);if(!target||target===now.path||(event.action==='admin'&&now.role!=='admin'))return;
     navigateRef.current(target);
    }),
    listen('readiness',value=>{if(value&&typeof value==='object'&&(value as {ready?:unknown}).ready===false)pause();}),
    listen('layout',value=>{if(activeConnection.current===id&&validLayout(value)){const style=document.documentElement.style;style.setProperty('--native-top',`${value.top}px`);style.setProperty('--native-bottom',`${value.bottom}px`);}}),
    listen('appearanceChanged',value=>{if(value&&typeof value==='object'){const appearance=parseAppearance((value as {appearance:unknown}).appearance);if(appearance)window.dispatchEvent(new CustomEvent('roadshow:native-appearance',{detail:appearance}));}}),
   ]));
   if(!alive||suspended)return;
   activeConnection.current=id;
   const response=await bounded(shellPlugin.connect({connection:id}));
   if(!alive||suspended){void shellPlugin.disconnect({connection:id}).catch(()=>{});return;}
   const appearance=parseAppearance(response.appearance);
   if(response.version!==1||response.connection!==id||!appearance)throw new Error('Invalid native shell');
   window.dispatchEvent(new CustomEvent('roadshow:native-appearance',{detail:appearance}));
   sequence.current=0;queue.current=Promise.resolve();setConnection(id);
  })().catch(fail);
  return ()=>{alive=false;activeConnection.current=null;handles.forEach(h=>void h.remove());document.removeEventListener('pause',pause);document.removeEventListener('resume',pause);document.removeEventListener('roadshow:native-active',active);document.removeEventListener('roadshow:profile-refreshed',refreshed);delete document.documentElement.dataset.nativeShell;void shellPlugin.disconnect({connection:id}).catch(()=>{});};
 },[native,epoch]);
 useEffect(()=>{
  if(!connection)return;
  const state:ShellState={version:1,connection,sequence:++sequence.current,visible:!!visible,tabs:tabsForRole(visible?auth.profile?.role||'driver':'driver'),selected:visible?selectedTab(location.pathname):null,canGoBack:visible&&location.pathname!=='/',unreadChats:visible?Math.min(99,badges.chats):0,unreadNotifications:visible?Math.min(99,badges.notifications):0,modalOpen:modals.size>0};
  const fail=failRef.current;
  queue.current=queue.current.then(async()=>{
   if(activeConnection.current!==connection||state.sequence!==sequence.current)return;
   await bounded(shellPlugin.setState({state}));
   if(activeConnection.current===connection){setReady(true);document.documentElement.dataset.nativeShell='ready';}
  }).catch(fail);
 },[connection,visible,auth.profile?.role,location.pathname,badges.chats,badges.notifications,modals]);
 const value=useMemo(()=>({ready,chats:badges.chats,notifications:badges.notifications,setModalOpen}),[ready,badges.chats,badges.notifications,setModalOpen]);
 return <ShellPresentationContext.Provider value={value}>{children}</ShellPresentationContext.Provider>;
}
