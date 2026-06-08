import { useEffect, useRef } from 'react'

/**
 * Accessible modal dialog with focus trap and keyboard close.
 */
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const overlayRef = useRef(null)
  const firstFocusRef = useRef(null)

  // Focus trap & ESC close
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    firstFocusRef.current?.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      prev?.focus()
    }
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className={`modal-overlay ${open ? 'open' : ''}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`modal-box ${maxWidth} w-[90%]`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-sans text-[24px] font-bold text-white">{title}</h2>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="text-[#8e9192] hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
