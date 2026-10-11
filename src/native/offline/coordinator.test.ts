import test from 'node:test';
import assert from 'node:assert/strict';
import {OfflineCoordinator} from './coordinator.ts';
import type {OfflineSnapshot} from './model.ts';
import type {OfflinePlugin} from './plugin.ts';
const owner='11111111-1111-4111-8111-111111111111';
const now=1000000000;
const snapshot:OfflineSnapshot={version:1,owner,verifiedAt:now,lastSeenAt:now,contracts:{},links:[],resources:{}};
function fixture(){
 let saved:unknown=snapshot,resolve!:(s:OfflineSnapshot)=>void,reject!:(e:Error)=>void,calls=0;
 const network=new Promise<OfflineSnapshot>((yes,no)=>{resolve=yes;reject=no;});
 const plugin:OfflinePlugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{},read:async()=>({snapshot:saved}),replace:async o=>{saved=o.snapshot},clear:async()=>{saved=null},usage:async()=>({bytes:1,limit:262144000}),manifest:async()=>({files:[]}),readFile:async()=>{throw Error('absent')},removeFile:async()=>{},putFile:async()=>{}};
 const coordinator=new OfflineCoordinator(plugin,async()=>{calls++;return network},()=>now);
 return {coordinator,resolve,reject,get calls(){return calls},get saved(){return saved}};
}
test('hydrates saved content before live response, coalesces refreshes and switches to live only after verification',async()=>{
 const f=fixture(),c=f.coordinator;await c.activate(owner);
 assert.equal(c.getState().contracts.source,'saved');assert.equal(c.getState().contracts.canMutate,false);
 c.verify(owner,now);const a=c.refresh('launch'),b=c.refresh('route');await Promise.resolve();assert.equal(f.calls,1);
 f.resolve(snapshot);await Promise.all([a,b]);assert.equal(c.getState().contracts.source,'live');assert.equal(c.getState().contracts.canMutate,true);
});
test('network failure preserves saved timestamp and remains read-only',async()=>{
 const f=fixture(),c=f.coordinator;await c.activate(owner);c.verify(owner,now);const pending=c.refresh('launch');f.reject(Error('offline'));await pending;
 assert.equal(c.getState().snapshot?.verifiedAt,now);assert.equal(c.getState().contracts.source,'saved');assert.equal(c.getState().contracts.canMutate,false);assert.ok(c.getState().contracts.error);
});
test('late refresh after signout cannot recreate or expose prior account data',async()=>{
 const f=fixture(),c=f.coordinator;await c.activate(owner);c.verify(owner,now);const pending=c.refresh('launch');await c.deactivate('signout');f.resolve(snapshot);await pending;
 assert.equal(c.getState().owner,null);assert.equal(c.getState().snapshot,null);assert.equal(f.saved,null);
});
test('removing a selected resource during download prevents a late file from restoring it',async()=>{
 let finish!:(v:{mime:string;base64:string})=>void;const bytes=new Promise<{mime:string;base64:string}>(yes=>{finish=yes});let stored=0;
 const resource={id:'22222222-2222-4222-8222-222222222222',kind:'handbook' as const,title:'Guide',content:'Text',file_path:'guide.pdf',file_type:'pdf' as const};
 const plugin:OfflinePlugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{},read:async()=>({snapshot}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),readFile:async()=>{throw Error('absent')},removeFile:async()=>{},putFile:async()=>{stored++}};
 const c=new OfflineCoordinator(plugin,async()=>snapshot,()=>now,{download:async()=>bytes,resources:async()=>[resource]});await c.activate(owner);c.verify(owner,now);await c.refresh('launch');
 const ref={kind:'resource' as const,recordId:resource.id};const pending=c.download(ref,resource);await Promise.resolve();await c.remove(ref);finish({mime:'application/pdf',base64:'JVBERi0='});await pending;
 assert.equal(stored,0);assert.deepEqual(c.getState().snapshot?.resources,{});
});
test('concurrent resource selections merge instead of losing one',async()=>{
 const resources=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'].map(id=>({id,kind:'handbook' as const,title:id,content:'Text',file_path:null,file_type:null}));
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{},read:async()=>({snapshot}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,async()=>snapshot,()=>now,{download:async()=>{throw Error('no file')},resources:async()=>resources});await c.activate(owner);c.verify(owner,now);await c.refresh('launch');
 await Promise.all(resources.map(resource=>c.download({kind:'resource',recordId:resource.id},resource)));
 assert.equal(Object.keys(c.getState().snapshot!.resources).length,2);
});
test('a background resource loop stops at account switch without copying another resource into the next account',async()=>{
 const resources=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'].map(id=>({id,kind:'handbook' as const,title:id,content:'Private account A text',file_path:'guide.pdf',file_type:'pdf' as const}));
 const saved={...snapshot,resources:Object.fromEntries(resources.map(resource=>[resource.id,{resource,fetchedAt:now}]))};
 let configured=owner,finish!:(v:{mime:string;base64:string})=>void,started!:()=>void;const entered=new Promise<void>(yes=>{started=yes});const bytes=new Promise<{mime:string;base64:string}>(yes=>{finish=yes});
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async(o:{owner:string})=>{configured=o.owner},read:async()=>({snapshot:configured===owner?saved:{...snapshot,owner:configured}}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,async id=>({...snapshot,owner:id}),()=>now,{download:async()=>{started();return bytes},resources:async()=>resources});
 await c.activate(owner);c.verify(owner,now);await c.refresh('launch');await entered;
 const next='44444444-4444-4444-8444-444444444444';await c.activate(next);c.verify(next,now);finish({mime:'application/pdf',base64:'JVBERi0='});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(c.getState().snapshot!.resources,{});
});
test('usable verified live data survives a cache persistence failure',async()=>{
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{},read:async()=>({snapshot:null}),replace:async()=>{throw Error('Storage full')},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,async()=>snapshot,()=>now);await c.activate(owner);c.verify(owner,now);await c.refresh('launch');
 assert.equal(c.getState().contracts.source,'live');assert.equal(c.getState().contracts.canMutate,true);assert.ok(c.getState().cacheError);
});
test('removing a queued resource during refresh does not select it again',async()=>{
 const resources=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'].map(id=>({id,kind:'handbook' as const,title:id,content:'Private account A text',file_path:'guide.pdf',file_type:'pdf' as const}));
 const saved={...snapshot,resources:Object.fromEntries(resources.map(resource=>[resource.id,{resource,fetchedAt:now}]))};
 let configured=owner,finish!:(v:{mime:string;base64:string})=>void,started!:()=>void;const entered=new Promise<void>(yes=>{started=yes});const bytes=new Promise<{mime:string;base64:string}>(yes=>{finish=yes});
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async(o:{owner:string})=>{configured=o.owner},read:async()=>({snapshot:configured===owner?saved:{...snapshot,owner:configured}}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,async id=>({...snapshot,owner:id}),()=>now,{download:async()=>{started();return bytes},resources:async()=>resources});
 await c.activate(owner);c.verify(owner,now);await c.refresh('launch');await entered;
 await c.remove({kind:'resource',recordId:resources[1].id});finish({mime:'application/pdf',base64:'JVBERi0='});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.getState().snapshot!.resources[resources[1].id],undefined);
});

