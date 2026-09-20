import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import packageJson from './package.json' with { type: 'json' }

// The commit being built: Cloudflare's build environments set one of these, else ask git.
function getBuildHash(): string {
  const sha = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return ''
  }
}

const buildHash = getBuildHash()
const buildDate = new Date().toISOString().split('T')[0]

// Writes dist/version.json so a running app can fetch it and tell when a newer build is deployed.
const versionManifestPlugin = (): Plugin => ({
  name: 'write-version-manifest',
  apply: 'build',
  closeBundle() {
    writeFileSync(
      resolve(import.meta.dirname, 'dist', 'version.json'),
      JSON.stringify({ version: packageJson.version, buildHash, buildDate }),
    )
  },
})

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_HASH__: JSON.stringify(buildHash),
  },
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
    versionManifestPlugin(),
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
