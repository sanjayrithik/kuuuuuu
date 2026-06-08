import { useState, useRef, useEffect } from 'react'
import { db } from '../lib/supabase'
import { sanitize, isValidCertId } from '../lib/security'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import { Spinner } from '../components/ui/Spinner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function TechTag({ tag }) {
  return (
    <span className="tag-chip">{tag.toUpperCase()}</span>
  )
}

function ScoreBar({ score }) {
  return (
    <div className="w-24 h-1 bg-[#444748] rounded-full overflow-hidden">
      <div
        className="bg-white h-full transition-all duration-700"
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  )
}

// ── Nav Dropdown ──────────────────────────────────────────────────────────────

function NavDropdown() {
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#2a2a2a] transition-all"
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[#8e9192] hover:text-white">account_circle</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 min-w-[160px] bg-[#1f1f1f] border border-[#444748] rounded-lg z-50 overflow-hidden shadow-xl"
          role="menu"
        >
          <a
            href="/projects"
            className="block px-4 py-3 text-sm text-[#8e9192] hover:text-white hover:bg-[#353535] font-mono tracking-widest uppercase transition-colors border-b border-[#444748]/30"
            role="menuitem"
          >
            Student Login
          </a>
          <a
            href="/admin"
            className="block px-4 py-3 text-sm text-[#8e9192] hover:text-white hover:bg-[#353535] font-mono tracking-widest uppercase transition-colors"
            role="menuitem"
          >
            Admin Login
          </a>
        </div>
      )}
    </div>
  )
}

// ── Certificate Dashboard ─────────────────────────────────────────────────────

