// Bumps the minor version in frontend/package.json (1.4.0 -> 1.5.0). Run by the pre-commit hook
// in .githooks/, so every commit gets a new version that the About page and footer show.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json')

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const current = pkg.version || '1.0.0'
  const [major, minor] = current.split('.').map(Number)
  const next = `${Number.isNaN(major) ? 1 : major}.${(Number.isNaN(minor) ? 0 : minor) + 1}.0`
  pkg.version = next
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`Version bumped: ${current} -> ${next}`)
} catch (err) {
  console.error('Failed to bump version:', err)
  process.exit(1)
}
