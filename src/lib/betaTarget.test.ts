import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBetaBuildTarget, betaSupabaseUrl, browserTargetAllowed } from './betaTarget.ts';
test('beta build accepts only existing test project, regardless of channel override',()=>{
 for(const url of [undefined,'','https://myraoovepjwhkafzdppq.supabase.co','https://another.supabase.co'])assert.throws(()=>assertBetaBuildTarget('beta','public',url));
 assert.doesNotThrow(()=>assertBetaBuildTarget('beta','beta',betaSupabaseUrl));assert.throws(()=>assertBetaBuildTarget('feature','beta',undefined));
});
test('public build unchanged; stable beta browser refuses non-test backend',()=>{
 assert.doesNotThrow(()=>assertBetaBuildTarget('main','public','https://myraoovepjwhkafzdppq.supabase.co'));
 assert.equal(browserTargetAllowed('beta.roadshowdriver.com','https://myraoovepjwhkafzdppq.supabase.co'),false);
 assert.equal(browserTargetAllowed('beta.roadshowdriver.com',betaSupabaseUrl),true);
 assert.equal(browserTargetAllowed('roadshowdriver.com','https://myraoovepjwhkafzdppq.supabase.co'),true);
});
