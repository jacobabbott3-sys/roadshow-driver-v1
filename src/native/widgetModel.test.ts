import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownAssignments,widgetSnapshot,widgetRoute,canFollow,checklistProgress} from './widgetModel.ts';
import {nextAssignment,assignmentDate} from '../lib/nextAssignment.ts';
const id='11111111-1111-4111-8111-111111111111';
const row={id,driver_id:'me',contract_drivers:[],status:'signed',service_date:'2026-10-10',service_time:'10:00:00',show:{name:'Syracuse',city:'Syracuse',state:'NY',event_type:'show',starts_on:'2026-10-10',is_test:false}};
test('only primary or linked assignments qualify, never admin visibility or test shows',()=>{
 assert.equal(ownAssignments([row,{...row,id:'other',driver_id:'them'},{...row,id:'linked',driver_id:'them',contract_drivers:[{driver_id:'me'}]},{...row,id:'test',show:{...row.show,is_test:true}}],'me').length,2);
});
test('selector preserves Home ordering and skips final work',()=>{assert.equal(nextAssignment([{...row,status:'approved'},row])?.id,id);assert.equal(nextAssignment([]),undefined);assert.equal(assignmentDate({...row,show:{...row.show,event_type:'signing',setup_at:'2026-10-11T15:00:00Z'}}).toISOString(),'2026-10-11T15:00:00.000Z');});
test('snapshot contains only bounded presentation data with expiry',()=>{
 const value=widgetSnapshot([row],1000);assert.equal(value.assignment?.id,id);assert.equal(value.updatedAt,1000);assert.equal(value.expiresAt,22600);assert.equal('driver_id' in value.assignment!,false);assert.equal(widgetSnapshot([],1000).assignment,null);
});
test('links are exact allowlisted routes with UUIDs',()=>{
 assert.equal(widgetRoute(`roadshow-driver://contract/${id}?tab=checklist`),`/contracts/${id}?tab=checklist`);
 for(const url of ['https://bad.test',`roadshow-driver://contract/${id}/extra`,`roadshow-driver://contract/${id}?evil=1`,'roadshow-driver://contract/not-an-id'])assert.equal(widgetRoute(url),null);
});
test('follow requires editable own non-final work and confirmed valid totals',()=>{
 assert.equal(canFollow(row,1,3),true);assert.equal(canFollow({...row,status:'submitted'},1,3),false);assert.equal(canFollow(row,3,3),false);assert.equal(canFollow(row,0,0),false);
 assert.deepEqual(checklistProgress([{response:{completed:true}},{response:null}]),{completed:1,total:2});
});
