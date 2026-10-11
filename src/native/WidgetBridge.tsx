import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {isNativeApp} from '../lib/nativePlatform';
import {getChecklist} from '../lib/driverData';
import {useShellPresentation} from './useShellPresentation';
import {WidgetsContext} from './useWidgets';
import {WidgetController,type WidgetViewState} from './widgetController';
import {getWidgetAssignments} from './widgetData';
import {checklistProgress,widgetRoute} from './widgetModel';
import {widgetPlugin} from './widgetPlugin';
export function WidgetBridge({children}:{children:ReactNode}){
 const auth=useAuth(),shell=useShellPresentation(),navigate=useNavigate(),native=isNativeApp();
 const [state,setState]=useState<WidgetViewState>({ready:false,assignments:[],following:'',activityAvailable:false,widgetAvailable:false,error:''});
 const controller=useMemo(()=>new WidgetController(widgetPlugin,getWidgetAssignments,async id=>{const result=await getChecklist(id);return checklistProgress(result.sections.flatMap(section=>section.items));},setState),[]);
 const owner=auth.user?.id;
 const verified=!!owner&&auth.profile?.id===owner&&auth.profile.is_active&&auth.nativeProfileVerified&&!auth.loading;
 useEffect(()=>{
  if(!native)return;
  if(verified&&shell.ready&&owner){void controller.connect(owner);}
  else {controller.deactivate(!auth.loading&&!verified);}
  return ()=>controller.deactivate(false);
 },[controller,native,owner,verified,shell.ready,auth.loading]);
 useEffect(()=>{
  if(!native||!state.ready)return;
  const refresh=()=>{void controller.refresh();};
  const timer=window.setInterval(refresh,30000);document.addEventListener('roadshow:checklist-saved',refresh);
  let alive=true;let remove:(()=>void)|undefined;
  const link=()=>{void controller.link().then(raw=>{const route=widgetRoute(raw);if(alive&&route)navigate(route);}).catch(()=>{});};
  void widgetPlugin.addListener('link',link).then(handle=>{if(alive)remove=()=>void handle.remove();else void handle.remove();}).catch(()=>{});link();
  return ()=>{alive=false;remove?.();clearInterval(timer);document.removeEventListener('roadshow:checklist-saved',refresh);};
 },[controller,native,state.ready,navigate]);
 const value=useMemo(()=>({...state,follow:(id:string)=>controller.follow(id),stop:()=>controller.stop()}),[state,controller]);
 return <WidgetsContext.Provider value={value}>{children}</WidgetsContext.Provider>;
}
