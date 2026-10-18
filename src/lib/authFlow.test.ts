import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordFlow, passwordRecoveryRedirect } from './authFlow.ts';

test('recovery uses exact stable beta and production callbacks', () => {
  assert.equal(passwordRecoveryRedirect('https://beta.roadshowdriver.com'), 'https://beta.roadshowdriver.com/update-password');
  for (const origin of ['https://roadshowdriver.com', 'https://www.roadshowdriver.com']) {
    assert.equal(passwordRecoveryRedirect(origin), 'https://www.roadshowdriver.com/update-password');
  }
});
test('temporary and deceptive origins cannot initiate recovery', () => {
  for (const origin of ['http://localhost:5173', 'https://preview.vercel.app', 'https://beta.roadshowdriver.com.evil.test', 'https://evil.test', 'http://beta.roadshowdriver.com', 'https://beta.roadshowdriver.com:8443', '']) {
    assert.throws(() => passwordRecoveryRedirect(origin));
  }
});
test('only explicit invitation and recovery types enter password setup', () => {
  assert.equal(passwordFlow('invite'), 'invite');
  assert.equal(passwordFlow('recovery'), 'recovery');
  for (const type of [null, '', 'signup', 'email_change', 'magiclink', 'RECOVERY']) assert.equal(passwordFlow(type), null);
});
