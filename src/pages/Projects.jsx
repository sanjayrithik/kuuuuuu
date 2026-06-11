import { useState } from 'react'
import { db } from '../lib/supabase'
import { sanitize, isValidGithubUrl, checkRateLimit, recordFailedAttempt, clearRateLimit } from '../lib/security'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import { Spinner } from '../components/ui/Spinner'

const nullify = (v) => (v && v.trim() !== '' ? v.trim() : null)

// ── Project Card (independent save) ──────────────────────────────────────────

function ProjectCard({ projectKey, label, dbPrefix, initial, studentDbId, showToast }) {
  const [fields, setFields] = useState({
    name: initial[`${dbPrefix}_name`] || '',
    tech: initial[`${dbPrefix}_tech`] || '',
    link: initial[`${dbPrefix}_link`] || '',
  })
  const [saving, setSaving] = useState(false)
  // submitted = row already exists in DB for this project
  const [submitted, setSubmitted] = useState(!!initial[`${dbPrefix}_link`])

  const update = (field, value) => {
    setFields(prev => ({ ...prev, [field]: value }))
  }

  const linkInvalid = fields.link && !isValidGithubUrl(fields.link)

  const save = async () => {
    if (!fields.link || fields.link.trim() === '') {
      showToast(`${label}: GitHub link is required.`, 'error')
      return
    }
    if (linkInvalid) {
      showToast(`${label}: Fix the GitHub URL before saving.`, 'error')
      return
    }

    setSaving(true)
    try {
      const { error } = await db.from('students').update({
        [`${dbPrefix}_name`]: nullify(fields.name),
        [`${dbPrefix}_tech`]: nullify(fields.tech),
        [`${dbPrefix}_link`]: nullify(fields.link),
      }).eq('id', studentDbId)

      if (error) {
        showToast(`${label} save failed: ` + error.message, 'error')
      } else {
        setSubmitted(true)
        showToast(`${label} submitted successfully!`, 'success')
      }
    } catch {
      showToast('Connection error. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`bg-[#1f1f1f] border rounded-2xl p-5 space-y-4 transition-all ${
      submitted ? 'border-[#00FF00]/40' : 'border-[#444748]'
    }`}>
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] uppercase text-white font-bold tracking-widest">{label}</span>
          {submitted && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-[#00FF00] tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF00] inline-block" style={{ boxShadow: '0 0 6px #00FF00' }} />
              SUBMITTED
            </span>
          )}
        </div>
        {submitted && (
          <span className="material-symbols-outlined text-[#00FF00] text-[18px]">check_circle</span>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${projectKey}-name`}
          >
            Project Name
          </label>
          <input
            id={`${projectKey}-name`}
            className="input-base"
            placeholder="Enter project name"
            value={fields.name}
            onChange={e => update('name', sanitize(e.target.value))}
            maxLength={120}
          />
        </div>

        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${projectKey}-tech`}
          >
            Technologies Used
          </label>
          <input
            id={`${projectKey}-tech`}
            className="input-base"
            placeholder="e.g., Python, React, Node.js"
            value={fields.tech}
            onChange={e => update('tech', sanitize(e.target.value))}
            maxLength={200}
          />
        </div>

        <div className="group">
          <label
            className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest"
            htmlFor={`${projectKey}-link`}
          >
            GitHub Link <span className="text-[#ffb4ab]">*</span>
          </label>
          <input
            id={`${projectKey}-link`}
            className={`input-base ${linkInvalid ? 'input-error' : ''}`}
            placeholder="https://github.com/....."
            value={fields.link}
            onChange={e => update('link', e.target.value.trim())}
            type="url"
            maxLength={300}
            aria-describedby={`${projectKey}-link-hint`}
          />
          {linkInvalid && (
            <p id={`${projectKey}-link-hint`} className="text-[#ffb4ab] font-mono text-[11px] mt-1 px-2">
              Must be a valid github.com URL
            </p>
          )}
        </div>
      </div>

      {/* Submit button for this project */}
      <button
        className={`w-full py-3 rounded-full font-mono text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
          submitted
            ? 'bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/30 hover:bg-[#00FF00]/20'
            : 'bg-white text-[#2f3131] hover:opacity-90'
        }`}
        onClick={save}
        disabled={saving}
        aria-busy={saving}
      >
        {saving ? (
          <><Spinner /> Saving...</>
        ) : submitted ? (
          <><span className="material-symbols-outlined text-[16px]">edit</span> Update {label}</>
        ) : (
          <><span className="material-symbols-outlined text-[16px]">upload</span> Submit {label}</>
        )}
      </button>
    </div>
  )
}

// ── Submission Dashboard ──────────────────────────────────────────────────────

function SubmissionDashboard({ studentDbId, initial, onLogout, showToast }) {
  const submittedCount = [
    initial.project_a_link,
    initial.project_b_link,
    initial.project_c_link,
  ].filter(Boolean).length

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

      <div className="flex items-center justify-center min-h-screen px-6 pt-16 pb-8">
        <div className="max-w-[640px] w-full">
          <div className="card p-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">
                Submit Your Projects
              </h1>
              <p className="text-[#8e9192]">
                Each project is submitted independently — submit whenever you're ready.
              </p>
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-2 pt-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`h-1 w-16 rounded-full transition-all ${
                      i < submittedCount ? 'bg-[#00FF00]' : 'bg-[#444748]'
                    }`}
                  />
                ))}
                <span className="font-mono text-[11px] text-[#8e9192] ml-2">
                  {submittedCount}/3 submitted
                </span>
              </div>
            </div>

            {/* Three independent project cards */}
            <div className="space-y-4">
              <ProjectCard
                projectKey="proj-a"
                label="Project A"
                dbPrefix="project_a"
                initial={initial}
                studentDbId={studentDbId}
                showToast={showToast}
              />
              <ProjectCard
                projectKey="proj-b"
                label="Project B"
                dbPrefix="project_b"
                initial={initial}
                studentDbId={studentDbId}
                showToast={showToast}
              />
              <ProjectCard
                projectKey="proj-c"
                label="Project C"
                dbPrefix="project_c"
                initial={initial}
                studentDbId={studentDbId}
                showToast={showToast}
              />
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
