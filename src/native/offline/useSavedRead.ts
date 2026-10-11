import {useAsync} from '../../hooks/useAsync';
import {useAuth} from '../../context/AuthContext';
import {useOffline} from './context';
import type {OfflineSnapshot} from './model';
export function useSavedQuery<T>(load:()=>Promise<T>,deps:unknown[],select:(snapshot:OfflineSnapshot)=>T){
 const {coordinator,state}=useOffline(),auth=useAuth();
 const owner=auth.user?.id||'';
 // Broader authorized administrator reads stay memory-only. Saved reads remain owned-only.
 const administrator=!!coordinator&&auth.profile?.role==='admin'&&auth.profile.is_active&&auth.nativeProfileVerified&&!auth.loading;
 const online=useAsync(()=>!coordinator||administrator?load().then(data=>({owner,data})):Promise.resolve(null),[coordinator,administrator,owner,state?.revision,...deps]);
 const liveData=online.data?.owner===owner?online.data.data:null;
 if(!coordinator)return {...online,data:liveData,live:!online.loading&&!online.error};
 const savedData=state?.snapshot?select(state.snapshot):null;
 const data=administrator&&liveData!==null?liveData:savedData;
 const error=administrator?online.error:state?.contracts.error||'';
 return {data,loading:data===null&&!error&&(administrator?online.loading:!state?.snapshot),error:data!==null?'':error,live:administrator?liveData!==null&&!online.loading&&!online.error:!!state?.contracts.canMutate,refresh:async()=>{if(administrator)await online.refresh();await coordinator.refresh('mutation');}};
}
