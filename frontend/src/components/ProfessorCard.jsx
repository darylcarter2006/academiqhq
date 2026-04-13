import React, { useState } from 'react'

const FIT_CONFIG = {
  'Great fit':  { bg: '#14401a', border: '#2ea043', text: '#3fb950' },
  'Good fit':   { bg: '#1a3a14', border: '#2ea043', text: '#56d364' },
  'Decent fit': { bg: '#3d2a00', border: '#9e6a03', text: '#f0883e' },
  'Not ideal':  { bg: '#3d1a1a', border: '#8b1a1a', text: '#f85149' },
}

function Stars({ rating }) {
  if (rating == null) return <span style={{ color: '#6e7681', fontSize: 13 }}>No rating</span>
  const filled = Math.round(rating)
  return (
    <span style={{ letterSpacing: 2, fontSize: 16 }} title={`${rating}/5`}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= filled ? '#f5a623' : '#30363d' }}>★</span>
      ))}
      <span style={{ color: '#8b949e', fontSize: 13, marginLeft: 6 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#1e2533', borderRadius: 8, padding: '8px 14px', minWidth: 80,
    }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: color || '#e6edf3' }}>{value ?? '—'}</span>
      <span style={{ fontSize: 11, color: '#6e7681', marginTop: 2 }}>{label}</span>
    </div>
  )
}

export default function ProfessorCard({ rec, index }) {
  const [expanded, setExpanded] = useState(false)
  const fit = FIT_CONFIG[rec.match_score] || FIT_CONFIG['Decent fit']

  const pct = v => v != null ? `${Math.round(v)}%` : '—'

  return (
    <div style={{
      background: '#161b27',
      border: '1px solid #2a3145',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = '#3d4a6a'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3145'}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: '#f5a623', color: '#0d1117',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 400, color: '#e6edf3' }}>
            {rec.instructor_name}
          </h3>
          <p style={{ fontSize: 13, color: '#6e7681', marginTop: 2 }}>
            Section {rec.section_number} &nbsp;·&nbsp; CRN {rec.crn}
            {rec.schedule ? ` · ${rec.schedule}` : ''}
          </p>
        </div>

        <span style={{
          background: fit.bg, border: `1px solid ${fit.border}`,
          color: fit.text, borderRadius: 20, padding: '4px 12px',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {rec.match_score}
        </span>
      </div>

      {/* RMP stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Stars rating={rec.rmp_rating} />
        <div style={{ display: 'flex', gap: 8, marginLeft: 4 }}>
          <StatPill label="Difficulty" value={rec.rmp_difficulty?.toFixed(1)} color="#f0883e" />
          <StatPill label="Would Retake" value={pct(rec.rmp_would_take_again)} color="#3fb950" />
          {rec.rmp_num_ratings != null && (
            <StatPill label="Ratings" value={rec.rmp_num_ratings} />
          )}
        </div>
      </div>

      {/* Explanation */}
      {rec.explanation && (
        <div>
          <p style={{
            fontSize: 14, color: '#c9d1d9', lineHeight: 1.6,
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'none' : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {rec.explanation}
          </p>
          {rec.explanation.length > 200 && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#f5a623', fontSize: 13, marginTop: 4, padding: 0,
            }}>
              {expanded ? 'Show less ▲' : 'Read more ▼'}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      {rec.rmp_url && (
        <a href={rec.rmp_url} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 13, color: '#f5a623', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          opacity: 0.85,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => e.currentTarget.style.opacity = 0.85}
        >
          View on Rate My Professors ↗
        </a>
      )}
    </div>
  )
}
