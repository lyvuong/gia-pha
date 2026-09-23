import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppFooter } from './components/common/AppFooter'
import { LanguageInUrl } from './components/common/LanguageInUrl'
import { AboutPage } from './pages/AboutPage'
import { JoinPage } from './pages/JoinPage'
import { RootPage } from './pages/RootPage'

// The tree view (chart library, layout, editing panels) is the heaviest part of the app, and
// signed-out visitors never need it, so it loads only when someone opens a tree.
const TreePage = lazy(() => import('./pages/TreePage').then((m) => ({ default: m.TreePage })))

export function App() {
  return (
    <BrowserRouter>
      <LanguageInUrl />
      <div className="app-shell">
        <main className="app-main">
          <Suspense fallback={<p className="page-status">…</p>}>
            <Routes>
              <Route path="/" element={<RootPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/tree/:giaPhaId" element={<TreePage />} />
            </Routes>
          </Suspense>
        </main>
        <AppFooter />
      </div>
    </BrowserRouter>
  )
}
