import { useState } from 'react'
import { db } from '../lib/supabase'
import { sanitize, isValidGithubUrl, checkRateLimit, recordFailedAttempt, clearRateLimit } from '../lib/security'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import { Spinner } from '../components/ui/Spinner'

// ── Project Field Group ───────────────────────────────────────────────────────

function ProjectFields({ label, values, onChange }) {
  return (
    <div className="bg-[#1f1f1f] border border-[#444748] p-4 rounded-2xl space-y-3">
      <h3 className="font-mono text-[12px] uppercase text-white font-bold tracking-widest">{label}</h3>
      <div className="space-y-3">
        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${label}-name`}
          >
            Project Name
          </label>
          <input
            id={`${label}-name`}
            className="input-base"
            placeholder="Enter project name"
            value={values.name}
            onChange={e => onChange('name', sanitize(e.target.value))}
            maxLength={120}
          />
        </div>

        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${label}-tech`}
          >
            Technologies Used
          </label>
          <input
            id={`${label}-tech`}
            className="input-base"
            placeholder="e.g., Python, React, Node.js"
            value={values.tech}
            onChange={e => onChange('tech', sanitize(e.target.value))}
            maxLength={200}
          />
        </div>

        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${label}-link`}
          >
            GitHub Link
          </label>
          <input
            id={`${label}-link`}
            className={`input-base ${values.link && !isValidGithubUrl(values.link) ? 'input-error' : ''}`}
            placeholder="https://github.com/....."
            value={values.link}
            onChange={e => onChange('link', e.target.value.trim())}
            type="url"
            maxLength={300}
            aria-describedby={`${label}-link-hint`}
          />
          {values.link && !isValidGithubUrl(values.link) && (
            <p id={`${label}-link-hint`} className="text-[#ffb4ab] font-mono text-[11px] mt-1 px-2">
              Must be a valid github.com URL
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Submission Dashboard ──────────────────────────────────────────────────────

function SubmissionDashboard({ studentDbId, initial, onLogout, showToast }) {
  const [projects, setProjects] = useState({
    a: { name: initial.project_a_name || '', tech: initial.project_a_tech || '', link: initial.project_a_link || '' },
    b: { name: initial.project_b_name || '', tech: initial.project_b_tech || '', link: initial.project_b_link || '' },
    c: { name: initial.project_c_name || '', tech: initial.project_c_tech || '', link: initial.project_c_link || '' },
  })
  const [saving, setSaving] = useState(false)

  const update = (key, field, value) => {
    setProjects(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const hasAtLeastOneLink = projects.a.link || projects.b.link || projects.c.link

  // Validate all entered links
  const linksValid = [projects.a.link, projects.b.link, projects.c.link]
    .every(l => isValidGithubUrl(l))

  const save = async () => {
    if (!hasAtLeastOneLink) {
      showToast('Enter at least one GitHub link.', 'error')
      return
    }
    if (!linksValid) {
      showToast('Fix invalid GitHub URLs before saving.', 'error')
      return
    }

    setSaving(true)
    try {
      const { error } = await db.from('students').update({
        project_a_name: projects.a.name,
        project_a_tech: projects.a.tech,
        project_a_link: projects.a.link,
        project_b_name: projects.b.name,
        project_b_tech: projects.b.tech,
        project_b_link: projects.b.link,
        project_c_name: projects.c.name,
        project_c_tech: projects.c.tech,
        project_c_link: projects.c.link,
      }).eq('id', studentDbId)

      if (error) {
        showToast('Save failed: ' + error.message, 'error')
      } else {
        showToast('Projects saved successfully!', 'success')
      }
    } catch {
      showToast('Connection error. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#131313] border-b border-[#444748]">
        <nav className="flex justify-between items-center w-full px-6 h-16 max-w-[1280px] mx-auto">
          <span className="font-sans text-[24px] font-bold tracking-tight text-white">RYHA</span>
          <button onClick={onLogout} className="btn-ghost" aria-label="Logout">
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Logout
          </button>
        </nav>
      </header>

      <div className="flex items-center justify-center min-h-screen px-6 pt-16">
        <div className="max-w-[640px] w-full">
          <div className="card p-8 space-y-8">
            <div className="text-center space-y-2">
              <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">
                Submit Your Project Links
              </h1>
              <p className="text-[#8e9192]">Upload your GitHub repository links for each project below.</p>
            </div>

            <div className="space-y-4">
              <ProjectFields
                label="Project A"
                values={projects.a}
                onChange={(f, v) => update('a', f, v)}
              />
              <ProjectFields
                label="Project B"
                values={projects.b}
                onChange={(f, v) => update('b', f, v)}
              />
              <ProjectFields
                label="Project C"
                values={projects.c}
                onChange={(f, v) => update('c', f, v)}
              />

              <button
                className="btn-primary mt-8"
                onClick={save}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? (
                  <><Spinner /> Saving...</>
                ) : (
                  <>Save Projects <span className="material-symbols-outlined">save</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#444748] py-8 w-full max-w-[1280px] mx-auto px-6 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center font-mono text-[12px] text-[#8e9192] gap-4">
          <span className="text-white font-bold">RYHA</span>
          <span>© 2026 RYHA TECHNOLOGIES. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>
    </div>
  )
}

// ── Login Form ────────────────────────────────────────────────────────────────

function LoginForm({ onLogin, showToast }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const RATE_KEY = 'student_login'

  const flashError = (msg) => {
    setHasError(true)
    showToast(msg, 'error')
    setTimeout(() => setHasError(false), 2000)
  }

  const login = async () => {
    const u = sanitize(username)
    const p = password.trim()

    if (!u || !p) {
      flashError('Please enter your Student ID and Password.')
      return
    }

    // Rate limit check
    const rl = checkRateLimit(RATE_KEY)
    if (!rl.allowed) {
      flashError(`Too many attempts. Try again in ${rl.secsLeft}s.`)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await db
        .from('students')
        .select('id, username, password, project_a_name, project_a_tech, project_a_link, project_b_name, project_b_tech, project_b_link, project_c_name, project_c_tech, project_c_link')
        .eq('username', u)
        .maybeSingle()

      if (error || !data || data.password !== p) {
        recordFailedAttempt(RATE_KEY)
        flashError('Invalid credentials.')
        return
      }

      clearRateLimit(RATE_KEY)
      onLogin(data)
    } catch {
      flashError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <header className="fixed top-0 left-0 right-0 z-50">
        <nav className="flex justify-between items-center w-full px-6 h-16 max-w-[1280px] mx-auto">
          <span className="font-sans text-[24px] font-bold tracking-tight text-white">RYHA</span>
        </nav>
      </header>

      <div className="max-w-[540px] w-full mt-16">
        <div className="card p-8 text-center space-y-8">
          <div className="space-y-2">
            <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">Student Login</h1>
            <p className="text-[#8e9192]">Enter your credentials to access the project submission portal.</p>
          </div>

          <div className="space-y-4 text-left">
            <div className="group">
              <label
                className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
                htmlFor="student-id"
              >
                Username
              </label>
              <input
                id="student-id"
                className={`input-base ${hasError ? 'input-error' : ''}`}
                placeholder="Enter your Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                autoComplete="username"
                maxLength={80}
                aria-invalid={hasError}
              />
            </div>

            <div className="group">
              <label
                className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                className={`input-base ${hasError ? 'input-error' : ''}`}
                placeholder="Enter your Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                type="password"
                autoComplete="current-password"
                maxLength={100}
                aria-invalid={hasError}
              />
            </div>

            <button
              className="btn-primary"
              onClick={login}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <><Spinner /> Logging in...</>
              ) : (
                <>Login <span className="material-symbols-outlined">arrow_forward</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page Root ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [session, setSession] = useState(null) // { id, ...studentData }
  const { toasts, showToast } = useToast()

  const handleLogin = (data) => setSession(data)

  const handleLogout = () => setSession(null)

  return (
    <>
      <ToastContainer toasts={toasts} />
      {session ? (
        <SubmissionDashboard
          studentDbId={session.id}
          initial={session}
          onLogout={handleLogout}
          showToast={showToast}
        />
      ) : (
        <LoginForm onLogin={handleLogin} showToast={showToast} />
      )}
    </>
  )
}
