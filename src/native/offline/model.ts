import type {ChecklistSection,Contract,Resource,ShowLink} from '../../lib/driverData';
export const LEASE_MS=7*86400000;
export const LIMIT_BYTES=250*1024*1024;
export const FILE_LIMIT_BYTES=20*1024*1024;
export type SavedChecklist={id:string|null;sections:ChecklistSection[]};
export type SavedContract={contract:Contract;checklist:SavedChecklist;fetchedAt:number};
export type FileRef={kind:'resource'|'contract-document'|'contract-photo';recordId:string;contractId?:string};
export type SavedResource={resource:Resource;fetchedAt:number};
export type SavedFile={ref:FileRef;mime:string;bytes:number;fetchedAt:number;validator:string|null};
export type OfflineSnapshot={version:1;owner:string;verifiedAt:number;lastSeenAt:number;contracts:Record<string,SavedContract>;links:ShowLink[];resources:Record<string,SavedResource>};
export type ReadState<T>={data:T|null;source:'saved'|'live'|'none';refreshing:boolean;fetchedAt:number|null;error:string|null;canMutate:boolean};
export const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const timestamp=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
function safeJSON(v:unknown):boolean {
 if(v===null||typeof v==='boolean'||typeof v==='number')return true;
 if(typeof v==='string')return v.length<=200000;
 if(Array.isArray(v))return v.length<=50000&&v.every(safeJSON);
 return record(v)&&Object.entries(v).every(([k,value])=>!['__proto__','prototype','constructor','signed_url','access_token','refresh_token','password'].includes(k)&&safeJSON(value));
}
const string=(v:unknown):v is string=>typeof v==='string';
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const optional=(o:Record<string,unknown>,keys:string[],test:(v:unknown)=>boolean)=>keys.every(k=>o[k]==null||test(o[k]));
const date=(v:unknown)=>string(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const instant=(v:unknown)=>string(v)&&Number.isFinite(Date.parse(v));
function validContract(c:Record<string,unknown>){
 if(!uuid(c.id)||!['setup','teardown'].includes(String(c.kind))||!string(c.status)||!c.status||!date(c.service_date)||!record(c.show))return false;
 if(!optional(c,['service_time','document_path','terms','signature_name','admin_signature_name','admin_note'],string)||!optional(c,['contract_pay','bonus_pay'],number)||!optional(c,['signed_at','admin_signed_at'],instant))return false;
 const show=c.show;
 return uuid(show.id)&&string(show.name)&&string(show.city)&&date(show.starts_on)&&date(show.ends_on)&&show.is_test===false&&['show','signing'].includes(String(show.event_type))&&
 optional(show,['state','address','artist','venue_name','lodging_name','lodging_address','lodging_phone','lodging_confirmation','lodging_notes','test_owner'],string)&&
 optional(show,['bin_count','per_diem'],number)&&optional(show,['meals_included','lodging_included'],v=>typeof v==='boolean')&&
 optional(show,['details_unlock_at','signing_at','setup_at','lodging_check_in','lodging_check_out'],instant);
}
function validResponse(v:unknown):boolean {
 if(v==null)return true;
 return record(v)&&uuid(v.id)&&typeof v.completed==='boolean'&&optional(v,['note','review_status','review_note'],string)&&optional(v,['reviewed_at'],instant)&&(v.reviewer==null||(record(v.reviewer)&&string(v.reviewer.full_name)));
}
function validSection(v:unknown):boolean {
 return record(v)&&uuid(v.id)&&string(v.title)&&number(v.position)&&Array.isArray(v.items)&&v.items.every(i=>record(i)&&uuid(i.id)&&string(i.title)&&optional(i,['instructions'],string)&&typeof i.required==='boolean'&&typeof i.photo_required==='boolean'&&number(i.position)&&validResponse(i.response));
}
export function validateSnapshot(raw:unknown):OfflineSnapshot|null {
 if(!record(raw)||!safeJSON(raw)||Object.keys(raw).some(k=>!['version','owner','verifiedAt','lastSeenAt','contracts','links','resources'].includes(k)))return null;
 if(raw.version!==1||!uuid(raw.owner)||!timestamp(raw.verifiedAt)||!timestamp(raw.lastSeenAt)||!record(raw.contracts)||!record(raw.resources)||!Array.isArray(raw.links))return null;
 for(const [id,value] of Object.entries(raw.contracts)){
  if(!uuid(id)||!record(value)||!timestamp(value.fetchedAt)||!record(value.contract)||value.contract.id!==id||!record(value.checklist))return null;
  const c=value.contract,checklist=value.checklist;
  if(!validContract(c))return null;
  if(checklist.id!==null&&!uuid(checklist.id))return null;
  if(!Array.isArray(checklist.sections)||!checklist.sections.every(validSection))return null;
 }
 for(const [id,value] of Object.entries(raw.resources))if(!uuid(id)||!record(value)||!timestamp(value.fetchedAt)||!record(value.resource)||value.resource.id!==id||value.resource.kind!=='handbook'||typeof value.resource.title!=='string'||!optional(value.resource,['content','file_path'],string)||(value.resource.file_type!=null&&!['pdf','image'].includes(String(value.resource.file_type))))return null;
 if(!raw.links.every(l=>record(l)&&uuid(l.show_id)&&uuid(l.linked_show_id)))return null;
 return raw as OfflineSnapshot;
}
export function canReadSaved(snapshot:OfflineSnapshot,sessionOwner:string|null,now:number):boolean {
 return !!sessionOwner&&snapshot.owner===sessionOwner&&now>=snapshot.lastSeenAt&&now>=snapshot.verifiedAt&&now-snapshot.verifiedAt<LEASE_MS;
}
export const fileKey=(ref:FileRef)=>`${ref.kind}:${ref.contractId||''}:${ref.recordId}`;
