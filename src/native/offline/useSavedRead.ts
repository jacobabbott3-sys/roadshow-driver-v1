import {useAsync} from '../../hooks/useAsync';
import {useOffline} from './context';
import type {OfflineSnapshot} from './model';
// Native routes subscribe to one read model. Web routes keep their original service.
export function useSavedQuery<T>(load:()=>Promise<T>,deps:unknown[],select:(snapshot:OfflineSnapshot)=>T){
 const {coordinator,state}=useOffline();
 const online=useAsync<T|null>(()=>coordinator?Promise.resolve(null):load(),[coordinator,...deps]);
 if(!coordinator)return online;
 return {data:state?.snapshot?select(state.snapshot):null,loading:!state?.snapshot,error:state?.snapshot?'':state?.contracts.error||'',refresh:()=>coordinator.refresh('mutation')};
}
