import React from 'react'

const EXAMPLES = [
  { label: 'CSC 330', course: 'CSC 330', prefs: 'Easy grader, engaging lectures, not too much homework' },
  { label: 'MAT 196', course: 'MAT 196', prefs: 'Patient with students who struggle, good at explaining concepts clearly' },
  { label: 'ENG 101', course: 'ENG 101', prefs: 'Flexible with deadlines, helpful feedback on essays' },
]

const TERMS = [
  { label: 'Auto-detect', value: '' },
  { label: 'Summer 2026', value: '202605' },
  { label: 'Fall 2026',   value: '202608' },
]

export default function SearchForm({ onSubmit, loading }) {
  const [course, setCourse] = React.useState('')
  const [prefs, setPrefs]   = React.useState('')
  const [term, setTerm]     = React.useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!course.trim() || !prefs.trim()) return
    onSubmit({ course: course.trim(), prefs: prefs.trim(), term: term || null })
  }

  function fillExample(ex) {
    setCourse(ex.course)
    setPrefs(ex.prefs)
  }

  const disabled = loading || !course.trim() || !prefs.trim()

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-5 sm:p-7 flex flex-col gap-5">

      {/* ── Input row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">

        {/* Course code */}
        <div className="sm:flex-none sm:w-36">
          <label className="field-label">Course Code</label>
          <input
            value={course}
            onChange={e => setCourse(e.target.value)}
            placeholder="e.g. CSC 330"
            className="input-field font-mono"
            disabled={loading}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        {/* Term */}
        <div className="sm:flex-none sm:w-36">
          <label className="field-label">Term</label>
          <div className="relative">
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              disabled={loading}
              className="input-field appearance-none cursor-pointer pr-8"
              style={{ backgroundImage: 'none' }}
            >
              {TERMS.map(t => (
                <option key={t.value} value={t.value} style={{ background: '#07162a' }}>
                  {t.label}
                </option>
              ))}
            </select>
            {/* Custom chevron */}
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ color: 'var(--gold)', opacity: 0.6 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Preferences */}
        <div className="col-span-2 sm:flex-1 sm:min-w-48">
          <label className="field-label">What you're looking for</label>
          <textarea
            value={prefs}
            onChange={e => setPrefs(e.target.value)}
            placeholder="e.g. I want someone who grades fairly, gives clear feedback, and doesn't cold call…"
            rows={3}
            maxLength={500}
            className="input-field resize-none"
            disabled={loading}
            style={{ lineHeight: 1.55 }}
          />
        </div>
      </div>

      {/* ── Example pills ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-parchment-muted/60">
          Try:
        </span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            type="button"
            onClick={() => fillExample(ex)}
            disabled={loading}
            className="text-[0.7rem] font-mono font-medium tracking-wider
                       px-3.5 py-1.5 rounded-full min-h-[34px]
                       transition-all duration-200 disabled:opacity-30"
            style={{
              background: 'rgba(14,29,62,0.7)',
              border: '1px solid rgba(232,160,32,0.18)',
              color: '#6a6050',
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(232,160,32,0.55)'
                e.currentTarget.style.color = 'var(--gold)'
                e.currentTarget.style.background = 'rgba(232,160,32,0.07)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(232,160,32,0.18)'
              e.currentTarget.style.color = '#6a6050'
              e.currentTarget.style.background = 'rgba(14,29,62,0.7)'
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* ── Divider ────────────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Submit ─────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={disabled}
        className={`w-full sm:w-auto sm:self-end px-8 py-3 min-h-[46px] rounded-xl
                    text-sm font-bold tracking-widest uppercase transition-all duration-200
                    ${disabled
                      ? 'cursor-not-allowed opacity-35'
                      : 'btn-submit cursor-pointer text-space-900'
                    }`}
        style={disabled ? {
          background: 'rgba(14,29,62,0.7)',
          border: '1px solid rgba(232,160,32,0.12)',
          color: '#6a6050',
        } : {}}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 scan-ring" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Searching…
          </span>
        ) : 'Find Professors'}
      </button>
    </form>
  )
}
