import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNativeConfig } from './nativeConfig.ts';
const url = 'https://myraoovepjwhkafzdppq.supabase.co';
const jwt = (role = 'anon', ref = 'myraoovepjwhkafzdppq') => `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({role,ref})).toString('base64url')}.fixture_signature`;
const good = { url, key: jwt(), channel: 'public', version: '5' };
test('accepts public client configuration', () => {
  assert.equal(validateNativeConfig(good), null);
  assert.equal(validateNativeConfig({...good,key:'sb_publishable_fixture'}),null);
});
test('rejects wrong, malformed and credential-bearing origins', () => {
  for(const value of ['', 'https://exsquwjtqnirojntoxqv.supabase.co',`${url}.evil.test`,url.replace('https:','http:'),url.replace('https://','https://user:pass@'),`${url}/path`,`${url}?foo=bar`]) {
    assert.ok(validateNativeConfig({...good,url:value}),value);
  }
});
test('rejects missing, privileged, malformed or wrong-project keys without leaking them', () => {
  for(const key of ['', 'sb_secret_do_not_print', 'invalid',jwt('service_role'),jwt('anon','other'),'eyJ.eyJ.foo']) {
    const error=validateNativeConfig({...good,key}); assert.ok(error); if(key) assert.ok(!error.includes(key));
  }
});
test('requires explicit Public 5 labeling',()=>{
  for(const update of [{channel:'beta'},{channel:''},{version:'5A'},{version:''}]) assert.ok(validateNativeConfig({...good,...update}));
});
