import React from 'react'
import SearchForm from '../components/SearchForm.jsx'
import ProfessorCard from '../components/ProfessorCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_URL || ''

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
  const [error, setError]   = React.useState(null)
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
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Ambient orb background ───────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Gold orb — top left */}
        <div
          className="absolute rounded-full"
          style={{
            width: 780, height: 780,
            top: '-18%', left: '-12%',
            background: 'radial-gradient(circle at 40% 40%, rgba(232,160,32,0.13) 0%, transparent 68%)',
            filter: 'blur(48px)',
            animation: 'orbDrift1 30s ease-in-out infinite alternate',
          }}
        />
        {/* Arctic blue orb — bottom right */}
        <div
          className="absolute rounded-full"
          style={{
            width: 900, height: 900,
            bottom: '-22%', right: '-18%',
            background: 'radial-gradient(circle at 60% 60%, rgba(94,200,240,0.11) 0%, transparent 65%)',
            filter: 'blur(64px)',
            animation: 'orbDrift2 38s ease-in-out infinite alternate',
          }}
        />
        {/* Violet-gold orb — center */}
        <div
          className="absolute rounded-full"
          style={{
            width: 560, height: 560,
            top: '38%', left: '28%',
            background: 'radial-gradient(circle, rgba(150,100,220,0.06) 0%, transparent 68%)',
            filter: 'blur(80px)',
            animation: 'orbDrift3 24s ease-in-out infinite alternate',
          }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(232,160,32,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(232,160,32,0.025) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      {/* ── Page content ─────────────────────────────────────── */}
      <div className="relative z-10 px-4 pt-12 sm:pt-20 pb-20 sm:pb-32">
        <div className="max-w-2xl mx-auto flex flex-col gap-8 sm:gap-10">

          {/* ── Hero ─────────────────────────────────────────── */}
          <header className="text-center">

            {/* Logo + wordmark */}
            <div className="hero-fade inline-flex items-center gap-2.5 mb-6">
              <img
                src="/favicon.png"
                alt="AcademiqHQ"
                className="w-7 h-7 object-contain opacity-90"
                aria-hidden
              />
              <span
                className="text-[0.65rem] font-bold tracking-[0.22em] uppercase"
                style={{ color: 'var(--gold)' }}
              >
                AcademiqHQ
              </span>
            </div>

            {/* Main heading */}
            <h1
              className="hero-fade hero-fade-2 font-serif text-balance leading-none mb-5"
              style={{ fontSize: 'clamp(2.4rem, 7vw, 3.8rem)' }}
            >
              <span className="block text-parchment">Find Your Perfect</span>
              <span className="block italic gradient-text" style={{ marginTop: '0.04em' }}>
                Professor.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-fade hero-fade-3 text-sm text-parchment-muted leading-relaxed max-w-sm mx-auto">
              Enter a course, tell us what matters, and we'll rank every professor
              using real Rate My Professors data.
            </p>

            {/* Decorative rule */}
            <div className="hero-fade hero-fade-4 gold-rule max-w-[180px] mx-auto mt-6" />
          </header>

          {/* ── Search form ──────────────────────────────────── */}
          <div className="hero-fade hero-fade-4">
            <SearchForm onSubmit={handleSearch} loading={loading} />
          </div>

          {/* ── Error ────────────────────────────────────────── */}
          {error && (
            <div
              className="glass-panel px-5 py-4 text-sm"
              style={{
                background:
                  'linear-gradient(160deg, rgba(40,8,14,0.85), rgba(30,6,10,0.90)) padding-box, linear-gradient(135deg, rgba(244,63,94,0.3), rgba(244,63,94,0.08)) border-box',
                border: '1px solid transparent',
                borderRadius: 14,
              }}
            >
              <span className="font-semibold text-rose-400">Error: </span>
              <span className="text-rose-300/80">{error}</span>
            </div>
          )}

          {/* ── Loading ──────────────────────────────────────── */}
          {loading && <LoadingSkeleton />}

          {/* ── Results ──────────────────────────────────────── */}
          {result && !loading && (
            <section className="flex flex-col gap-5">

              {/* Results header */}
              <div className="flex flex-col gap-1">
                <h2 className="font-serif text-xl sm:text-2xl font-normal text-parchment text-balance leading-snug">
                  <span className="text-parchment-dim font-mono text-base font-medium mr-2">
                    {result.professors_found}
                  </span>
                  professor{result.professors_found !== 1 ? 's' : ''} for{' '}
                  <span style={{ color: 'var(--gold)' }}>{result.course_code}</span>
                  {result.term ? (
                    <span className="text-parchment-muted text-base font-sans font-normal"> · {result.term}</span>
                  ) : null}
                </h2>

                {result.summary && (
                  <p className="text-sm text-parchment-muted leading-relaxed mt-1">
                    {result.summary}
                  </p>
                )}

                <p className="text-xs text-parchment-muted/50 font-mono mt-0.5">
                  {result.sections_found} section{result.sections_found !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Professor cards */}
              {result.recommendations.map((rec, i) => (
                <ProfessorCard
                  key={`${rec.instructor_name}-${rec.crn}`}
                  rec={rec}
                  index={i}
                />
              ))}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
