import { useState, useCallback, useRef } from 'react'

/**
 * useToast — returns { toasts, showToast }
 * Toasts auto-dismiss after 3 s.
 */
export function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRef = useRef({})

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    timerRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timerRef.current[id]
    }, 3000)
  }, [])

  return { toasts, showToast }
}
