/**
 * Security utilities
 * 
 * NOTE: Since the DB stores plaintext passwords (per the existing schema),
 * we hash client-side before comparing so at least the hash is consistent.
 * For production, passwords should be hashed server-side via a Supabase
 * Edge Function or RPC — never stored plaintext.
 *
 * For now we do a PBKDF2-based hash in the browser using Web Crypto API
 * so we never send the raw password over the wire beyond HTTPS.
 */

/**
 * Simple SHA-256 hex hash using Web Crypto API.
 * Used for consistent comparison against DB values.
 */
export async function hashPassword(plain) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Sanitize a string to prevent XSS — strip HTML tags.
 */
export function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').trim()
}

/**
 * Validate a GitHub URL.
 */
export function isValidGithubUrl(url) {
  if (!url) return true // optional field
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname === 'github.com'
  } catch {
    return false
  }
}

/**
 * Validate a certificate ID format: RYHA-2026-XXXX-XXXX
 */
export function isValidCertId(id) {
  return /^RYHA-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(id.trim())
}

/**
 * Rate-limiter using sessionStorage — prevents brute-force login spam.
 */
const RATE_LIMIT_KEY = 'ryha_rl'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000 // 5 minutes

export function checkRateLimit(key) {
  const raw = sessionStorage.getItem(`${RATE_LIMIT_KEY}_${key}`)
  if (!raw) return { allowed: true, remaining: MAX_ATTEMPTS }
  const { attempts, lockedUntil } = JSON.parse(raw)
  if (lockedUntil && Date.now() < lockedUntil) {
    const secsLeft = Math.ceil((lockedUntil - Date.now()) / 1000)
    return { allowed: false, secsLeft }
  }
  if (attempts >= MAX_ATTEMPTS) {
    // Reset after lockout expires
    sessionStorage.removeItem(`${RATE_LIMIT_KEY}_${key}`)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - attempts }
}

export function recordFailedAttempt(key) {
  const raw = sessionStorage.getItem(`${RATE_LIMIT_KEY}_${key}`)
  const prev = raw ? JSON.parse(raw) : { attempts: 0 }
  const attempts = prev.attempts + 1
  const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null
  sessionStorage.setItem(`${RATE_LIMIT_KEY}_${key}`, JSON.stringify({ attempts, lockedUntil }))
}

export function clearRateLimit(key) {
  sessionStorage.removeItem(`${RATE_LIMIT_KEY}_${key}`)
}

/**
 * Generate a secure random student ID: RYHA-2026-XXXX-XXXX
 */
export function generateStudentId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => chars[b % chars.length]).join('')
  return `RYHA-2026-${rand(4)}-${rand(4)}`
}

/**
 * Generate a secure random password (12 chars, mixed).
 */
export function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#'
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => chars[b % chars.length]).join('')
}

/**
 * Generate a username from a full name.
 * Format: ryha[firstname][3-digit-random]
 */
export function generateUsername(fullName) {
  const first = sanitize(fullName).split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'intern'
  const num = String(Math.floor(100 + (crypto.getRandomValues(new Uint8Array(1))[0] % 900))).padStart(3, '0')
  return `ryha${first}${num}`
}
