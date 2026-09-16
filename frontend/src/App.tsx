import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { JoinPage } from './pages/JoinPage'
import { RootPage } from './pages/RootPage'
import { TreePage } from './pages/TreePage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/tree/:giaPhaId" element={<TreePage />} />
      </Routes>
    </BrowserRouter>
  )
}
