import {useEffect,useMemo,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {isNativeApp} from '../../lib/nativePlatform';
import {OfflineCoordinator} from './coordinator';
import {OfflineContext} from './context';
import {offlinePlugin} from './plugin';
import {loadOwnedSnapshot,downloadServices} from './data';
export function OfflineBridge({children}:{children:ReactNode}){
 const auth=useAuth(),location=useLocation(),native=isNativeApp();
 const coordinator=useMemo(()=>new OfflineCoordinator(offlinePlugin,loadOwnedSnapshot,()=>Date.now(),downloadServices),[]);
 const owner=auth.user?.id||auth.savedSessionOwner||undefined;
 useEffect(()=>{
  if(!native||(!auth.sessionResolved&&!owner))return;
  let alive=true;
  if(!owner||auth.profile?.is_active===false){void coordinator.deactivate(!owner?'session-removed':'inactive');return;}
  void coordinator.activate(owner).then(()=>{
   if(!alive)return;
   if(auth.nativeProfileVerified&&!auth.loading&&auth.profile?.is_active){coordinator.verify(owner,Date.now());void coordinator.refresh('launch');
    if(auth.session?.access_token&&auth.session.expires_at)void coordinator.mirrorAccess(auth.session.access_token,auth.session.expires_at*1000,import.meta.env.VITE_SUPABASE_ANON_KEY||'').catch(()=>{});}
   else coordinator.suspend();
  });
  return ()=>{alive=false;coordinator.suspend();};
 },[native,coordinator,owner,auth.sessionResolved,auth.nativeProfileVerified,auth.loading,auth.profile?.is_active,auth.session?.access_token,auth.session?.expires_at]);
 useEffect(()=>{
  if(!native||!owner||auth.profile?.is_active===false)return;
  // A bridge call made before the scene becomes active can fail. Retry the
  // private saved read immediately, independently of network verification.
  const active=()=>void coordinator.activate(owner);
  document.addEventListener('roadshow:native-active',active);
  return ()=>document.removeEventListener('roadshow:native-active',active);
 },[native,coordinator,owner,auth.profile?.is_active]);
 useEffect(()=>{if(native)void coordinator.refresh('route');},[native,coordinator,location.pathname]);
 useEffect(()=>{
  if(!native)return;
  const refresh=()=>void coordinator.refresh('mutation');const periodic=()=>void coordinator.refresh('periodic');
  const timer=window.setInterval(periodic,300000);
  document.addEventListener('roadshow:checklist-saved',refresh);document.addEventListener('roadshow:contract-saved',refresh);
  return ()=>{clearInterval(timer);document.removeEventListener('roadshow:checklist-saved',refresh);document.removeEventListener('roadshow:contract-saved',refresh);};
 },[native,coordinator]);
 return <OfflineContext.Provider value={native?coordinator:null}>{children}</OfflineContext.Provider>;
}
