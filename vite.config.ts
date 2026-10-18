import { assertBetaBuildTarget } from './src/lib/betaTarget'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const branch = env.VERCEL_GIT_COMMIT_REF || ''
  const channel = env.VITE_RELEASE_CHANNEL || (branch === 'beta' ? 'beta' : 'public')
  if (command === 'build') assertBetaBuildTarget(branch, channel, env.VITE_SUPABASE_URL)
  const requestedVersion = env.VITE_RELEASE_VERSION || (channel === 'beta' ? '6A' : '5')
  const version = channel === 'public'
    ? requestedVersion.replace(/[^0-9.]/g, '') || '5'
    : requestedVersion.replace(/^v/i, '').toUpperCase()
  return {
    plugins: [react()],
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
