import React, { useState } from 'react'
import ProfessorCard from './components/ProfessorCard.jsx'
import LoadingSkeleton from './components/LoadingSkeleton.jsx'

const EXAMPLES = [
  { label: 'CSC 330', course: 'CSC 330', prefs: 'Easy grader, engaging lectures, not too much homework' },
  { label: 'MAT 191', course: 'MAT 191', prefs: 'Patient with students who struggle, good at explaining concepts clearly' },
  { label: 'ENG 101', course: 'ENG 101', prefs: 'Flexible with deadlines, helpful feedback on essays' },
]

export default function App() {
  const [course, setCourse] = useState('')
  const [prefs, setPrefs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!course.trim() || !prefs.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_code: course.trim(), preferences: prefs.trim() }),
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

  function fillExample(ex) {
    setCourse(ex.course)
    setPrefs(ex.prefs)
    setResult(null)
    setError(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)',
      padding: '48px 16px 80px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ color: '#f5a623', fontWeight: 600, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            UNCG Professor Recommender
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 'clamp(32px, 6vw, 52px)',
            fontWeight: 400,
            lineHeight: 1.15,
            color: '#e6edf3',
            marginBottom: 16,
          }}>
            Find your perfect professor
          </h1>
          <p style={{ color: '#8b949e', fontSize: 15, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Enter a course code and describe what matters to you. We'll scrape Banner, check Rate My Professors, and let Claude rank the options.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: '#161b27',
          border: '1px solid #2a3145',
          borderRadius: 16,
          padding: '28px 28px 24px',
          marginBottom: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 160px' }}>
              <label style={labelStyle}>Course Code</label>
              <input
                value={course}
                onChange={e => setCourse(e.target.value)}
                placeholder="e.g. CSC 339"
                style={inputStyle}
                disabled={loading}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>What you're looking for</label>
              <textarea
                value={prefs}
                onChange={e => setPrefs(e.target.value)}
                placeholder="e.g. I want someone who grades fairly and gives clear feedback on assignments…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', height: 'auto' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Example buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6e7681', whiteSpace: 'nowrap' }}>Try:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => fillExample(ex)}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: '1px solid #3d4a6a',
                  borderRadius: 20,
                  padding: '4px 14px',
                  fontSize: 13,
                  color: '#8b949e',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#f5a623'; e.currentTarget.style.color = '#f5a623' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#3d4a6a'; e.currentTarget.style.color = '#8b949e' }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !course.trim() || !prefs.trim()}
            style={{
              background: loading || !course.trim() || !prefs.trim() ? '#2a3145' : '#f5a623',
              color: loading || !course.trim() || !prefs.trim() ? '#6e7681' : '#0d1117',
              border: 'none',
              borderRadius: 10,
              padding: '13px 28px',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              cursor: loading || !course.trim() || !prefs.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
              alignSelf: 'flex-end',
            }}
          >
            {loading ? 'Searching…' : 'Find Professors'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div style={{
            background: '#3d1a1a', border: '1px solid #8b1a1a',
            borderRadius: 10, padding: '14px 18px',
            color: '#f85149', fontSize: 14, marginBottom: 24,
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Results */}
        {result && !loading && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 24, fontWeight: 400, color: '#e6edf3', marginBottom: 6,
              }}>
                {result.professors_found} professor{result.professors_found !== 1 ? 's' : ''} found for {result.term}
              </h2>
              {result.summary && (
                <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.6 }}>{result.summary}</p>
              )}
              <p style={{ fontSize: 13, color: '#6e7681', marginTop: 4 }}>
                {result.sections_found} section{result.sections_found !== 1 ? 's' : ''} scraped from Banner
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {result.recommendations.map((rec, i) => (
                <ProfessorCard key={`${rec.instructor_name}-${rec.crn}`} rec={rec} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #2a3145',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#e6edf3',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  transition: 'border-color 0.15s',
}
