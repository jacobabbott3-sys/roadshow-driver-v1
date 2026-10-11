import {useAuth} from "../../context/AuthContext";
import {useOffline} from './context';
export function FreshnessNotice(){
 const auth=useAuth();const {state,coordinator}=useOffline();if(!state?.snapshot)return null;
 const read=state.contracts;
 const label=read.refreshing?'Updating…':read.source==='live'?'Up to date':navigator.onLine===false?'Offline — saved copy':read.error?'Could not refresh':'Saved copy';
 return <div className="offline-freshness"><span role="status">{label}</span><small>Last updated {new Date(read.fetchedAt||state.snapshot.verifiedAt).toLocaleString()}{!read.canMutate?' · Read only':''}</small>{state.cacheError&&<small role="alert">{state.cacheError}</small>}<button type="button" disabled={read.refreshing} onClick={()=>{if(!auth.nativeProfileVerified)void auth.refreshProfile();else void coordinator?.refresh('manual');}}>Refresh</button></div>;
}