function Dashboard({ student, onLogout }) {
  const projects = [
    { name: student.project_a_name, tech: student.project_a_tech, link: student.project_a_link },
    { name: student.project_b_name, tech: student.project_b_tech, link: student.project_b_link },
    { name: student.project_c_name, tech: student.project_c_tech, link: student.project_c_link },
  ].filter(p => p.name || p.link)

  const completionDate = student.completion_date
    ? new Date(student.completion_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Not set'

  const certUrl = student.certificate_url || null

  return (
    <div className="flex flex-col min-h-screen">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#131313] border-b border-[#444748]">
        <nav className="flex justify-between items-center w-full px-6 h-16 max-w-[1280px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[24px] font-bold tracking-tight text-white">RYHA</span>
            <span className="text-[#8e9192]">/</span>
            <span className="font-mono text-[12px] text-[#8e9192] uppercase tracking-widest">Credential Authenticated</span>
          </div>
          <button
            onClick={onLogout}
            className="btn-ghost"
            aria-label="Logout"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Logout
          </button>
        </nav>
      </header>

      <main className="flex-1 bg-[#131313] pt-24 px-6 pb-8">
        <div className="max-w-[1280px] mx-auto space-y-8">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">
                {student.name}
              </h1>
              <p className="text-[#8e9192]">
                Completion Date:{' '}
                <span className="text-white">{completionDate}</span>
              </p>
            </div>
            <div className="bg-[#1f1f1f] border border-[#444748] px-6 py-3 rounded-full flex items-center gap-3">
              <span className="verified-dot" />
              <span className="font-mono text-[12px] text-white tracking-widest">VERIFIED STATUS</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard label="STUDENT SCORE">
              <div className="flex items-end justify-between mt-4">
                <span className="text-[48px] font-bold text-white leading-none">
                  {student.score ?? 0}%
                </span>
                <ScoreBar score={student.score ?? 0} />
              </div>
            </MetricCard>

            <MetricCard label="PROJECTS COMPLETED">
              <div className="flex items-end justify-between mt-4">
                <span className="text-[48px] font-bold text-white leading-none">
                  {student.projects_count ?? 0}/3
                </span>
                <span className="material-symbols-outlined text-[#8e9192] text-[40px]">inventory_2</span>
              </div>
            </MetricCard>

            <MetricCard label="ATTENDANCE">
              <div className="flex items-end justify-between mt-4">
                <span className="text-[48px] font-bold text-white leading-none">
                  {student.attendance ?? 0}%
                </span>
                <span className="material-symbols-outlined text-[#8e9192] text-[40px]">event_available</span>
              </div>
            </MetricCard>
          </div>

          {/* Projects + Certificate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Projects Table */}
            <div className="lg:col-span-2 bg-[#1b1b1b] border border-[#444748] rounded-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#444748] flex justify-between items-center">
                <h3 className="font-mono text-[12px] text-white font-bold tracking-widest uppercase">Project Details</h3>
                <span className="material-symbols-outlined text-[#8e9192]">filter_list</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#1f1f1f]">
                    <tr className="font-mono text-[12px] text-[#8e9192]">
                      <th className="px-6 py-4 font-medium uppercase">Project Name</th>
                      <th className="px-6 py-4 font-medium uppercase">Technologies</th>
                      <th className="px-6 py-4 font-medium uppercase text-right">Github</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#444748]">
                    {projects.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-5 text-[#8e9192] text-center">
                          No projects submitted yet.
                        </td>
                      </tr>
                    ) : (
                      projects.map((p, i) => (
                        <ProjectRow key={i} project={p} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Certificate Download */}
            <div className="bg-[#1b1b1b] border border-[#444748] rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-mono text-[12px] text-white font-bold mb-4 uppercase tracking-widest">
                  Download Certificate
                </h3>
                <div className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-[#444748] bg-[#131313]">
                  <img
                    src="/sample.png"
                    alt="Certificate preview"
                    className="w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {certUrl ? (
                      <a
                        href={certUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-[#2f3131] px-6 py-2 rounded-full font-mono text-[12px] flex items-center gap-2 hover:opacity-90"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        DOWNLOAD PDF
                      </a>
                    ) : (
                      <span className="text-[#8e9192] font-mono text-[12px]">Not available</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center text-[#8e9192]">
                  <span className="font-mono text-[10px]">ISSUER</span>
                  <span className="font-mono text-[10px] text-white">RYHA TECHNOLOGIES</span>
                </div>
                <div className="flex justify-between items-center text-[#8e9192]">
                  <span className="font-mono text-[10px]">CERTIFICATE ID</span>
                  <span className="font-mono text-[10px] text-white">{student.student_id}</span>
                </div>
                {certUrl && (
                  <a
                    href={certUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-white hover:underline font-mono text-[12px] pt-2"
                  >
                    Download Certificate
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-[120px] border-t border-[#444748] py-8 w-full max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center font-mono text-[12px] text-[#8e9192] gap-4">
            <span className="text-white font-bold">RYHA</span>
            <span>© 2026 RYHA TECHNOLOGIES. ALL RIGHTS RESERVED.</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

function MetricCard({ label, children }) {
  return (
    <div className="bg-[#1b1b1b] border border-[#444748] p-4 rounded-2xl">
      <p className="font-mono text-[12px] text-[#8e9192] tracking-widest">{label}</p>
      {children}
    </div>
  )
}

function ProjectRow({ project: p }) {
  const [hovered, setHovered] = useState(false)
  const tags = (p.tech || '').split(',').map(t => t.trim()).filter(Boolean)

  return (
    <tr
      className="hover:bg-[#1f1f1f] transition-all"
      style={{ transform: hovered ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 0.2s ease-out' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td className="px-6 py-5 text-white">{p.name || '—'}</td>
      <td className="px-6 py-5">
        <div className="flex flex-wrap gap-1">
          {tags.length > 0 ? tags.map(t => <TechTag key={t} tag={t} />) : <span className="text-[#8e9192]">—</span>}
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        {p.link ? (
          <a
            href={p.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            Link
          </a>
        ) : (
          <span className="text-[#8e9192]">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Entry Form ────────────────────────────────────────────────────────────────

function EntryForm({ onVerified, showToast }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef(null)

  const flashError = (msg) => {
    setHasError(true)
    showToast(msg, 'error')
    setTimeout(() => setHasError(false), 2000)
  }

  const verify = async () => {
    const trimmed = sanitize(code)
    if (!trimmed) {
      flashError('Please enter your Certificate ID.')
      inputRef.current?.focus()
      return
    }
    if (!isValidCertId(trimmed)) {
      flashError('Invalid format. Expected: RYHA-2026-XXXX-XXXX')
      inputRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      const { data, error } = await db
        .from('students')
        .select('*')
        .eq('student_id', trimmed.toUpperCase())
        .maybeSingle()

      if (error || !data) {
        flashError('Certificate not found. Please check your ID.')
        return
      }
      onVerified(data)
    } catch {
      flashError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <nav className="flex justify-between items-center w-full px-6 h-16 max-w-[1280px] mx-auto">
          <span className="font-sans text-[24px] font-bold tracking-tight text-white">RYHA</span>
          <NavDropdown />
        </nav>
      </header>

      <div className="max-w-[540px] w-full mt-16">
        <div className="card p-8 text-center space-y-8">
          <div className="space-y-2">
            <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">
              Internship Certificate Verification
            </h1>
            <p className="text-[#8e9192]">Enter your unique credential ID to view student records.</p>
          </div>

          <div className="space-y-4 text-left">
            <div className="group">
              <label
                className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
                htmlFor="cert-id"
              >
                Unique Certificate Code
              </label>
              <input
                ref={inputRef}
                id="cert-id"
                className={`input-base ${hasError ? 'input-error' : ''}`}
                placeholder="RYHA-2026-XXXX-XXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && verify()}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                aria-label="Certificate ID"
                aria-invalid={hasError}
              />
            </div>

            <button
              className="btn-primary"
              onClick={verify}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <><Spinner /> Verifying...</>
              ) : (
                <>Verify Certificate <span className="material-symbols-outlined">arrow_forward</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page Root ─────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [student, setStudent] = useState(null)
  const { toasts, showToast } = useToast()

  const handleLogout = () => {
    setStudent(null)
  }

  return (
    <>
      <ToastContainer toasts={toasts} />
      {student ? (
        <Dashboard student={student} onLogout={handleLogout} />
      ) : (
        <EntryForm onVerified={setStudent} showToast={showToast} />
      )}
    </>
  )
}
