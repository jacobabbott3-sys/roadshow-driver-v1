import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {useOffline} from './context';
import {fileKey,type FileRef} from './model';
import type {Resource} from '../../lib/driverData';
import {ImageViewer} from '../../components/ImageViewer';
const PdfViewer=lazy(()=>import('../../components/PdfViewer').then(m=>({default:m.PdfViewer})));
export function DownloadControl({file,title,resource}:{file:FileRef;title:string;resource?:Resource}){
 const {coordinator,state}=useOffline();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[opened,setOpened]=useState<{bytes:Uint8Array;mime:string}|null>(null),[image,setImage]=useState('');
 const close=useCallback(()=>setOpened(null),[]);
 const saved=state?.files.find(f=>fileKey(f.ref)===fileKey(file));const selected=file.kind==='resource'&&!!state?.snapshot?.resources[file.recordId];
 useEffect(()=>{if(!opened||opened.mime==='application/pdf'){setImage('');return;}const url=URL.createObjectURL(new Blob([new Uint8Array(opened.bytes)],{type:opened.mime}));setImage(url);return()=>URL.revokeObjectURL(url);},[opened]);
 useEffect(()=>{setOpened(null);},[state?.generation]);
 if(!coordinator||!state)return null;
 async function action(remove:boolean){setBusy(true);setError('');try{if(remove){await coordinator!.remove(file);setOpened(null);}else await coordinator!.download(file,resource);}catch(e){setError(e instanceof Error?e.message:'Could not save this download.');}finally{setBusy(false);}}
 async function open(){setError('');try{const data=await coordinator!.readFile(file);setOpened({bytes:Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0)),mime:data.mime});}catch(e){setError(e instanceof Error?e.message:'Could not open download.');}}
 return <div className="offline-download"><button type="button" disabled={busy||(!state.contracts.canMutate&&!selected&&!saved)} onClick={()=>void action(!!(saved||selected))}>{busy?'Saving…':saved||selected?'Remove download':'Download for offline'}</button>{saved&&<><small>Saved {new Date(saved.fetchedAt).toLocaleString()}</small><button type="button" onClick={()=>void open()}>Open saved copy</button></>}{selected&&!saved&&resource?.file_path&&<button type="button" disabled={busy||!state.contracts.canMutate} onClick={()=>void action(false)}>Retry download</button>}{busy&&<progress aria-label={`Downloading ${title}`}/>} {error&&<p role="alert">{error}</p>}{opened?.mime==='application/pdf'&&<Suspense fallback={<p>Opening PDF…</p>}><PdfViewer title={title} local={{bytes:opened.bytes}} onClose={close}/></Suspense>}{image&&<ImageViewer src={image} alt={title}/>}</div>;
}
