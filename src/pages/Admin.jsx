import { useState, useCallback, useEffect } from 'react'
import { db } from '../lib/supabase'
import {
  sanitize,
  generateStudentId,
  generatePassword,
  generateUsername,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from '../lib/security'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'

// ── New Student Modal ─────────────────────────────────────────────────────────

function NewStudentModal({ open, onClose, onCreated, showToast }) {
  const [fullName, setFullName] = useState('')
  const [username] = useState(() => '')
  const [loading, setLoading] = useState(false)

  // Derived auto-generated fields
  const genUsername = fullName.trim() ? generateUsername(fullName) : ''
  const genPassword = fullName.trim() ? generatePassword() : ''
  const genId = fullName.trim() ? generateStudentId() : ''

  const handleCreate = async () => {
    const name = sanitize(fullName)
    if (!name) {
      showToast('Please enter the student full name.', 'error')
      return
    }

    // Generate fresh values at creation time
    const uname = generateUsername(name)
    const pwd = generatePassword()
    const sid = generateStudentId()

    setLoading(true)
    try {
      const { data, error } = await db.from('students').insert({
        name,
        username: uname,
        password: pwd,
        student_id: sid,
        score: 0,
        projects_count: 0,
        attendance: 0,
      }).select().single()

      if (error) {
        showToast('Failed to create student: ' + error.message, 'error')
        return
      }

      showToast('Student created successfully!', 'success')
      onCreated(data)
      setFullName('')
      onClose()
    } catch {
      showToast('Connection error.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Student">
      <div className="space-y-4">
        <div className="group">
          <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] tracking-widest" htmlFor="new-name">
            Full Name
          </label>
          <input
            id="new-name"
            className="input-base"
            placeholder="Enter student's full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={120}
            autoFocus
          />
        </div>

        {fullName.trim() && (
          <div className="bg-[#1f1f1f] border border-[#444748] rounded-2xl p-4 space-y-3">
            <p className="font-mono text-[10px] text-[#8e9192] uppercase tracking-widest">Auto-generated credentials</p>
            <InfoRow label="Username" value={genUsername} />
            <InfoRow label="Password" value={genPassword} />
            <InfoRow label="Student ID" value={genId} />
            <p className="font-mono text-[10px] text-[#8e9192]">
              ⚠ Final values will be generated on Create. Copy them after creation from the edit modal.
            </p>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            className="flex-1 bg-[#2a2a2a] text-[#8e9192] border border-[#444748] py-3 rounded-full font-mono text-[12px] hover:bg-[#353535] transition-all"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 bg-white text-[#2f3131] py-3 rounded-full font-mono text-[12px] hover:opacity-90 transition-all flex items-center justify-center gap-2"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? <Spinner /> : null}
            Create
          </button>
        </div>
      </div>
    </Modal>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] text-[#8e9192] uppercase">{label}</span>
      <span className="font-mono text-[11px] text-white">{value}</span>
    </div>
  )
}

// ── Edit Student Modal ────────────────────────────────────────────────────────

function EditStudentModal({ open, onClose, student, onSaved, onDeleted, showToast }) {
  const [form, setForm] = useState({})
  const [certFile, setCertFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync form whenever the student prop changes (new student opened)
  useEffect(() => {
    if (student) setForm({ ...student })
    setCertFile(null)
  }, [student])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  if (!student) return null

  // Build from fresh student prop whenever modal opens
  const s = { ...student, ...form }

  const handleSave = async () => {
    const name = sanitize(s.name)
    if (!name) { showToast('Name is required.', 'error'); return }

    setSaving(true)
    try {
      let certUrl = s.certificate_url

      // Upload certificate if a file was chosen
      if (certFile) {
        const filePath = `${s.student_id}/${Date.now()}_${certFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: uploadError } = await db.storage
          .from('certificates')
          .upload(filePath, certFile, { upsert: true, contentType: certFile.type })

        if (uploadError) {
          showToast('Certificate upload failed: ' + uploadError.message, 'error')
          setSaving(false)
          return
        }

        const { data: urlData } = db.storage.from('certificates').getPublicUrl(filePath)
        certUrl = urlData.publicUrl
      }

      const { data, error } = await db.from('students').update({
        name: sanitize(s.name),
        username: sanitize(s.username),
        password: s.password,
        student_id: sanitize(s.student_id),
        completion_date: s.completion_date || null,
        score: Number(s.score) || 0,
        projects_count: Number(s.projects_count) || 0,
        attendance: Number(s.attendance) || 0,
        certificate_url: certUrl,
      }).eq('id', s.id).select().single()

      if (error) {
        showToast('Save failed: ' + error.message, 'error')
        return
      }

      showToast('Student saved!', 'success')
      onSaved(data)
      setCertFile(null)
      onClose()
    } catch {
      showToast('Connection error.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete student "${s.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const { error } = await db.from('students').delete().eq('id', s.id)
      if (error) { showToast('Delete failed: ' + error.message, 'error'); return }
      showToast('Student deleted.', 'success')
      onDeleted(s.id)
      onClose()
    } catch {
      showToast('Connection error.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const projectRows = [
    { label: 'Project A', name: s.project_a_name, tech: s.project_a_tech, link: s.project_a_link },
    { label: 'Project B', name: s.project_b_name, tech: s.project_b_tech, link: s.project_b_link },
    { label: 'Project C', name: s.project_c_name, tech: s.project_c_tech, link: s.project_c_link },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Edit Student Profile" maxWidth="max-w-4xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Basic Info + Metrics */}
        <div className="space-y-4">
          <h3 className="font-mono text-[12px] text-white font-bold uppercase tracking-widest">Basic Information</h3>

          {[
            { id: 'edit-name', label: 'Full Name', key: 'name', type: 'text' },
            { id: 'edit-username', label: 'Username', key: 'username', type: 'text' },
            { id: 'edit-password', label: 'Password', key: 'password', type: 'text' },
            { id: 'edit-sid', label: 'Student ID', key: 'student_id', type: 'text' },
            { id: 'edit-date', label: 'Completion Date', key: 'completion_date', type: 'date' },
          ].map(f => (
            <div key={f.key} className="group">
              <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] tracking-widest" htmlFor={f.id}>
                {f.label}
              </label>
              <input
                id={f.id}
                className="input-base"
                type={f.type}
                value={s[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
                maxLength={f.key === 'password' ? 100 : 120}
              />
            </div>
          ))}

          <h3 className="font-mono text-[12px] text-white font-bold uppercase tracking-widest pt-4">Academic Metrics</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'edit-score', label: 'Score (%)', key: 'score', max: 100 },
              { id: 'edit-projects', label: 'Projects', key: 'projects_count', max: 3 },
              { id: 'edit-attendance', label: 'Attendance (%)', key: 'attendance', max: 100 },
            ].map(f => (
              <div key={f.key} className="group">
                <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] tracking-widest" htmlFor={f.id}>
                  {f.label}
                </label>
                <input
                  id={f.id}
                  className="input-base px-4 py-3"
                  type="number"
                  min={0}
                  max={f.max}
                  value={s[f.key] ?? 0}
                  onChange={e => setField(f.key, Math.min(f.max, Math.max(0, Number(e.target.value))))}
                />
              </div>
            ))}
          </div>

          {/* Certificate Upload */}
          <div className="group">
            <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] tracking-widest" htmlFor="edit-cert">
              Certificate Upload
            </label>
            <input
              id="edit-cert"
              className="w-full bg-[#2a2a2a] border border-[#444748] rounded-2xl px-6 py-4 text-white font-mono text-[12px]
                         file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium
                         file:bg-white file:text-[#2f3131] hover:file:opacity-90"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setCertFile(e.target.files[0] || null)}
            />
            {s.certificate_url && !certFile && (
              <p className="font-mono text-[10px] text-[#8e9192] mt-1 px-2">
                Current: <a href={s.certificate_url} target="_blank" rel="noopener noreferrer" className="text-white underline">View</a>
              </p>
            )}
            {certFile && (
              <p className="font-mono text-[10px] text-white mt-1 px-2">New file: {certFile.name}</p>
            )}
          </div>
        </div>

        {/* Right: Project Review */}
        <div className="space-y-4">
          <h3 className="font-mono text-[12px] text-white font-bold uppercase tracking-widest">Project Review</h3>
          <div className="bg-[#1f1f1f] border border-[#444748] rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#2a2a2a]">
                <tr className="font-mono text-[10px] text-[#8e9192]">
                  <th className="px-4 py-3 uppercase">Project</th>
                  <th className="px-4 py-3 uppercase">Technologies</th>
                  <th className="px-4 py-3 uppercase">GitHub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#444748] text-sm">
                {projectRows.map(p => (
                  <tr key={p.label}>
                    <td className="px-4 py-3 text-white font-mono text-[11px]">{p.label}</td>
                    <td className="px-4 py-3 text-[#8e9192] font-mono text-[11px]">{p.tech || '—'}</td>
                    <td className="px-4 py-3">
                      {p.link ? (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white hover:underline font-mono text-[11px]"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-[#8e9192] font-mono text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Credentials panel */}
          <div className="bg-[#1f1f1f] border border-[#444748] rounded-2xl p-4 space-y-2">
            <p className="font-mono text-[10px] text-[#8e9192] uppercase tracking-widest mb-3">Student Credentials</p>
            <CredentialRow label="Username" value={s.username} />
            <CredentialRow label="Password" value={s.password} />
            <CredentialRow label="Student ID" value={s.student_id} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6 mt-6 border-t border-[#444748]">
        <button
          className="flex-1 bg-[#2a2a2a] text-[#8e9192] border border-[#444748] py-3 rounded-full font-mono text-[12px] hover:bg-[#353535] transition-all"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="flex-1 bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 py-3 rounded-full font-mono text-[12px] hover:bg-[#ffb4ab]/30 transition-all flex items-center justify-center gap-2"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Spinner /> : null}
          Delete
        </button>
        <button
          className="flex-1 bg-white text-[#2f3131] py-3 rounded-full font-mono text-[12px] hover:opacity-90 transition-all flex items-center justify-center gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Spinner /> : null}
          Save
        </button>
      </div>
    </Modal>
  )
}

function CredentialRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] text-[#8e9192] uppercase">{label}</span>
      <span className="font-mono text-[11px] text-white">{value || '—'}</span>
    </div>
  )
}

// ── Students Table Row ────────────────────────────────────────────────────────

function StudentRow({ student, onEdit }) {
  const completion = student.completion_date
    ? new Date(student.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  return (
    <tr className="hover:bg-[#1f1f1f] transition-colors">
      <td className="px-6 py-4 text-white font-medium">{student.name}</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{student.username}</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{student.student_id}</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{completion}</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{student.score ?? 0}%</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{student.projects_count ?? 0}/3</td>
      <td className="px-6 py-4 text-[#8e9192] font-mono text-[12px]">{student.attendance ?? 0}%</td>
      <td className="px-6 py-4 text-right">
        <button
          className="text-white hover:underline font-mono text-[12px] bg-[#2a2a2a] hover:bg-[#353535] px-4 py-2 rounded-full transition-all"
          onClick={() => onEdit(student)}
          aria-label={`Edit ${student.name}`}
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard({ onLogout, showToast }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db
        .from('students')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        showToast('Failed to load students: ' + error.message, 'error')
        return
      }
      setStudents(data || [])
    } catch {
      showToast('Connection error.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // Load on mount
  useEffect(() => { loadStudents() }, [loadStudents])

  const handleCreated = (student) => setStudents(prev => [...prev, student])

  const handleSaved = (updated) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const handleDeleted = (id) => {
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  const openEdit = (student) => {
    setEditingStudent(student)
    setEditModalOpen(true)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#131313] border-b border-[#444748]">
        <nav className="flex justify-between items-center w-full px-6 h-16 max-w-[1280px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[24px] font-bold tracking-tight text-white">RYHA</span>
            <span className="text-[#8e9192]">/</span>
            <span className="font-mono text-[12px] text-[#8e9192] uppercase tracking-widest">Admin Console</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="bg-white text-[#2f3131] px-6 py-2 rounded-full font-mono text-[12px] flex items-center gap-2 hover:opacity-90 transition-all"
              onClick={() => setNewModalOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Student
            </button>
            <button
              className="bg-[#2a2a2a] text-white px-4 py-2 rounded-full font-mono text-[12px] flex items-center gap-2 hover:bg-[#353535] transition-all"
              onClick={loadStudents}
              aria-label="Refresh students list"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh
            </button>
            <button className="btn-ghost" onClick={onLogout} aria-label="Logout">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Logout
            </button>
          </div>
        </nav>
      </header>

      <div className="pt-20 px-6 pb-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-8">
            <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white mb-2">
              Admin Management Console
            </h1>
            <p className="text-[#8e9192]">Manage student records, certificates, and academic progress.</p>
          </div>

          {/* Table */}
          <div className="bg-[#1b1b1b] border border-[#444748] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-[#444748] flex justify-between items-center">
              <h3 className="font-mono text-[12px] text-white font-bold tracking-widest uppercase">All Students</h3>
              <span className="font-mono text-[12px] text-[#8e9192]">
                {students.length} Student{students.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#8e9192]">
                <Spinner className="mr-2" /> Loading students...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#1f1f1f]">
                    <tr className="font-mono text-[12px] text-[#8e9192]">
                      <th className="px-6 py-4 font-medium uppercase">Student Name</th>
                      <th className="px-6 py-4 font-medium uppercase">Username</th>
                      <th className="px-6 py-4 font-medium uppercase">Student ID</th>
                      <th className="px-6 py-4 font-medium uppercase">Completion</th>
                      <th className="px-6 py-4 font-medium uppercase">Score</th>
                      <th className="px-6 py-4 font-medium uppercase">Projects</th>
                      <th className="px-6 py-4 font-medium uppercase">Attendance</th>
                      <th className="px-6 py-4 font-medium uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#444748]">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-[#8e9192] font-mono text-[12px]">
                          No students yet. Click &quot;New Student&quot; to add one.
                        </td>
                      </tr>
                    ) : (
                      students.map(s => (
                        <StudentRow key={s.id} student={s} onEdit={openEdit} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#444748] py-8 w-full max-w-[1280px] mx-auto px-6 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center font-mono text-[12px] text-[#8e9192] gap-4">
          <span className="text-white font-bold">RYHA</span>
          <span>© 2026 RYHA TECHNOLOGIES. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>

      {/* Modals */}
      <NewStudentModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={handleCreated}
        showToast={showToast}
      />
      <EditStudentModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingStudent(null) }}
        student={editingStudent}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        showToast={showToast}
      />
    </div>
  )
}

// ── Admin Login ───────────────────────────────────────────────────────────────

function AdminLogin({ onLogin, showToast }) {
  const [adminId, setAdminId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const RATE_KEY = 'admin_login'

  const flashError = (msg) => {
    setHasError(true)
    showToast(msg, 'error')
    setTimeout(() => setHasError(false), 2000)
  }

  const login = async () => {
    const u = sanitize(adminId)
    const p = password.trim()
    if (!u || !p) { flashError('Please enter Admin ID and Password.'); return }

    const rl = checkRateLimit(RATE_KEY)
    if (!rl.allowed) {
      flashError(`Too many failed attempts. Wait ${rl.secsLeft}s.`)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await db
        .from('admin_users')
        .select('username')
        .eq('username', u)
        .eq('password', p)
        .maybeSingle()

      if (error || !data) {
        recordFailedAttempt(RATE_KEY)
        flashError('Invalid admin credentials.')
        return
      }

      clearRateLimit(RATE_KEY)
      onLogin()
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
            <h1 className="font-sans text-[40px] font-bold leading-tight tracking-tight text-white">Admin Login</h1>
            <p className="text-[#8e9192]">Enter your credentials to access the admin management console.</p>
          </div>

          <div className="space-y-4 text-left">
            <div className="group">
              <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest" htmlFor="admin-id">
                Admin ID
              </label>
              <input
                id="admin-id"
                className={`input-base ${hasError ? 'input-error' : ''}`}
                placeholder="Enter your Admin ID"
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                autoComplete="username"
                maxLength={80}
                aria-invalid={hasError}
              />
            </div>

            <div className="group">
              <label className="font-mono text-[12px] uppercase mb-2 block text-[#8e9192] group-focus-within:text-white tracking-widest" htmlFor="admin-pass">
                Password
              </label>
              <input
                id="admin-pass"
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

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const { toasts, showToast } = useToast()

  return (
    <>
      <ToastContainer toasts={toasts} />
      {loggedIn ? (
        <AdminDashboard onLogout={() => setLoggedIn(false)} showToast={showToast} />
      ) : (
        <AdminLogin onLogin={() => setLoggedIn(true)} showToast={showToast} />
      )}
    </>
  )
}
