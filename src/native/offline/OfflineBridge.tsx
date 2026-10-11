import {useEffect,useMemo,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {isNativeApp} from '../../lib/nativePlatform';
import {OfflineCoordinator} from './coordinator';
import {OfflineContext} from './context';
import {offlinePlugin} from './plugin';
import {loadOwnedSnapshot} from './data';
export function OfflineBridge({children}:{children:ReactNode}){
 const auth=useAuth(),location=useLocation(),native=isNativeApp();
 const coordinator=useMemo(()=>new OfflineCoordinator(offlinePlugin,loadOwnedSnapshot),[]);
 const owner=auth.user?.id;
 useEffect(()=>{
  if(!native||!auth.sessionResolved)return;
  let alive=true;
  if(!owner||auth.profile?.is_active===false){void coordinator.deactivate(!owner?'session-removed':'inactive');return;}
  void coordinator.activate(owner).then(()=>{
   if(!alive)return;
   if(auth.nativeProfileVerified&&!auth.loading&&auth.profile?.is_active){coordinator.verify(owner,Date.now());void coordinator.refresh('launch');}
   else coordinator.suspend();
  });
  return ()=>{alive=false;coordinator.suspend();};
 },[native,coordinator,owner,auth.sessionResolved,auth.nativeProfileVerified,auth.loading,auth.profile?.is_active]);
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
