import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';

export default defineConfig({
  base: '/Jianghu/',
  build: {
    sourcemap: 'hidden',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        secure: true,
        timeout: 120000,
      },
      '/api/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        secure: true,
        timeout: 120000,
      },
      '/api/glm': {
        target: 'https://open.bigmodel.cn/api/paas/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/glm/, ''),
        secure: true,
        timeout: 120000,
      },
      '/api/qwen': {
        target: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, ''),
        secure: true,
        timeout: 120000,
      },
    },
  },
})
