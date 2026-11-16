import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const [name, factory, flags] of [
  ['admin-accounts', 'createAccountEndpoint', ['ACCOUNT_MANAGEMENT_ENABLED', 'ACCOUNT_MAIL_ENABLED']],
  ['contract-notices', 'createContractNoticeEndpoint', ['CONTRACT_NOTICE_ENABLED', 'CONTRACT_NOTICE_MAIL_ENABLED']],
] as const) {
  test(`${name} delegates activation to default-off endpoint environment gates`, () => {
    const source = readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8')
      .replace(/^import .*;\n/gm, '');
    for (const value of [undefined, 'false', 'true']) {
      let served = false;
      vm.runInNewContext(source, {
        Deno: { env: { get: () => value }, serve: () => { served = true; } },
        createClient: () => { throw new Error('Entrypoint must not eagerly create a privileged client'); },
        [factory]: (getEnv: (name: string) => string | undefined) => {
          for (const flag of flags) assert.equal(getEnv(flag), value);
          return () => undefined;
        },
      });
      assert.equal(served, true);
    }
  });
}
