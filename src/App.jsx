import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import VerifyPage from './pages/Verify'
import ProjectsPage from './pages/Projects'
import AdminPage from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VerifyPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
