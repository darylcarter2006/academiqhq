import React from 'react'
import SearchForm from '../components/SearchForm.jsx'
import ProfessorCard from '../components/ProfessorCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

// Resolved once at module load from the Vite build-time env injection.
// In dev: falls back to '' so Vite's proxy handles /api/* → localhost:8000.
// In production: VITE_API_URL must be set on Vercel before building,
// e.g. https://academiqhq-api.onrender.com (no trailing slash).
const API_BASE = import.meta.env.VITE_API_URL || ''

// Diagnostics — always visible in browser DevTools console
console.log('[AcademiqHQ] build env VITE_API_URL =', JSON.stringify(import.meta.env.VITE_API_URL))
console.log('[AcademiqHQ] API_BASE =', JSON.stringify(API_BASE) || '(empty string — Vite proxy active)')
console.log('[AcademiqHQ] PROD =', import.meta.env.PROD)

if (!API_BASE && import.meta.env.PROD) {
  console.error(
    '[AcademiqHQ] VITE_API_URL is not set — all API calls will fail in production. ' +
    'Set it in Vercel → Project Settings → Environment Variables, then redeploy.'
  )
}

export default function Home() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [result, setResult] = React.useState(null)

  async function handleSearch({ course, prefs, term }) {
    setLoading(true)
    setError(null)
    setResult(null)
    const url = `${API_BASE}/api/recommend`
    console.log('[AcademiqHQ] POST', url)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: course, preferences: prefs, term }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data.detail
        const msg = Array.isArray(detail)
          ? detail.map(e => e.msg || JSON.stringify(e)).join('; ')
          : (typeof detail === 'string' ? detail : `Server error ${res.status}`)
        throw new Error(msg)
      }
      setResult(await res.json())
    } catch (err) {
      // "Failed to fetch" / "NetworkError" almost always means CORS rejection or
      // the backend is unreachable. Surface the URL so it's obvious in the UI.
      const isNetworkError =
        err.message === 'Failed to fetch' || err.message.toLowerCase().includes('networkerror')
      console.error('[AcademiqHQ] fetch error:', err.message, '| url:', url)
      setError(
        isNetworkError
          ? `Cannot reach the API server (CORS or network error). URL attempted: ${url} — check the browser console for details.`
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 pt-8 sm:pt-14 pb-16 sm:pb-24">
      <div className="max-w-2xl mx-auto flex flex-col gap-6 sm:gap-7">

        {/* Header */}
        <header className="text-center mb-4">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.18em] mb-3">
            AcademiqHQ
          </p>
          <h1 className="font-serif text-[clamp(2rem,6vw,3.25rem)] font-normal text-parchment
                          leading-tight text-balance mb-4">
            Find Your Perfect Professor
          </h1>
          <p className="text-sm text-parchment-muted leading-relaxed max-w-md mx-auto">
            Enter a UNCG course ID, tell us what matters, and we'll rank every professor using real Rate My Professors data.
          </p>
        </header>

        {/* Form */}
        <SearchForm onSubmit={handleSearch} loading={loading} />

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-5 py-4
                          text-sm text-red-400">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Results */}
        {result && !loading && (
          <section className="flex flex-col gap-5">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-parchment text-balance">
                {result.professors_found} professor{result.professors_found !== 1 ? 's' : ''} for{' '}
                <span className="text-gold">{result.course_code}</span>
                {result.term ? ` · ${result.term}` : ''}
              </h2>
              {result.summary && (
                <p className="text-sm text-parchment-muted leading-relaxed mt-2">{result.summary}</p>
              )}
              <p className="text-xs text-parchment-muted/60 mt-1">
                {result.sections_found} section{result.sections_found !== 1 ? 's' : ''} found
              </p>
            </div>

            {result.recommendations.map((rec, i) => (
              <ProfessorCard key={`${rec.instructor_name}-${rec.crn}`} rec={rec} index={i} />
            ))}
          </section>
        )}

      </div>
    </div>
  )
}
