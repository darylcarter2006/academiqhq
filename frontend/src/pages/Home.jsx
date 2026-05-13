import React from 'react'
import SearchForm from '../components/SearchForm.jsx'
import ProfessorCard from '../components/ProfessorCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function Home() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [result, setResult] = React.useState(null)

  async function handleSearch({ course, prefs, term }) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: course, preferences: prefs, term }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      setResult(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 pt-14 pb-24">
      <div className="max-w-2xl mx-auto flex flex-col gap-7">

        {/* Header */}
        <header className="text-center mb-4">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.18em] mb-3">
            UNCG Professor Recommender
          </p>
          <h1 className="font-serif text-[clamp(2rem,6vw,3.25rem)] font-normal text-parchment
                          leading-tight text-balance mb-4">
            Find your perfect professor
          </h1>
          <p className="text-sm text-parchment-muted leading-relaxed max-w-md mx-auto">
            Enter a course code and describe what matters to you. We'll scrape Banner,
            check Rate My Professors, and let Claude rank the options.
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
              <h2 className="font-serif text-2xl font-normal text-parchment">
                {result.professors_found} professor{result.professors_found !== 1 ? 's' : ''} for{' '}
                <span className="text-gold">{result.course_code}</span>
                {result.term ? ` · ${result.term}` : ''}
              </h2>
              {result.summary && (
                <p className="text-sm text-parchment-muted leading-relaxed mt-2">{result.summary}</p>
              )}
              <p className="text-xs text-parchment-muted/60 mt-1">
                {result.sections_found} section{result.sections_found !== 1 ? 's' : ''} scraped from Banner
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
