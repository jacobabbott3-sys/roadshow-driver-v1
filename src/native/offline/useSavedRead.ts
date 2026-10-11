import {useAsync} from '../../hooks/useAsync';
import {useAuth} from '../../context/AuthContext';
import {useOffline} from './context';
import type {OfflineSnapshot} from './model';
export function useSavedQuery<T>(load:()=>Promise<T>,deps:unknown[],select:(snapshot:OfflineSnapshot)=>T,queryKey?:string){
 const {coordinator,state}=useOffline(),auth=useAuth();
 const owner=auth.user?.id||'';
 // Broader authorized administrator reads stay memory-only. Saved reads remain owned-only.
 const administrator=!!coordinator&&state?.owner===owner&&auth.profile?.role==='admin'&&auth.profile.is_active&&auth.nativeProfileVerified&&!auth.loading;
 const generation=state?.generation;
 const key=JSON.stringify([queryKey,...deps]);
 const online=useAsync(()=>!coordinator||administrator?load().then(data=>{
  if(queryKey&&generation)coordinator?.remember(generation,key,data);
  return {owner,key,generation,data};
 }):Promise.resolve(null),[coordinator,administrator,owner,generation,key,state?.revision,...deps]);
 const liveData=online.data?.owner===owner&&online.data.key===key&&online.data.generation===generation?online.data.data:null;
 const remembered=administrator&&queryKey?coordinator?.readMemory<T>(key)??null:null;
 if(!coordinator)return {...online,data:liveData,live:!online.loading&&!online.error};
 const savedData=state?.snapshot?select(state.snapshot):null;
 const data=administrator?(liveData??remembered??savedData):savedData;
 const error=administrator?online.error:state?.contracts.error||'';
 return {data,loading:data===null&&!error&&(administrator?online.loading:!state?.snapshot),error:data!==null?'':error,live:administrator?liveData!==null&&!online.loading&&!online.error:!!state?.contracts.canMutate,refresh:async()=>{if(administrator)await online.refresh();await coordinator.refresh('mutation');}};
}
