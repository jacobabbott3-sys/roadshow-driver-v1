import {canReadSaved,validateSnapshot,LIMIT_BYTES,type OfflineSnapshot,type SavedContract,type SavedResource,type SavedFile,type ReadState} from './model.ts';
import type {OfflinePlugin} from './plugin';
export type OfflineState={owner:string|null;generation:string;snapshot:OfflineSnapshot|null;contracts:ReadState<SavedContract[]>;details:Record<string,ReadState<SavedContract>>;resources:ReadState<SavedResource[]>;files:SavedFile[];usage:{bytes:number;limit:number}};
const empty=<T>():ReadState<T>=>({data:null,source:'none',refreshing:false,fetchedAt:null,error:null,canMutate:false});
const initial=():OfflineState=>({owner:null,generation:'',snapshot:null,contracts:empty(),details:{},resources:empty(),files:[],usage:{bytes:0,limit:LIMIT_BYTES}});
export class OfflineCoordinator {
 private state=initial();private listeners=new Set<()=>void>();private verifiedAt=0;private pending:Promise<void>|null=null;private queue:Promise<unknown>=Promise.resolve();
 private plugin:OfflinePlugin;private load:(owner:string)=>Promise<OfflineSnapshot>;private now:()=>number;
 constructor(plugin:OfflinePlugin,load:(owner:string)=>Promise<OfflineSnapshot>,now=()=>Date.now()){this.plugin=plugin;this.load=load;this.now=now;}
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
  this.verifiedAt=0;this.pending=null;this.state=initial();this.emit();await this.serial(()=>this.plugin.clear());
 }
 refresh(_reason:'launch'|'resume'|'route'|'manual'|'mutation'|'periodic',_contractId?:string):Promise<void>{
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
   }catch(error){if(this.state.generation===generation)this.display(this.state.snapshot,'saved',false,error instanceof Error?error.message:'Could not refresh.');}
  })();
  this.pending=task;void task.finally(()=>{if(this.pending===task)this.pending=null;});return task;
 }
 async updateFiles(){const {generation}=this.state;if(!generation)return;try{const [manifest,usage]=await Promise.all([this.plugin.manifest({generation}),this.plugin.usage({generation})]);if(this.state.generation===generation){this.state={...this.state,files:manifest.files,usage};this.emit();}}catch{/* Snapshot remains usable when optional storage is unavailable. */}}
}
