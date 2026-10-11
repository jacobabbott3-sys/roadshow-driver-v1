import { loadEnv } from 'vite'
import { validateNativeConfig } from './src/lib/nativeConfig'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'ios') {
    const error = validateNativeConfig({url: env.VITE_SUPABASE_URL || '', key: env.VITE_SUPABASE_ANON_KEY || '', channel: env.VITE_RELEASE_CHANNEL || '', version: env.VITE_RELEASE_VERSION || ''})
    if (error) throw new Error(error)
  }
  const branch = env.VERCEL_GIT_COMMIT_REF || ''
  const channel = env.VITE_RELEASE_CHANNEL || (branch === 'beta' ? 'beta' : 'public')
  const requestedVersion = env.VITE_RELEASE_VERSION || (channel === 'beta' ? '5A' : '5')
  const version = channel === 'public'
    ? requestedVersion.replace(/[^0-9.]/g, '') || '5'
    : requestedVersion.replace(/^v/i, '').toUpperCase()
  return {
    plugins: [
      // Native UI uses SF/system fonts; omit its otherwise blocking remote import.
      ...(mode === 'ios' ? [{
        name: 'native-system-fonts',
        enforce: 'pre' as const,
        transform(source: string, id: string) {
          if (!id.endsWith('/src/styles.css')) return;
          return source.replace(/^@import url\("https:\/\/fonts\.googleapis\.com[^\n]+\);\s*/, '');
        },
      }] : []),
      react(),
    ],
    build: { outDir: mode === 'ios' ? 'dist-ios' : 'dist' },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.tsx'],
      setupFiles: './src/test/setup.ts',
    },
    define: {
      __RELEASE_CHANNEL__: JSON.stringify(channel),
      __APP_VERSION__: JSON.stringify(version),
    },
  }
})
