import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import MergeScheduleModal from '../components/MergeScheduleModal.jsx'

const LS_KEY = 'academiq_schedule'
const API_BASE = import.meta.env.VITE_API_URL || ''

function getLocalCourses() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [pendingSession, setPendingSession] = useState(null)

  async function afterSignup(session) {
    const local = getLocalCourses()
    if (local.length > 0) {
      setPendingSession(session)
      setShowMerge(true)
    } else {
      navigate('/schedule')
    }
  }

  async function handleMergeSave() {
    if (!pendingSession) return
    try {
      const local = getLocalCourses()
      const sem   = local[0]?.semester || ''
      await fetch(`${API_BASE}/api/schedule/${pendingSession.user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pendingSession.access_token}`,
        },
        body: JSON.stringify({ semester: sem, courses: local }),
      })
    } catch { /* silent */ }
    localStorage.removeItem(LS_KEY)
    navigate('/schedule')
  }

  function handleMergeDiscard() {
    localStorage.removeItem(LS_KEY)
    navigate('/schedule')
  }

  async function handleEmailSignup(e) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setIsLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) throw err
      if (!data.session) {
        // Email confirmation required
        setSuccessMsg('Check your email to confirm your account, then sign in.')
        return
      }
      await afterSignup(data.session)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignup() {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/schedule` },
    })
    if (err) setError(err.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-8 pb-16">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <header className="text-center">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.18em] mb-3">
            AcademiqHQ
          </p>
          <h1 className="font-serif text-3xl text-parchment">Create an account</h1>
        </header>

        <form onSubmit={handleEmailSignup} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3
                            text-sm text-red-400">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-950 border border-emerald-700 rounded-lg px-4 py-3
                            text-sm text-emerald-400">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-parchment-muted
                               uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-parchment-muted
                               uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !!successMsg}
            className={`w-full py-3 rounded-lg text-sm font-bold transition-all duration-150
              ${(isLoading || successMsg)
                ? 'bg-navy-400 text-parchment-muted cursor-not-allowed'
                : 'bg-gold text-navy-900 hover:bg-gold-light shadow-[0_0_20px_rgba(201,150,58,0.25)]'
              }`}
          >
            {isLoading ? 'Creating account…' : 'Sign Up'}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-navy-400" />
            <span className="text-xs text-parchment-muted">or</span>
            <div className="flex-1 border-t border-navy-400" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full py-3 rounded-lg border border-navy-400 text-parchment-dim
                       text-sm font-semibold hover:border-navy-300 hover:text-parchment
                       transition-colors flex items-center justify-center gap-2"
          >
            <span className="font-bold">G</span> Continue with Google
          </button>
        </form>

        <p className="text-center text-sm text-parchment-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-gold hover:text-gold-light transition-colors">
            Sign in
          </Link>
        </p>

      </div>

      <MergeScheduleModal
        isOpen={showMerge}
        onSave={handleMergeSave}
        onDiscard={handleMergeDiscard}
      />
    </div>
  )
}
