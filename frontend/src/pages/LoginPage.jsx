import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      // SchedulePage detects the fresh sign-in and offers to merge any
      // guest schedule — same flow as the OAuth redirect path.
      navigate('/schedule')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/schedule` },
    })
    if (err) setError(err.message)
    // Browser redirects; merge check happens on SchedulePage
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-8 pb-16">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <header className="text-center">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.18em] mb-3">
            AcademiqHQ
          </p>
          <h1 className="font-serif text-3xl text-parchment">Welcome back</h1>
        </header>

        <form onSubmit={handleEmailLogin} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3
                            text-sm text-red-400">
              {error}
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
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg text-sm font-bold transition-all duration-150
              ${isLoading
                ? 'bg-navy-400 text-parchment-muted cursor-not-allowed'
                : 'bg-gold text-navy-900 hover:bg-gold-light shadow-[0_0_20px_rgba(201,150,58,0.25)]'
              }`}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-navy-400" />
            <span className="text-xs text-parchment-muted">or</span>
            <div className="flex-1 border-t border-navy-400" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-lg border border-navy-400 text-parchment-dim
                       text-sm font-semibold hover:border-navy-300 hover:text-parchment
                       transition-colors flex items-center justify-center gap-2"
          >
            <span className="font-bold">G</span> Continue with Google
          </button>
        </form>

        <p className="text-center text-sm text-parchment-muted">
          Don't have an account?{' '}
          <Link to="/signup" className="text-gold hover:text-gold-light transition-colors">
            Sign up
          </Link>
        </p>

      </div>
    </div>
  )
}
