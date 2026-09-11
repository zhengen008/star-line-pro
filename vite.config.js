import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    // 监听所有网卡（0.0.0.0），允许局域网内其他设备访问
    host: true,
    port: 5173,
    proxy: {
      // 用 127.0.0.1 避免 localhost 在 node 22 下解析为 ::1 带来的代理连接问题
      '/api': 'http://127.0.0.1:3001',
      '/uploads': 'http://127.0.0.1:3001',
    },
  },
});
