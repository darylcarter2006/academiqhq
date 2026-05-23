import React, { useState } from 'react'

const MATCH_CONFIG = {
  'Great fit': {
    color: '#10b981',
    textClass: 'text-emerald-400',
    bg: 'rgba(6,78,59,0.45)',
    border: 'rgba(16,185,129,0.35)',
    glow: 'rgba(16,185,129,0.18)',
  },
  'Good fit': {
    color: '#5ec8f0',
    textClass: 'text-arctic',
    bg: 'rgba(8,60,88,0.45)',
    border: 'rgba(94,200,240,0.32)',
    glow: 'rgba(94,200,240,0.15)',
  },
  'Decent fit': {
    color: '#f59e0b',
    textClass: 'text-amber-400',
    bg: 'rgba(78,53,6,0.45)',
    border: 'rgba(245,158,11,0.32)',
    glow: 'rgba(245,158,11,0.15)',
  },
  'Not ideal': {
    color: '#f43f5e',
    textClass: 'text-rose-400',
    bg: 'rgba(76,8,22,0.45)',
    border: 'rgba(244,63,94,0.32)',
    glow: 'rgba(244,63,94,0.15)',
  },
}

/* ── Star rating ───────────────────────────────────────────────── */
function StarRating({ rating }) {
  if (rating == null) {
    return <span className="text-xs text-parchment-muted italic">No rating</span>
  }
  const full = Math.floor(rating)
  const frac = rating - full

  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => {
          const filled = i <= full
          const half   = !filled && i === full + 1 && frac >= 0.3
          return (
            <svg key={i} className="w-3.5 h-3.5 flex-none" viewBox="0 0 24 24">
              <defs>
                <linearGradient id={`hg${i}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset={`${Math.round(frac * 100)}%`} stopColor="#e8a020" />
                  <stop offset={`${Math.round(frac * 100)}%`} stopColor="rgba(232,160,32,0.15)" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={filled ? '#e8a020' : half ? `url(#hg${i})` : 'rgba(232,160,32,0.12)'}
              />
            </svg>
          )
        })}
      </span>
      <span className="font-mono text-sm font-semibold text-parchment-dim">
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

/* ── Horizontal stat bar ───────────────────────────────────────── */
function StatBar({ label, value, max, isPct, color }) {
  const pct    = isPct ? Math.min(100, value) : Math.min(100, (value / max) * 100)
  const display = isPct ? `${Math.round(value)}%` : value.toFixed(1)

  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {display}
        </span>
        <span className="text-[10px] text-parchment-muted leading-none">{label}</span>
      </div>
      <div
        className="h-[3px] rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full stat-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

/* ── Initials avatar ───────────────────────────────────────────── */
function Avatar({ name, matchColor }) {
  const parts    = name.trim().split(/\s+/)
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()

  return (
    <div
      className="flex-none w-10 h-10 rounded-full flex items-center justify-center
                 text-xs font-bold tracking-wide shrink-0 select-none"
      style={{
        background: `radial-gradient(circle at 35% 35%, ${matchColor}38, ${matchColor}14)`,
        border: `1px solid ${matchColor}40`,
        color: matchColor,
        fontFamily: 'Syne, system-ui, sans-serif',
      }}
    >
      {initials}
    </div>
  )
}

/* ── Main card ─────────────────────────────────────────────────── */
export default function ProfessorCard({ rec, index }) {
  const [expanded, setExpanded] = useState(false)

  const match = MATCH_CONFIG[rec.match_score] || MATCH_CONFIG['Decent fit']
  const tags  = rec.rmp_tags?.filter(Boolean) ?? []
  const hasWTA = rec.rmp_would_take_again != null && rec.rmp_would_take_again >= 0

  const sectionMeta = [
    rec.section_number && `Sec ${rec.section_number}`,
    rec.crn            && `CRN ${rec.crn}`,
    rec.schedule,
  ].filter(Boolean).join('  ·  ')

  return (
    <article
      className="glass-card p-5 sm:p-6 flex flex-col gap-4 card-enter"
      style={{ animationDelay: `${index * 90}ms` }}
    >

      {/* ── Header: rank · avatar · name · match badge ── */}
      <div className="flex items-start gap-3">

        {/* Rank numeral */}
        <div
          className="flex-none w-6 text-center select-none font-mono font-semibold leading-none mt-1"
          style={{ fontSize: '1.1rem', color: 'rgba(232,160,32,0.32)' }}
        >
          {index + 1}
        </div>

        {/* Avatar */}
        <Avatar name={rec.instructor_name} matchColor={match.color} />

        {/* Name + section meta */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-serif text-lg sm:text-xl leading-tight text-parchment break-words"
            style={{ letterSpacing: '-0.01em' }}
          >
            {rec.instructor_name}
          </h3>
          {sectionMeta && (
            <p className="font-mono text-[10px] text-parchment-muted mt-1 break-words leading-relaxed">
              {sectionMeta}
            </p>
          )}
        </div>

        {/* Match score badge */}
        <span
          className="match-badge flex-none"
          style={{
            background: match.bg,
            border: `1px solid ${match.border}`,
            color: match.color,
            boxShadow: `0 0 14px ${match.glow}`,
          }}
        >
          <span
            className="match-dot"
            style={{ background: match.color, boxShadow: `0 0 6px ${match.color}` }}
          />
          {rec.match_score}
        </span>
      </div>

      {/* ── Divider ────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="flex items-start gap-5 flex-wrap">
        <StarRating rating={rec.rmp_rating} />

        {rec.rmp_difficulty != null && (
          <StatBar
            label="Difficulty"
            value={rec.rmp_difficulty}
            max={5}
            color="#f59e0b"
          />
        )}

        {hasWTA && (
          <StatBar
            label="Retake"
            value={rec.rmp_would_take_again}
            max={100}
            isPct
            color="#10b981"
          />
        )}

        {rec.rmp_num_ratings > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm font-semibold text-parchment-dim">
              {rec.rmp_num_ratings}
            </span>
            <span className="text-[10px] text-parchment-muted">Ratings</span>
          </div>
        )}
      </div>

      {/* ── Tags ───────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map(tag => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
      )}

      {/* ── AI explanation ─────────────────────────────── */}
      {rec.explanation && (
        <div>
          <p
            className={`text-sm text-parchment-dim leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
            style={{ letterSpacing: '0.005em' }}
          >
            {rec.explanation}
          </p>
          {rec.explanation.length > 200 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[11px] font-semibold mt-2 transition-colors duration-150 min-h-[36px]
                         flex items-center gap-1"
              style={{ color: 'rgba(232,160,32,0.55)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,160,32,0.55)'}
            >
              {expanded ? '↑ Show less' : '↓ Read more'}
            </button>
          )}
        </div>
      )}

      {/* ── RMP link ───────────────────────────────────── */}
      {rec.rmp_url && (
        <a
          href={rec.rmp_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold inline-flex items-center gap-1.5 w-fit
                     min-h-[36px] transition-colors duration-150"
          style={{ color: 'rgba(94,200,240,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--arctic)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(94,200,240,0.5)'}
        >
          <span>View on Rate My Professors</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </a>
      )}

    </article>
  )
}
