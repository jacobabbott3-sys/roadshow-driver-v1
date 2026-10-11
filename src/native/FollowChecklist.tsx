import {useState} from 'react';
import {isNativeApp} from '../lib/nativePlatform';
import {useWidgets} from './useWidgets';
import {canFollow} from './widgetModel';
export function FollowChecklist({id,completed,total}:{id:string;completed:number;total:number}){
 const widgets=useWidgets();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const row=widgets.assignments.find(row=>row.id===id),following=widgets.following===id;
 if(!isNativeApp()||!row||(!following&&!canFollow(row,completed,total)))return null;
 async function action(){setBusy(true);setError('');try{if(following)await widgets.stop();else await widgets.follow(id);}catch(e){setError(e instanceof Error?e.message:'Unable to start Live Activity.');}finally{setBusy(false);}}
 return <section className="detail-panel"><strong>Follow this checklist</strong><p className="muted">Show the name and confirmed progress on your Lock Screen and Dynamic Island. Updates refresh while Roadshow is open.</p><button className="button secondary" disabled={busy||!widgets.ready||(!following&&!widgets.activityAvailable)} onClick={()=>void action()}>{busy?'Updating…':following?'Stop following':'Follow checklist'}</button>{!widgets.activityAvailable&&<p>Live Activities are unavailable or disabled in iPhone Settings.</p>}{(error||widgets.error)&&<p role="status">{error||widgets.error}</p>}</section>;
}
