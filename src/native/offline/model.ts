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
export function validateSnapshot(raw:unknown):OfflineSnapshot|null {
 if(!record(raw)||!safeJSON(raw)||Object.keys(raw).some(k=>!['version','owner','verifiedAt','lastSeenAt','contracts','links','resources'].includes(k)))return null;
 if(raw.version!==1||!uuid(raw.owner)||!timestamp(raw.verifiedAt)||!timestamp(raw.lastSeenAt)||!record(raw.contracts)||!record(raw.resources)||!Array.isArray(raw.links))return null;
 for(const [id,value] of Object.entries(raw.contracts)){
  if(!uuid(id)||!record(value)||!timestamp(value.fetchedAt)||!record(value.contract)||value.contract.id!==id||!record(value.checklist))return null;
  const c=value.contract,checklist=value.checklist;
  if(!record(c.show)||!uuid(c.show.id)||c.show.is_test!==false||typeof c.show.name!=='string'||typeof c.service_date!=='string'||!['setup','teardown'].includes(String(c.kind)))return null;
  if(checklist.id!==null&&!uuid(checklist.id))return null;
  if(!Array.isArray(checklist.sections)||!checklist.sections.every(s=>record(s)&&uuid(s.id)&&typeof s.title==='string'&&Array.isArray(s.items)&&s.items.every(i=>record(i)&&uuid(i.id)&&typeof i.title==='string'&&typeof i.required==='boolean')))return null;
 }
 for(const [id,value] of Object.entries(raw.resources))if(!uuid(id)||!record(value)||!timestamp(value.fetchedAt)||!record(value.resource)||value.resource.id!==id||value.resource.kind!=='handbook'||typeof value.resource.title!=='string')return null;
 if(!raw.links.every(l=>record(l)&&uuid(l.show_id)&&uuid(l.linked_show_id)))return null;
 return raw as OfflineSnapshot;
}
export function canReadSaved(snapshot:OfflineSnapshot,sessionOwner:string|null,now:number):boolean {
 return !!sessionOwner&&snapshot.owner===sessionOwner&&now>=snapshot.lastSeenAt&&now>=snapshot.verifiedAt&&now-snapshot.verifiedAt<LEASE_MS;
}
export const fileKey=(ref:FileRef)=>`${ref.kind}:${ref.contractId||''}:${ref.recordId}`;
