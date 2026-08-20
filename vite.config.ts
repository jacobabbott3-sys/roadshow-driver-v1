import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const branch = env.VERCEL_GIT_COMMIT_REF || ''
  const channel = env.VITE_RELEASE_CHANNEL || (branch === 'beta' ? 'beta' : 'public')
  const version = env.VITE_RELEASE_VERSION || (channel === 'beta' ? 'v3b' : 'v3')
  return {
    plugins: [react()],
    define: {
      __RELEASE_CHANNEL__: JSON.stringify(channel),
      __APP_VERSION__: JSON.stringify(version),
    },
  }
})
