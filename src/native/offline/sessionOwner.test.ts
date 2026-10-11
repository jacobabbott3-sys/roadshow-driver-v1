import test from 'node:test';
import assert from 'node:assert/strict';
import {persistedOwner} from './sessionOwner.ts';
test('recognizes only an existing persisted session identity, never cached roles or metadata',()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 assert.equal(persistedOwner(JSON.stringify({access_token:'existing',refresh_token:'existing',user:{id:owner,user_metadata:{role:'admin'}}})),owner);
 for(const raw of ['bad','null',JSON.stringify({user:{id:owner}}),JSON.stringify({access_token:'a',refresh_token:'b',user:{id:'../x'}})])assert.equal(persistedOwner(raw),null);
});
