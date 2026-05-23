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
  { label: 'Spring 2026', value: '202601' },
  { label: 'Spring 2027', value: '202701' },
]

export default function SearchForm({ onSubmit, loading }) {
  const [course, setCourse] = React.useState('')
  const [prefs, setPrefs] = React.useState('')
  const [term, setTerm] = React.useState('')

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
    <form onSubmit={handleSubmit} className="card p-5 sm:p-7 flex flex-col gap-5">
      {/*
        Mobile: 2-column grid — Course Code and Term side-by-side,
        Preferences spans both columns (full width).
        sm+: switches to flex-row with fixed widths for the short fields.
      */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">

        {/* Course code */}
        <div className="sm:flex-none sm:w-36">
          <label className="block text-xs font-semibold text-parchment-muted uppercase tracking-widest mb-2">
            Course Code
          </label>
          <input
            value={course}
            onChange={e => setCourse(e.target.value)}
            placeholder="e.g. CSC 330"
            className="input-field"
            disabled={loading}
            maxLength={20}
            autoComplete="off"
          />
        </div>

        {/* Term selector */}
        <div className="sm:flex-none sm:w-36">
          <label className="block text-xs font-semibold text-parchment-muted uppercase tracking-widest mb-2">
            Term
          </label>
          <select
            value={term}
            onChange={e => setTerm(e.target.value)}
            disabled={loading}
            className="input-field appearance-none cursor-pointer"
          >
            {TERMS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Preferences — full width on mobile via col-span-2 */}
        <div className="col-span-2 sm:flex-1 sm:min-w-48">
          <label className="block text-xs font-semibold text-parchment-muted uppercase tracking-widest mb-2">
            What you're looking for
          </label>
          <textarea
            value={prefs}
            onChange={e => setPrefs(e.target.value)}
            placeholder="e.g. I want someone who grades fairly and gives clear feedback on assignments…"
            rows={3}
            maxLength={500}
            className="input-field resize-y"
            disabled={loading}
          />
        </div>
      </div>

      {/* Example quick-fills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-parchment-muted">Try:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            type="button"
            onClick={() => fillExample(ex)}
            disabled={loading}
            className="text-xs text-parchment-muted border border-navy-400 rounded-full
                       px-3.5 py-2 min-h-[36px]
                       hover:border-gold hover:text-gold transition-colors duration-150 disabled:opacity-40"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Submit — full width on mobile, auto width right-aligned on sm+ */}
      <button
        type="submit"
        disabled={disabled}
        className={`w-full sm:w-auto sm:self-end px-7 py-3 min-h-[44px] rounded-lg
                    text-sm font-bold tracking-wide transition-all duration-150
          ${disabled
            ? 'bg-navy-400 text-parchment-muted cursor-not-allowed'
            : 'bg-gold text-navy-900 hover:bg-gold-light cursor-pointer shadow-[0_0_20px_rgba(201,150,58,0.25)] hover:shadow-[0_0_28px_rgba(201,150,58,0.4)]'
          }`}
      >
        {loading ? 'Searching…' : 'Find Professors'}
      </button>
    </form>
  )
}
