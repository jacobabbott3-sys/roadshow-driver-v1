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
 const plugin:OfflinePlugin={configure:async()=>{},read:async()=>({snapshot:saved}),replace:async o=>{saved=o.snapshot},clear:async()=>{saved=null},usage:async()=>({bytes:1,limit:262144000}),manifest:async()=>({files:[]}),readFile:async()=>{throw Error('absent')},removeFile:async()=>{}};
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
