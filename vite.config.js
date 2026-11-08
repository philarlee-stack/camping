import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중에는 vite(5173)가 /socket.io 요청을 멀티플레이 서버(3001)로 프록시합니다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
})
