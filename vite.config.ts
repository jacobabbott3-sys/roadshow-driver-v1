import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const branch = env.VERCEL_GIT_COMMIT_REF || ''
  const channel = env.VITE_RELEASE_CHANNEL || (branch === 'beta' ? 'beta' : 'public')
  const requestedVersion = env.VITE_RELEASE_VERSION || (channel === 'beta' ? '4' : '3')
  const version = channel === 'public'
    ? requestedVersion.replace(/[^0-9.]/g, '') || '3'
    : requestedVersion.replace(/^v/i, '')
  return {
    plugins: [react()],
    define: {
      __RELEASE_CHANNEL__: JSON.stringify(channel),
      __APP_VERSION__: JSON.stringify(version),
    },
  }
})
