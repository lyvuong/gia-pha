import { APP_VERSION, BUILD_HASH } from './version'

export interface UpdateCheckResult {
  hasUpdate: boolean
  latestVersion?: string
}

/**
 * Fetches the version manifest written at build time (see vite.config.ts), cache-busted so the
 * request reaches the network instead of the service worker's cache, and compares it with this
 * running build.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Version check failed (${res.status})`)
  const data = await res.json()
  const latestVersion: string | undefined = data.version
  const latestBuildHash: string | undefined = data.buildHash

  // The dev server serves a placeholder manifest (public/version.json); there is nothing to update to.
  if (latestVersion?.endsWith('-dev')) return { hasUpdate: false, latestVersion }

  // The git commit is the precise signal; the version number is the fallback for local builds
  // that have no commit hash.
  if (BUILD_HASH && latestBuildHash) return { hasUpdate: latestBuildHash !== BUILD_HASH, latestVersion }
  return { hasUpdate: !!latestVersion && latestVersion !== APP_VERSION, latestVersion }
}

/** Drops the installed service worker and its caches, then reloads to load the new build fresh. */
export async function installLatestVersion(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } finally {
    window.location.reload()
  }
}
