import {test} from 'node:test';import assert from 'node:assert/strict';
import {WidgetController} from './widgetController.ts';
const id='11111111-1111-4111-8111-111111111111';
const row={id,driver_id:'me',contract_drivers:[],status:'signed',service_date:'2026-10-10',show:{name:'Show',city:'City',event_type:'show',starts_on:'2026-10-10'}};
function harness(){const calls:string[]=[];let resolve:(rows:typeof row[])=>void=()=>{};const api={configure:async()=>({following:'',activityAvailable:true,widgetAvailable:true}),suspend:async()=>{},clear:async()=>{calls.push('clear')},snapshot:async()=>{calls.push('snapshot')},status:async()=>({following:'',activityAvailable:true,widgetAvailable:true}),activity:async(args:{operation:string})=>{calls.push(args.operation);return {following:args.operation==='start'?id:'',activityAvailable:true,widgetAvailable:true}},consumeLink:async()=>({url:''})};const controller=new WidgetController(api,()=>new Promise<typeof row[]>(r=>{resolve=r}),async()=>({completed:1,total:2}),()=>{});return {controller,calls,release:()=>resolve([row])};}
test('logout invalidates pending assignment reads before they can repopulate widget',async()=>{const h=harness();const pending=h.controller.connect('me');await new Promise(r=>setTimeout(r,0));h.controller.deactivate(true);h.release();await pending;await h.controller.settled();assert.deepEqual(h.calls,['clear']);});
test('refresh does not start an activity without explicit user action',async()=>{const h=harness();const pending=h.controller.connect('me');await new Promise(r=>setTimeout(r,0));h.release();await pending;assert.deepEqual(h.calls,['snapshot']);});
test('completion ends a followed activity and does not publish optimistic totals',async()=>{
 const calls:string[]=[];let progress={completed:1,total:2};let following=id;
 const api={configure:async()=>({following,activityAvailable:true,widgetAvailable:true}),suspend:async()=>{},clear:async()=>{},snapshot:async()=>{},status:async()=>({following,activityAvailable:true,widgetAvailable:true}),consumeLink:async()=>({url:''}),activity:async(args:{operation:string})=>{calls.push(args.operation);if(args.operation==='stop')following='';return {following,activityAvailable:true,widgetAvailable:true};}};
 const c=new WidgetController(api,async()=>[row],async()=>progress,()=>{});await c.connect('me');assert.deepEqual(calls,['update']);progress={completed:2,total:2};await c.refresh();assert.deepEqual(calls,['update','stop']);
});
test('failed progress read retains last confirmed activity without updating it',async()=>{
 const calls:string[]=[];const api={configure:async()=>({following:id,activityAvailable:true,widgetAvailable:true}),suspend:async()=>{},clear:async()=>{},snapshot:async()=>{},status:async()=>({following:id,activityAvailable:true,widgetAvailable:true}),consumeLink:async()=>({url:''}),activity:async()=>{calls.push('activity');return {following:id,activityAvailable:true,widgetAvailable:true};}};
 const c=new WidgetController(api,async()=>[row],async()=>{throw new Error('offline')},()=>{});await c.connect('me');assert.equal(c.state.following,id);assert.match(c.state.error,/stale/);assert.deepEqual(calls,[]);
});
test('explicit follow refuses a visible but unassigned contract',async()=>{
 const h=harness();const connect=h.controller.connect('me');await new Promise(r=>setTimeout(r,0));h.release();await connect;
 const follow=h.controller.follow('22222222-2222-4222-8222-222222222222');h.release();await assert.rejects(follow,/Only your assigned/);assert.deepEqual(h.calls,['snapshot']);
});
test('an older completed refresh cannot stop a newly followed checklist',async()=>{
 const second={...row,id:'22222222-2222-4222-8222-222222222222'};let following=id,delay=false;let release:(p:{completed:number;total:number})=>void=()=>{};const calls:string[]=[];
 const status=()=>({following,activityAvailable:true,widgetAvailable:true});
 const api={configure:async()=>status(),suspend:async()=>{},clear:async()=>{},snapshot:async()=>{},status:async()=>status(),consumeLink:async()=>({url:''}),activity:async(a:{operation:string;id?:string})=>{calls.push(a.operation);following=a.operation==='stop'?'':a.operation==='start'?a.id!:following;return status();}};
 const c=new WidgetController(api,async()=>[row,second],async key=>key===id&&delay?new Promise(r=>{release=r}):{completed:1,total:2},()=>{});await c.connect('me');delay=true;const refresh=c.refresh();await new Promise(r=>setTimeout(r,0));await c.follow(second.id);release({completed:2,total:2});await refresh;assert.equal(following,second.id);assert.deepEqual(calls,['update','start']);
});
test('known terminal assignment ends even when snapshot storage and progress reads fail',async()=>{
 let stops=0,progressReads=0;const status=()=>({following:id,activityAvailable:true,widgetAvailable:true});
 const api={configure:async()=>status(),suspend:async()=>{},clear:async()=>{},snapshot:async()=>{throw new Error('disk')},status:async()=>status(),consumeLink:async()=>({url:''}),activity:async()=>{stops++;return {...status(),following:''};}};
 const c=new WidgetController(api,async()=>[{...row,status:'approved'}],async()=>{progressReads++;throw new Error('offline')},()=>{});await c.connect('me');assert.equal(stops,1);assert.equal(progressReads,0);
});
