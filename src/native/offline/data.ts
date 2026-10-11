import {supabase} from '../../lib/supabase';
import {getChecklist,getContract,getShowLinks,getResources,type Contract} from '../../lib/driverData';
import {getWidgetAssignments} from '../widgetData';
import type {OfflineSnapshot,SavedContract} from './model';
const contractKeys=['id','kind','service_date','service_time','status','contract_pay','bonus_pay','document_path','terms','signed_at','signature_name','admin_signed_at','admin_signature_name','admin_note','show'] as const;
const showKeys=['id','name','starts_on','ends_on','city','state','address','bin_count','meals_included','lodging_included','details_unlock_at','event_type','artist','venue_name','signing_at','setup_at','per_diem','lodging_name','lodging_address','lodging_phone','lodging_confirmation','lodging_check_in','lodging_check_out','lodging_notes','is_test','test_owner'] as const;
function project(contract:Contract):Contract{return {...Object.fromEntries(contractKeys.map(key=>[key,contract[key]])),show:Object.fromEntries(showKeys.map(key=>[key,contract.show[key]??null]))} as Contract;}
async function loadContract(id:string):Promise<SavedContract>{const [contract,checklist]=await Promise.all([getContract(id),getChecklist(id)]);return {contract:project(contract),checklist:{id:checklist.id,sections:checklist.sections.map(s=>({id:s.id,title:s.title,position:s.position,items:s.items.map(i=>({id:i.id,title:i.title,instructions:i.instructions,required:i.required,photo_required:i.photo_required,position:i.position,response:i.response?{id:i.response.id,completed:i.response.completed,note:i.response.note,review_status:i.response.review_status,review_note:i.response.review_note,reviewed_at:i.response.reviewed_at,reviewer:i.response.reviewer?{full_name:i.response.reviewer.full_name}:null}:null}))}))},fetchedAt:Date.now()};}
export async function loadOwnedSnapshot(owner:string):Promise<OfflineSnapshot>{
 const [owned,links]=await Promise.all([getWidgetAssignments(owner),getShowLinks()]);
 const contracts:Record<string,SavedContract>={};
 // Bound concurrent requests; incomplete results never replace the prior snapshot.
 for(let offset=0;offset<owned.length;offset+=4){for(const saved of await Promise.all(owned.slice(offset,offset+4).map(c=>loadContract(c.id))))contracts[saved.contract.id]=saved;}
 const shows=new Set(Object.values(contracts).map(c=>c.contract.show.id));const now=Date.now();
 return {version:1,owner,verifiedAt:now,lastSeenAt:now,contracts,links:links.filter(l=>shows.has(l.show_id)&&shows.has(l.linked_show_id)),resources:{}};
}
export async function loadOwnedContract(owner:string,id:string):Promise<SavedContract|null>{const owned=await getWidgetAssignments(owner);return owned.some(c=>c.id===id)?loadContract(id):null;}

export const downloadServices={resources:getResources,download:async(ref:import('./model').FileRef)=>{
 let bucket:string,path:string|null=null;
 if(ref.kind==='resource'){
  const {data,error}=await supabase.from('resources').select('id,file_path,kind').eq('id',ref.recordId).eq('published',true).single();
  if(error||data?.kind!=='handbook')throw Error('This resource is no longer available.');bucket='resources';path=data.file_path;
 }else if(ref.kind==='contract-document'){
  const data=await getContract(ref.contractId!);bucket='contract-files';path=data.document_path;
 }else{
  const {data,error}=await supabase.from('photos').select('storage_path').eq('id',ref.recordId).eq('contract_id',ref.contractId!).single();
  if(error)throw Error('This photo is no longer available.');bucket='roadshow-photos';path=data.storage_path;
 }
 if(!path)throw Error('No attachment is available.');
 const {data,error}=await supabase.storage.from(bucket).download(path);
 if(error||!data)throw Error('Could not download. Check your connection and try again.');
 if(data.size>20*1024*1024)throw Error('This file exceeds the 20 MiB download limit.');
 const bytes=new Uint8Array(await data.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {mime:data.type.split(';')[0],base64:btoa(binary)};
}};
