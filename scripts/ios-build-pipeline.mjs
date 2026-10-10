import { validateNativeConfig } from '../src/lib/nativeConfig.ts';
export async function runIosBuild({ config, clean, build, sync }) {
  const error = validateNativeConfig(config);
  if (error) throw new Error(error);
  await clean();
  await build();
  await sync();
}
