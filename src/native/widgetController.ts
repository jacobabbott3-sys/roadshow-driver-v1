import {canFollow,editableAssignment,widgetSnapshot,type OwnedAssignment,type WidgetSnapshot} from './widgetModel.ts';
export type WidgetStatus={following:string;activityAvailable:boolean;widgetAvailable:boolean};
export type ActivityCommand={connection:string;operation:'start'|'update'|'stop';id?:string;title?:string;completed?:number;total?:number};
export interface WidgetAPI {
 configure(args:{connection:string;owner:string}):Promise<WidgetStatus>;
 suspend(args:{connection:string}):Promise<unknown>;
 clear():Promise<unknown>;
 snapshot(args:{connection:string;snapshot:WidgetSnapshot}):Promise<unknown>;
 status(args:{connection:string}):Promise<WidgetStatus>;
 activity(args:ActivityCommand):Promise<WidgetStatus>;
 consumeLink(args:{connection:string}):Promise<{url:string}>;
}
export type WidgetViewState=WidgetStatus & {ready:boolean;assignments:OwnedAssignment[];error:string};
const empty:WidgetViewState={ready:false,assignments:[],following:'',activityAvailable:false,widgetAvailable:false,error:''};
export class WidgetController {
 private generation=0;private activityEpoch=0;private connection='';private owner='';private queue:Promise<unknown>=Promise.resolve();private refreshing:number|null=null;
 state:WidgetViewState={...empty};
 private api:WidgetAPI;
 private loadAssignments:(owner:string)=>Promise<OwnedAssignment[]>;
 private loadProgress:(id:string)=>Promise<{completed:number;total:number}>;
 private changed:(state:WidgetViewState)=>void;
 constructor(api:WidgetAPI,loadAssignments:(owner:string)=>Promise<OwnedAssignment[]>,loadProgress:(id:string)=>Promise<{completed:number;total:number}>,changed:(state:WidgetViewState)=>void){this.api=api;this.loadAssignments=loadAssignments;this.loadProgress=loadProgress;this.changed=changed;}
 private emit(patch:Partial<WidgetViewState>){this.state={...this.state,...patch};this.changed(this.state);}
 private enqueue<T>(work:()=>Promise<T>):Promise<T>{const next=this.queue.then(work);this.queue=next.catch(()=>{});return next;}
 settled(){return this.queue;}
 deactivate(clear:boolean){const connection=this.connection;++this.generation;this.connection='';this.emit({...empty});void this.enqueue(async()=>{if(clear)await this.api.clear();else if(connection)await this.api.suspend({connection});}).catch(()=>{});}
 async connect(owner:string){
  const generation=++this.generation;const connection=crypto.randomUUID();this.connection=connection;this.owner=owner;
  this.emit({...empty});
  try{const status=await this.enqueue(()=>this.api.configure({connection,owner}));if(generation!==this.generation)return;this.emit({...status,ready:true});await this.refresh();}
  catch{if(generation===this.generation)this.emit({ready:false,error:'Widgets are unavailable. Open Roadshow again to retry.'});}
 }
 async refresh(){
  if(!this.state.ready||this.refreshing===this.generation)return;
  const generation=this.generation;this.refreshing=generation;const connection=this.connection;const activityEpoch=this.activityEpoch;
  try{
   const assignments=await this.loadAssignments(this.owner);if(generation!==this.generation)return;
   const status=await this.enqueue(async()=>{if(generation!==this.generation)throw new Error('stale');return this.api.status({connection});});
   if(generation!==this.generation)return;this.emit({...status,following:activityEpoch===this.activityEpoch?status.following:this.state.following,assignments,error:''});
   if(status.widgetAvailable){try{await this.enqueue(async()=>{if(generation===this.generation)await this.api.snapshot({connection,snapshot:widgetSnapshot(assignments)});});}catch{if(generation===this.generation)this.emit({error:'The Home Screen widget could not refresh.'});}}
   if(generation!==this.generation)return;
   if(status.following&&activityEpoch===this.activityEpoch){
    const row=assignments.find(row=>row.id===status.following);
    const progress=row&&editableAssignment(row)?await this.loadProgress(row.id):null;
    if(generation!==this.generation)return;
    const result=await this.enqueue(async()=>{
     if(generation!==this.generation||activityEpoch!==this.activityEpoch)return null;
     return this.api.activity(row&&progress&&canFollow(row,progress.completed,progress.total)?{connection,operation:'update',id:row.id,title:row.show.name.slice(0,120),...progress}:{connection,operation:'stop'});
    });if(result&&generation===this.generation&&activityEpoch===this.activityEpoch)this.emit(result);
   }
  }catch{if(generation===this.generation)this.emit({error:'Could not refresh. Open Roadshow when connected; displayed progress may be stale.'});}
  finally{if(this.refreshing===generation)this.refreshing=null;}
 }
 async follow(id:string){
  if(!this.state.ready)throw new Error('Wait for account verification.');
  ++this.activityEpoch;
  const generation=this.generation,connection=this.connection;
  // A fresh ownership read and a successful checklist read precede every start.
  const rows=await this.loadAssignments(this.owner);const row=rows.find(row=>row.id===id);
  if(!row)throw new Error('Only your assigned checklist can be followed.');
  const progress=await this.loadProgress(id);
  if(generation!==this.generation)throw new Error('Account changed. Please try again.');
  if(!canFollow(row,progress.completed,progress.total))throw new Error('This checklist is complete or is not currently editable.');
  const status=await this.enqueue(()=>{if(generation!==this.generation)throw new Error('Account changed.');return this.api.activity({connection,operation:'start',id,title:row.show.name.slice(0,120),...progress});});
  if(generation===this.generation)this.emit(status);
 }
 async stop(){++this.activityEpoch;const generation=this.generation,connection=this.connection;const status=await this.enqueue(()=>{if(generation!==this.generation||!connection)throw new Error('Account changed.');return this.api.activity({connection,operation:'stop'});});if(generation===this.generation)this.emit(status);}
 async link(){const generation=this.generation,connection=this.connection;if(!this.state.ready)return '';const result=await this.enqueue(()=>this.api.consumeLink({connection}));return generation===this.generation?result.url:'';}
}
