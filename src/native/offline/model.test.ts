import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadSaved, validateSnapshot } from './model.ts';
const owner='11111111-1111-4111-8111-111111111111';
const snapshot={version:1,owner,verifiedAt:1000000000,lastSeenAt:1000000000,contracts:{},links:[],resources:{}};
test('saved access expires at seven days and rejects clock rollback or absent/wrong owner',()=>{
 const s=validateSnapshot(snapshot)!;assert.ok(s);
 assert.equal(canReadSaved(s,owner,1000000000+604800000-1),true);
 for(const [id,now] of [[owner,1000000000+604800000],[null,1000000000],['22222222-2222-4222-8222-222222222222',1000000000],[owner,999999999]] as const) assert.equal(canReadSaved(s,id,now),false);
});
test('unknown versions, malformed records and credentials cannot enter snapshots',()=>{
 for(const value of [null,{}, {...snapshot,version:2},{...snapshot,contracts:{bad:{}}},{...snapshot,access_token:'secret'},{...snapshot,resources:{bad:{signed_url:'https://example.test'}}}]) assert.equal(validateSnapshot(value),null);
});
test('rejects malformed display fields in otherwise structured contract snapshots',()=>{
 const id='22222222-2222-4222-8222-222222222222';
 const contract={id,kind:'setup',status:'assigned',service_date:'2026-10-20',show:{id:'33333333-3333-4333-8333-333333333333',name:'Fixture',city:'Denver',is_test:false,event_type:'show',starts_on:1,ends_on:2}};
 assert.equal(validateSnapshot({...snapshot,contracts:{[id]:{contract,checklist:{id:null,sections:[]},fetchedAt:1000000000}}}),null);
});

test('shares native valid/invalid persisted fixtures',()=>{for(const [name,valid] of [['valid',true],['invalid-date',false]] as const)assert.equal(!!validateSnapshot(JSON.parse(readFileSync(`tests/fixtures/offline/${name}.json`,'utf8'))),valid);});
