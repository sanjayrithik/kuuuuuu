import { useEffect, useState } from 'react'

function ToastItem({ message, type }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger slide-in
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const colorClass = type === 'success' ? 'toast-success' : 'toast-error'

  return (
    <div
      className={`toast-base ${colorClass} ${visible ? 'toast-show' : ''}`}
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t, i) => (
        <div key={t.id} style={{ top: `${20 + i * 60}px` }} className="absolute right-0 pointer-events-auto">
          <ToastItem message={t.message} type={t.type} />
        </div>
      ))}
    </div>
  )
}
