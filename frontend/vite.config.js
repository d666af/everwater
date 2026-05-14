import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env, .env.local etc. so VITE_MOCK is available here
  const env = loadEnv(mode, process.cwd(), '')
  const isMock = env.VITE_MOCK === 'true'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // When VITE_MOCK=true — skip proxy entirely, no ECONNREFUSED logs
      proxy: isMock ? undefined : {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'backend_unavailable' }))
              }
            })
          },
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  }
})
