import React from 'react'

const EXAMPLES = [
  { label: 'CSC 330', course: 'CSC 330', prefs: 'Easy grader, engaging lectures, not too much homework' },
  { label: 'MAT 191', course: 'MAT 191', prefs: 'Patient with students who struggle, good at explaining concepts clearly' },
  { label: 'ENG 101', course: 'ENG 101', prefs: 'Flexible with deadlines, helpful feedback on essays' },
]

export default function SearchForm({ onSubmit, loading }) {
  const [course, setCourse] = React.useState('')
  const [prefs, setPrefs] = React.useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!course.trim() || !prefs.trim()) return
    onSubmit({ course: course.trim(), prefs: prefs.trim() })
  }

  function fillExample(ex) {
    setCourse(ex.course)
    setPrefs(ex.prefs)
  }

  const disabled = loading || !course.trim() || !prefs.trim()

  return (
    <form onSubmit={handleSubmit} className="card p-7 flex flex-col gap-5">
      <div className="flex gap-4 flex-wrap">
        {/* Course code */}
        <div className="flex-none w-40">
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
          />
        </div>

        {/* Preferences */}
        <div className="flex-1 min-w-48">
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
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs text-parchment-muted">Try:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            type="button"
            onClick={() => fillExample(ex)}
            disabled={loading}
            className="text-xs text-parchment-muted border border-navy-400 rounded-full px-3.5 py-1
                       hover:border-gold hover:text-gold transition-colors duration-150 disabled:opacity-40"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={`self-end px-7 py-3 rounded-lg text-sm font-bold tracking-wide transition-all duration-150
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
