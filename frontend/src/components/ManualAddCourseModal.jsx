import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseScheduleString } from '../utils/scheduleUtils.js'

const API_BASE = import.meta.env.VITE_API_URL || ''

const TERMS = [
  { label: 'Auto-detect', value: '' },
  { label: 'Summer 2026', value: '202605' },
  { label: 'Fall 2026',   value: '202608' },
]

// Accepts "CSC 330", "CSC330", "csc-330" etc — split client-side since the
// backend takes subject/number as separate query params.
const COURSE_INPUT_RE = /^([A-Za-z]{2,4})\s?-?\s?(\d{3}[A-Za-z]?)$/

export default function ManualAddCourseModal({ isOpen, onClose, addCourse }) {
  const [courseInput, setCourseInput]     = useState('')
  const [term, setTerm]                   = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [searchResult, setSearchResult]   = useState(null) // { subject, number, term, sections }
  const [selectedSection, setSelectedSection] = useState(null)
  const [addError, setAddError]           = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setCourseInput('')
    setTerm('')
    setLoading(false)
    setError(null)
    setSearchResult(null)
    setSelectedSection(null)
    setAddError(null)
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const parsedTimes = selectedSection ? parseScheduleString(selectedSection.schedule) : null
  const hasTimes = parsedTimes?.startTime && parsedTimes?.endTime

  async function handleSearch(e) {
    e.preventDefault()
    setError(null)
    setSearchResult(null)
    setSelectedSection(null)

    const match = courseInput.trim().match(COURSE_INPUT_RE)
    if (!match) {
      setError('Enter a valid course code like "CSC 330".')
      return
    }
    const subject = match[1].toUpperCase()
    const number = match[2].toUpperCase()

    setLoading(true)
    try {
      const params = new URLSearchParams({ subject, number })
      if (term) params.set('term', term)
      const res = await fetch(`${API_BASE}/api/sections?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      setSearchResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function backToResults() {
    setSelectedSection(null)
    setAddError(null)
  }

  async function handleConfirm() {
    if (!selectedSection || !searchResult) return
    const courseCode = `${searchResult.subject} ${searchResult.number}`
    // parseInt fallback must not use || — 0-credit labs are legitimate.
    const parsedCredits = parseInt(selectedSection.credits, 10)

    const courseObj = {
      crn:         selectedSection.crn,
      courseCode,
      courseName:  selectedSection.title || courseCode,
      section:     selectedSection.section_number,
      professor:   selectedSection.instructor_name,
      days:        parsedTimes?.days ?? [],
      startTime:   parsedTimes?.startTime ?? null,
      endTime:     parsedTimes?.endTime ?? null,
      building:    selectedSection.building ?? '',
      room:        selectedSection.room ?? '',
      semester:    searchResult.term ?? '',
      creditHours: Number.isNaN(parsedCredits) ? 3 : parsedCredits,
    }

    const res = await addCourse(courseObj, courseObj.semester)
    if (res?.error) {
      setAddError(res.error)
      return
    }
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-navy-900/80"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6 flex flex-col gap-4 relative max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-xl text-parchment">
            {selectedSection ? 'Confirm Section' : 'Add a Course Manually'}
          </h2>
          <button
            onClick={onClose}
            className="text-parchment-muted hover:text-parchment transition-colors text-2xl
                       leading-none flex-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step 1: search form */}
        {!searchResult && (
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-parchment-muted uppercase tracking-widest mb-2">
                Course Code
              </label>
              <input
                value={courseInput}
                onChange={e => setCourseInput(e.target.value)}
                placeholder="e.g. CSC 330"
                className="input-field"
                maxLength={20}
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div>
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

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading || !courseInput.trim()}
              className={`w-full py-3 rounded-lg text-sm font-bold transition-all duration-150
                ${loading || !courseInput.trim()
                  ? 'bg-navy-400 text-parchment-muted cursor-not-allowed'
                  : 'bg-gold text-navy-900 hover:bg-gold-light shadow-[0_0_20px_rgba(201,150,58,0.25)]'
                }`}
            >
              {loading ? 'Searching…' : 'Find Sections'}
            </button>
          </form>
        )}

        {/* Step 2: section list */}
        {searchResult && !selectedSection && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-parchment-muted">
              {searchResult.subject} {searchResult.number}
              {searchResult.term ? ` · ${searchResult.term}` : ''}
            </p>

            {searchResult.sections.length === 0 ? (
              <p className="text-sm text-parchment-muted">No sections found for that course.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {searchResult.sections.map(s => (
                  <button
                    key={s.crn}
                    type="button"
                    onClick={() => { setSelectedSection(s); setAddError(null) }}
                    className="text-left bg-navy-600 hover:bg-navy-500 rounded-lg p-3
                               flex flex-col gap-0.5 transition-colors"
                  >
                    <span className="text-sm text-parchment font-semibold">{s.instructor_name}</span>
                    <span className="text-xs text-parchment-muted">
                      Section {s.section_number} · CRN {s.crn}{s.credits ? ` · ${s.credits} cr` : ''}
                    </span>
                    <span className="text-xs text-parchment-muted">
                      {s.schedule || 'Schedule TBA'}
                      {s.room && s.room !== 'TBA' ? ` · ${s.building} ${s.room}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSearchResult(null)}
              className="text-xs text-parchment-muted hover:text-gold transition-colors self-start"
            >
              ← Search a different course
            </button>
          </div>
        )}

        {/* Step 3: confirm */}
        {selectedSection && (
          <div className="flex flex-col gap-4">
            <div className="bg-navy-600 rounded-lg p-4 flex flex-col gap-1.5">
              <p className="text-gold text-sm font-semibold">
                {searchResult.subject} {searchResult.number}
              </p>
              {selectedSection.title && (
                <p className="text-parchment-dim text-xs">{selectedSection.title}</p>
              )}
              <p className="text-parchment text-base">{selectedSection.instructor_name}</p>
              <p className="text-parchment-muted text-xs">
                Section {selectedSection.section_number} · CRN {selectedSection.crn}
              </p>
              <p className="text-parchment-muted text-xs mt-1">
                {selectedSection.schedule || 'Schedule TBA'}
              </p>
            </div>

            {!hasTimes && (
              <p className="text-amber-400 text-xs">
                This section has no scheduled meeting times and won't appear on the calendar grid.
              </p>
            )}

            {addError && (
              <p className="text-red-400 text-xs">{addError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={backToResults}
                className="px-5 py-2.5 rounded-lg border border-navy-400 text-parchment-muted
                           text-sm hover:border-navy-300 hover:text-parchment transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-lg bg-gold text-navy-900 text-sm font-bold
                           hover:bg-gold-light shadow-[0_0_20px_rgba(201,150,58,0.25)]
                           transition-all duration-150"
              >
                Add to Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
