import { loadEnv } from 'vite';
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runIosBuild } from './ios-build-pipeline.mjs';
const env = loadEnv('ios', process.cwd(), 'VITE_');
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('iPhone build step failed. No new app was synchronized.');
}
try {
  await runIosBuild({
    config: {url:env.VITE_SUPABASE_URL || '',key:env.VITE_SUPABASE_ANON_KEY || '',channel:env.VITE_RELEASE_CHANNEL || '',version:env.VITE_RELEASE_VERSION || ''},
    clean: () => rm('dist-ios', {recursive:true,force:true}),
    build: async () => {
      run('node_modules/typescript/bin/tsc',['-b']);
      run('node_modules/vite/bin/vite.js',['build','--mode','ios']);
    },
    sync: async () => { if (!process.argv.includes('--build-only')) run('node_modules/@capacitor/cli/bin/capacitor',['sync','ios']); },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to prepare the iPhone app.');
  process.exitCode = 1;
}
