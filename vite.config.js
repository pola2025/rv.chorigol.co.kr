import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/airtable': {
        target: 'https://api.airtable.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/airtable/, '')
      }
    }
  },
  build: {
    // 빌드 시 파일명에 해시 추가 (캐시 방지)
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    },
    // 청크 크기 경고 한계 증가
    chunkSizeWarningLimit: 1000
  },
  // 빌드 시 콘솔 로그 제거
  esbuild: {
    drop: ['console', 'debugger']
  }
})