test('retries an unavailable native saved read before waiting for any network response',async()=>{
 let available=false;
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{if(!available)throw Error('Scene inactive')},read:async()=>({snapshot}),replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,()=>new Promise(()=>{}),()=>now);
 await c.activate(owner);assert.equal(c.getState().snapshot,null);
 available=true;await c.activate(owner);
 assert.equal(c.getState().snapshot?.owner,owner);assert.equal(c.getState().contracts.source,'saved');assert.equal(c.getState().contracts.canMutate,false);
});
test('same-account activation waits for the in-flight saved read before refreshing',async()=>{
 let finish!:(value:{snapshot:OfflineSnapshot})=>void;
 const read=new Promise<{snapshot:OfflineSnapshot}>(resolve=>{finish=resolve});
 const plugin={setAccess:async()=>{},clearAccess:async()=>{},configure:async()=>{},read:()=>read,replace:async()=>{},clear:async()=>{},usage:async()=>({bytes:0,limit:262144000}),manifest:async()=>({files:[]}),removeFile:async()=>{},putFile:async()=>{},readFile:async()=>{throw Error('none')}};
 const c=new OfflineCoordinator(plugin,async()=>snapshot,()=>now);let secondFinished=false;
 const first=c.activate(owner),second=c.activate(owner).then(()=>{secondFinished=true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(secondFinished,false);
 finish({snapshot});await Promise.all([first,second]);assert.equal(c.getState().contracts.source,'saved');
});
