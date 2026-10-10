import test from 'node:test';
import assert from 'node:assert/strict';
import { runIosBuild } from './ios-build-pipeline.mjs';
const config={url:'https://myraoovepjwhkafzdppq.supabase.co',key:'sb_publishable_fixture',channel:'public',version:'5'};
test('validates before deleting/building/syncing and cannot sync stale output',async()=>{
 const calls=[];
 await assert.rejects(runIosBuild({config:{...config,url:''},clean:async()=>calls.push('clean'),build:async()=>calls.push('build'),sync:async()=>calls.push('sync')}));
 assert.deepEqual(calls,[]);
 await runIosBuild({config,clean:async()=>calls.push('clean'),build:async()=>calls.push('build'),sync:async()=>calls.push('sync')});
 assert.deepEqual(calls,['clean','build','sync']);
});
test('failed builds never sync old assets',async()=>{
 let synced=false;
 await assert.rejects(runIosBuild({config,clean:async()=>{},build:async()=>{throw new Error('build failed')},sync:async()=>{synced=true}}));
 assert.equal(synced,false);
});
