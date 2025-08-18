import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001
  },
  resolve: {
    alias: {
      '@stock-chart': path.resolve(__dirname, '../../src')
    }
  },
  base: './'
})