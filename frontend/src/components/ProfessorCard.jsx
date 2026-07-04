import React, { useState } from 'react'
import AddToScheduleModal from './AddToScheduleModal.jsx'

const FIT = {
  'Great fit':  { pill: 'bg-emerald-950 border border-emerald-700 text-emerald-400' },
  'Good fit':   { pill: 'bg-green-950 border border-green-700 text-green-400' },
  'Decent fit': { pill: 'bg-amber-950 border border-amber-700 text-amber-400' },
  'Not ideal':  { pill: 'bg-red-950 border border-red-800 text-red-400' },
}

const NO_DATA_FIT = { pill: 'bg-navy-600 border border-navy-400 text-parchment-muted' }

function Stars({ rating }) {
  if (rating == null) return <span className="text-parchment-muted text-xs">No rating</span>
  const filled = Math.round(rating)
  return (
    <span className="flex items-center gap-1.5 flex-none" title={`${rating}/5`}>
      <span className="flex" style={{ letterSpacing: 2 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} className={i <= filled ? 'text-gold' : 'text-navy-400'}>★</span>
        ))}
      </span>
      <span className="text-parchment-dim text-sm font-semibold">{rating.toFixed(1)}</span>
    </span>
  )
}

function Stat({ label, value, className = '' }) {
  return (
    <div className="flex flex-col items-center bg-navy-600 rounded-lg px-3 py-2 min-w-[68px]">
      <span className={`text-base font-semibold ${className}`}>{value ?? '—'}</span>
      <span className="text-[10px] text-parchment-muted mt-0.5 text-center leading-tight">{label}</span>
    </div>
  )
}

export default function ProfessorCard({ rec, index, onAddToSchedule }) {
  const [expanded, setExpanded]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const hasRmpData = rec.rmp_rating != null || (rec.rmp_num_ratings != null && rec.rmp_num_ratings > 0)
  const fit = hasRmpData ? (FIT[rec.match_score] || FIT['Decent fit']) : NO_DATA_FIT
  const fitLabel = hasRmpData ? rec.match_score : 'No RMP Data'
  const pct = v => (v != null && v >= 0) ? `${Math.round(v)}%` : '—'
  const tags = rec.rmp_tags?.filter(Boolean) ?? []

  return (
    <article className="card p-4 sm:p-6 flex flex-col gap-4">

      {/* Header row: rank badge + name/section + match score pill */}
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className="flex-none w-9 h-9 rounded-full bg-gold flex items-center justify-center
                        text-navy-900 font-bold text-sm mt-0.5 shrink-0">
          {index + 1}
        </div>

        {/* Name + section info — min-w-0 allows text to wrap instead of overflow */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg sm:text-xl text-parchment leading-snug break-words">
            {rec.instructor_name}
          </h3>
          <p className="text-xs text-parchment-muted mt-1 break-words">
            Section {rec.section_number}
            {rec.crn ? <> &middot; CRN {rec.crn}</> : null}
            {rec.schedule ? <> &middot; {rec.schedule}</> : null}
          </p>
        </div>

        {/* Match score pill — shrinks to right side */}
        <span className={`badge ${fit.pill} whitespace-nowrap flex-none text-[11px] sm:text-xs`}>
          {fitLabel}
        </span>
      </div>

      {/* RMP stats — all items in a single flex-wrap row so they reflow on narrow screens */}
      <div className="flex items-center gap-2 flex-wrap">
        <Stars rating={rec.rmp_rating} />
        {rec.rmp_difficulty != null && (
          <Stat label="Difficulty" value={rec.rmp_difficulty.toFixed(1)} className="text-amber-400" />
        )}
        {rec.rmp_would_take_again != null && (
          <Stat label="Would Retake" value={pct(rec.rmp_would_take_again)} className="text-emerald-400" />
        )}
        {rec.rmp_num_ratings > 0 && (
          <Stat label="Ratings" value={rec.rmp_num_ratings} className="text-parchment-dim" />
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map(tag => (
            <span key={tag}
              className="text-[11px] bg-navy-600 border border-navy-400 text-parchment-dim
                         rounded-full px-2.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Claude's explanation */}
      {rec.explanation && (
        <div>
          <p className={`text-sm text-parchment-dim leading-relaxed
            ${expanded ? '' : 'line-clamp-3'}`}>
            {rec.explanation}
          </p>
          {rec.explanation.length > 200 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-gold hover:text-gold-light mt-1.5 transition-colors
                         duration-150 min-h-[36px] flex items-center"
            >
              {expanded ? 'Show less ▲' : 'Read more ▼'}
            </button>
          )}
        </div>
      )}

      {/* RMP link + Add to Schedule */}
      <div className="flex items-center gap-4 flex-wrap">
        {rec.rmp_url && (
          <a
            href={rec.rmp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gold/70 hover:text-gold transition-colors duration-150
                       inline-flex items-center gap-1 mt-0.5 min-h-[36px]"
          >
            View on Rate My Professors ↗
          </a>
        )}
        {onAddToSchedule && (
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs text-gold/70 hover:text-gold transition-colors duration-150
                       inline-flex items-center gap-1 mt-0.5 min-h-[36px]"
          >
            + Add to Schedule
          </button>
        )}
      </div>

      {onAddToSchedule && (
        <AddToScheduleModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          rec={rec}
          courseCode={onAddToSchedule.courseCode}
          semester={onAddToSchedule.semester}
          onConfirm={(courseObj) => onAddToSchedule.addCourse(courseObj, onAddToSchedule.semester)}
        />
      )}
    </article>
  )
}
