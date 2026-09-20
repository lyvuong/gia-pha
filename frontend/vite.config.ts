import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // Vendor code is split out so app changes don't re-download it, and so each chunk stays small.
    // The PDF export chunk (jsPDF + its fonts) is still large, but it loads only when someone
    // clicks Export, so the limit is raised just above it rather than the warning being ignored.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\/](@firebase|firebase)[\/]/ },
            { name: 'flow', test: /node_modules[\/](@xyflow|d3-[^\/]+|zustand)[\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.ico', 'icons/favicon-16x16.png', 'icons/favicon-32x32.png'],
      manifest: {
        name: 'Gia Phả',
        short_name: 'Gia Phả',
        description: 'Sổ gia phả gia đình — cây phả hệ và lịch sử dòng họ',
        start_url: '/',
        display: 'standalone',
        background_color: '#5C121E',
        theme_color: '#7A1A27',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
