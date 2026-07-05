import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseScheduleString } from '../utils/scheduleUtils.js'

export default function AddToScheduleModal({ isOpen, onClose, rec, courseCode, semester, onConfirm }) {
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setAddError(null)
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  if (!isOpen || !rec) return null

  const { days, startTime, endTime } = parseScheduleString(rec.schedule)
  const hasTimes = startTime && endTime
  // parseInt fallback must not use || — 0-credit labs are legitimate.
  const parsedCredits = parseInt(rec.credits, 10)

  const courseObj = {
    crn:         rec.crn,
    courseCode,
    courseName:  rec.title || courseCode,
    section:     rec.section_number,
    professor:   rec.instructor_name,
    days,
    startTime,
    endTime,
    building:    rec.building ?? '',
    room:        rec.room ?? '',
    semester:    semester ?? '',
    creditHours: Number.isNaN(parsedCredits) ? 3 : parsedCredits,
  }

  async function handleConfirm() {
    const res = await onConfirm(courseObj)
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
        className="card w-full max-w-md p-6 flex flex-col gap-4 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-xl text-parchment">Add to Schedule</h2>
          <button
            onClick={onClose}
            className="text-parchment-muted hover:text-parchment transition-colors text-2xl
                       leading-none flex-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Course details */}
        <div className="bg-navy-600 rounded-lg p-4 flex flex-col gap-1.5">
          <p className="text-gold text-sm font-semibold">{courseCode}</p>
          {rec.title && rec.title !== courseCode && (
            <p className="text-parchment-dim text-xs">{rec.title}</p>
          )}
          <p className="text-parchment text-base">{rec.instructor_name}</p>
          <p className="text-parchment-muted text-xs">
            Section {rec.section_number} · CRN {rec.crn}
          </p>
          <p className="text-parchment-muted text-xs mt-1">
            {rec.schedule || 'Schedule TBA'}
          </p>
        </div>

        {/* Warning if no times parsed */}
        {!hasTimes && (
          <p className="text-amber-400 text-xs">
            This section has no scheduled meeting times and won't appear on the calendar grid.
          </p>
        )}

        {addError && (
          <p className="text-red-400 text-xs">{addError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-navy-400 text-parchment-muted
                       text-sm hover:border-navy-300 hover:text-parchment transition-colors"
          >
            Cancel
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
    </div>,
    document.body
  )
}
