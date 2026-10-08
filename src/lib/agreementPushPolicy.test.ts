import test from 'node:test';
import assert from 'node:assert/strict';
import { isInAppOnlyNotification } from '../../supabase/functions/web-push/notification-policy.ts';

test('agreement removal and revision never qualify for device push', () => {
  assert.equal(isInAppOnlyNotification('agreement_removed'),true);
  assert.equal(isInAppOnlyNotification('agreement_revision'),true);
  assert.equal(isInAppOnlyNotification('assignment'),false);
  assert.equal(isInAppOnlyNotification(undefined),false);
});

// Execute the actual Edge handler with disposable boundaries, no network or keys.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
test('Edge handler skips private agreement notices before server configuration or push clients',async()=>{
  let handler: (request:Request)=>Promise<Response> = async()=>new Response('',{status:500});
  const reads:string[]=[];
  const source=readFileSync('supabase/functions/web-push/index.ts','utf8').replace(/^import .*;\n/gm,'');
  runInNewContext(stripTypeScriptTypes(source),{
    Response,isInAppOnlyNotification,
    Deno:{serve:(callback:typeof handler)=>{handler=callback;},env:{get:(key:string)=>{reads.push(key);return key==='WEBHOOK_SECRET'?'synthetic-hook':undefined;}}},
    createClient:()=>{throw new Error('Unexpected client creation');},
    webpush:{sendNotification:()=>{throw new Error('Unexpected device push');}},
  });
  for (const kind of ['agreement_removed','agreement_revision']) {
    reads.length=0;
    const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'x-webhook-secret':'synthetic-hook'},body:JSON.stringify({table:'notifications',record:{kind}})}));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{sent:0,skipped:true});
    assert.deepEqual(reads,['WEBHOOK_SECRET']);
  }
  const normal=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'x-webhook-secret':'synthetic-hook'},body:JSON.stringify({table:'notifications',record:{kind:'assignment'}})}));
  assert.equal(normal.status,500,'ordinary notifications still require push configuration');
});
