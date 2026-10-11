import type {Resource} from '../../lib/driverData';
import {canReadSaved,validateSnapshot,LIMIT_BYTES,type OfflineSnapshot,type SavedContract,type SavedResource,type SavedFile,type ReadState,type FileRef,fileKey} from './model.ts';
import type {OfflinePlugin} from './plugin';
export type OfflineState={owner:string|null;generation:string;snapshot:OfflineSnapshot|null;contracts:ReadState<SavedContract[]>;details:Record<string,ReadState<SavedContract>>;resources:ReadState<SavedResource[]>;files:SavedFile[];usage:{bytes:number;limit:number}};
const empty=<T>():ReadState<T>=>({data:null,source:'none',refreshing:false,fetchedAt:null,error:null,canMutate:false});
const initial=():OfflineState=>({owner:null,generation:'',snapshot:null,contracts:empty(),details:{},resources:empty(),files:[],usage:{bytes:0,limit:LIMIT_BYTES}});
export type DownloadServices={download:(ref:FileRef)=>Promise<{mime:string;base64:string}>;resources:()=>Promise<Resource[]>};
export class OfflineCoordinator {
 private downloads?:DownloadServices;private selections=new Map<string,number>();
 private state=initial();private listeners=new Set<()=>void>();private verifiedAt=0;private pending:Promise<void>|null=null;private queue:Promise<unknown>=Promise.resolve();
 private plugin:OfflinePlugin;private load:(owner:string)=>Promise<OfflineSnapshot>;private now:()=>number;
 constructor(plugin:OfflinePlugin,load:(owner:string)=>Promise<OfflineSnapshot>,now=()=>Date.now(),downloads?:DownloadServices){this.plugin=plugin;this.load=load;this.now=now;this.downloads=downloads;}
 getState=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);}};
 private emit(){for(const listener of this.listeners)listener();}
 private serial<T>(action:()=>Promise<T>):Promise<T>{const task=this.queue.then(action);this.queue=task.catch(()=>{});return task;}
 private display(snapshot:OfflineSnapshot|null,source:'saved'|'live'|'none',refreshing=false,error:string|null=null){
  const valid=snapshot&&canReadSaved(snapshot,this.state.owner,this.now())?snapshot:null;
  const common={source:valid?source:'none' as const,refreshing,error,canMutate:!!valid&&source==='live'&&!!this.verifiedAt&&!refreshing&&!error};
  const contracts=valid?Object.values(valid.contracts):null;
  this.state={...this.state,snapshot:valid,contracts:{...common,data:contracts,fetchedAt:contracts?.length?Math.min(...contracts.map(c=>c.fetchedAt)):valid?.verifiedAt??null},details:Object.fromEntries((contracts||[]).map(c=>[c.contract.id,{...common,data:c,fetchedAt:c.fetchedAt}])),resources:{...common,data:valid?Object.values(valid.resources):null,fetchedAt:valid?.verifiedAt??null}};
  this.emit();
 }
 async activate(owner:string){
  if(this.state.owner===owner)return;
  const generation=crypto.randomUUID();this.verifiedAt=0;this.pending=null;this.state={...initial(),owner,generation};this.emit();
  try{
   const raw=await this.serial(async()=>{await this.plugin.configure({owner,generation});return this.plugin.read({generation});});
   if(this.state.generation!==generation)return;
   const snapshot=validateSnapshot(raw.snapshot);this.display(snapshot,'saved');
   await this.updateFiles();
  }catch{if(this.state.generation===generation)this.display(null,'none',false,'Could not read saved data.');}
 }
 verify(owner:string,verifiedAt:number){if(this.state.owner===owner)this.verifiedAt=verifiedAt;}
 suspend(){this.verifiedAt=0;this.display(this.state.snapshot,'saved');}
 async deactivate(_reason:'signout'|'switch'|'inactive'|'session-removed'){
  void _reason;this.verifiedAt=0;this.pending=null;this.state=initial();this.selections.clear();this.emit();await this.serial(()=>this.plugin.clear());
 }
 refresh(_reason:'launch'|'resume'|'route'|'manual'|'mutation'|'periodic',_contractId?:string):Promise<void>{
  void _reason;void _contractId;
  if(this.pending)return this.pending;
  if(!this.state.owner||!this.verifiedAt)return Promise.resolve();
  const {owner,generation}=this.state;this.display(this.state.snapshot,'saved',true);
  const task=(async()=>{
   try{
    const loaded=await this.load(owner);
    if(this.state.generation!==generation||!this.verifiedAt)return;
    const snapshot=validateSnapshot({...loaded,verifiedAt:this.verifiedAt,lastSeenAt:this.now(),resources:this.state.snapshot?.resources||{}});
    if(!snapshot)throw Error('Invalid contract response.');
    await this.serial(async()=>{if(this.state.generation===generation)await this.plugin.replace({generation,snapshot});});
    if(this.state.generation!==generation||!this.verifiedAt)return;
    this.display(snapshot,'live');await this.updateFiles();
    void this.refreshSelected(generation);
   }catch(error){if(this.state.generation===generation)this.display(this.state.snapshot,'saved',false,error instanceof Error?error.message:'Could not refresh.');}
  })();
  this.pending=task;void task.finally(()=>{if(this.pending===task)this.pending=null;});return task;
 }
 private async persist(snapshot:OfflineSnapshot,generation:string){
  await this.serial(async()=>{if(this.state.generation!==generation)throw Error('Account changed.');await this.plugin.replace({generation,snapshot});});
  if(this.state.generation===generation)this.display(snapshot,this.state.contracts.source,this.state.contracts.refreshing,this.state.contracts.error);
 }
 async download(ref:FileRef,resource?:Resource){
  const {generation,snapshot}=this.state;
  if(!snapshot||!this.verifiedAt||!this.downloads)throw Error('Connect and refresh before downloading.');
  const key=fileKey(ref),selection=(this.selections.get(key)||0)+1;this.selections.set(key,selection);
  if(ref.kind==='resource'&&resource){
   if(resource.kind!=='handbook'||resource.id!==ref.recordId)throw Error('Invalid resource.');
   await this.persist({...snapshot,resources:{...snapshot.resources,[resource.id]:{resource,fetchedAt:this.now()}}},generation);
  }
  if(ref.kind==='resource'&&!this.state.snapshot?.resources[ref.recordId])throw Error('Select this resource first.');
  if(ref.kind!=='resource'&&!this.state.snapshot?.contracts[ref.contractId||''])throw Error('Contract is no longer assigned.');
  if(ref.kind==='resource'&&!this.state.snapshot?.resources[ref.recordId]?.resource.file_path){await this.updateFiles();return;}
  const result=await this.downloads.download(ref);
  await this.serial(async()=>{
   if(this.state.generation!==generation||this.selections.get(key)!==selection)return;
   await this.plugin.putFile({generation,ref,...result});
  });await this.updateFiles();
 }
 async remove(ref:FileRef){
  const {generation,snapshot}=this.state;this.selections.set(fileKey(ref),(this.selections.get(fileKey(ref))||0)+1);
  await this.serial(()=>this.plugin.removeFile({generation,ref}));
  if(snapshot&&this.state.generation===generation&&ref.kind==='resource'){
   const resources={...this.state.snapshot?.resources};delete resources[ref.recordId];await this.persist({...this.state.snapshot!,resources},generation);
  }await this.updateFiles();
 }
 async readFile(ref:FileRef){const {generation}=this.state;const result=await this.plugin.readFile({generation,ref});if(this.state.generation!==generation)throw Error('Account changed.');return result;}
 async clearDownloads(){const {owner}=this.state,verified=this.verifiedAt;if(!owner)return;await this.deactivate('switch');await this.activate(owner);this.verify(owner,verified);await this.refresh('manual');}
 private async refreshSelected(generation:string){
  if(!this.downloads||!this.state.snapshot)return;
  try{
   const available=await this.downloads.resources();if(this.state.generation!==generation)return;
   for(const selected of Object.values(this.state.snapshot?.resources||{})){
    const current=available.find(r=>r.id===selected.resource.id&&r.kind==='handbook');
    const ref:FileRef={kind:'resource',recordId:selected.resource.id};
    if(!current)await this.remove(ref);else await this.download(ref,current).catch(()=>{});
   }
   for(const file of this.state.files.filter(f=>f.ref.kind!=='resource')){
    if(this.state.generation!==generation)return;
    if(!this.state.snapshot?.contracts[file.ref.contractId||''])await this.remove(file.ref);
    else await this.download(file.ref).catch(()=>{});
   }
  }catch{/* Optional refresh failure preserves the previous usable file. */}
 }
 async updateFiles(){const {generation}=this.state;if(!generation)return;try{const [manifest,usage]=await Promise.all([this.plugin.manifest({generation}),this.plugin.usage({generation})]);if(this.state.generation===generation){this.state={...this.state,files:manifest.files,usage};this.emit();}}catch{/* Snapshot remains usable when optional storage is unavailable. */}}
}
