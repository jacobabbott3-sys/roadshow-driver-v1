import {useOffline} from './context';
export function FreshnessNotice(){
 const {state,coordinator}=useOffline();if(!state?.snapshot)return null;
 const read=state.contracts;
 const label=read.refreshing?'Updating…':read.source==='live'?'Up to date':navigator.onLine===false?'Offline — saved copy':read.error?'Could not refresh':'Saved copy';
 return <div className="offline-freshness"><span role="status">{label}</span><small>Last updated {new Date(read.fetchedAt||state.snapshot.verifiedAt).toLocaleString()}{!read.canMutate?' · Read only':''}</small><button type="button" disabled={read.refreshing} onClick={()=>void coordinator?.refresh('manual')}>Refresh</button></div>;
}
