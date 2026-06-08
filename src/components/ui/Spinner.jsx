export function Spinner({ className = '' }) {
  return (
    <span
      className={`material-symbols-outlined animate-spin ${className}`}
      aria-hidden="true"
    >
      refresh
    </span>
  )
}
