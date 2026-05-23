import React, { useEffect, useState } from 'react'

const STAGES = [
  { delay: 0,     text: 'Searching UNCG Banner for sections…' },
  { delay: 3000,  text: 'Matching instructors to Rate My Professors…' },
  { delay: 8000,  text: 'Ranking professors based on your preferences…' },
  { delay: 14000, text: 'Almost done, finalizing results…' },
]

/* ── Individual skeleton bone ──────────────────────────────────── */
function Bone({ className }) {
  return <div className={`shimmer-bone ${className}`} />
}

/* ── Skeleton professor card ───────────────────────────────────── */
function SkeletonCard({ delay = 0 }) {
  return (
    <div
      className="glass-panel p-5 sm:p-6 flex flex-col gap-4"
      style={{ opacity: 0, animation: `cardIn 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms both` }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Bone className="w-6 h-5 flex-none mt-1" />
        <Bone className="w-10 h-10 rounded-full flex-none" style={{ borderRadius: '50%' }} />
        <div className="flex-1 flex flex-col gap-2">
          <Bone className="h-5 w-40" />
          <Bone className="h-3 w-56" />
        </div>
        <Bone className="w-20 h-5 rounded-full flex-none" />
      </div>

      {/* Divider */}
      <div className="gold-rule opacity-30" />

      {/* Stats row */}
      <div className="flex items-start gap-5 flex-wrap">
        <Bone className="h-4 w-28" />
        <Bone className="h-8 w-16" />
        <Bone className="h-8 w-16" />
      </div>

      {/* Tags */}
      <div className="flex gap-1.5">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-5 w-14 rounded-full" />
      </div>

      {/* Explanation lines */}
      <div className="flex flex-col gap-2">
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-11/12" />
        <Bone className="h-3 w-3/4" />
      </div>
    </div>
  )
}

/* ── Main loading skeleton ─────────────────────────────────────── */
export default function LoadingSkeleton() {
  const [stageIndex, setStageIndex] = useState(0)
  const [stageKey, setStageKey] = useState(0)

  useEffect(() => {
    const timers = STAGES.slice(1).map((stage, i) =>
      setTimeout(() => {
        setStageIndex(i + 1)
        setStageKey(k => k + 1)
      }, stage.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex flex-col gap-5">

      {/* ── Scanner status bar ────────────────────────────── */}
      <div className="glass-panel px-5 py-4 flex items-center gap-4">

        {/* Animated scanner ring */}
        <div className="relative flex-none w-8 h-8 shrink-0">
          {/* Outer glow pulse */}
          <div
            className="absolute inset-0 rounded-full scan-pulse"
            style={{ background: 'radial-gradient(circle, rgba(232,160,32,0.2) 0%, transparent 70%)' }}
          />
          {/* Spinning arc */}
          <svg className="absolute inset-0 w-full h-full scan-ring" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="13" stroke="rgba(232,160,32,0.12)" strokeWidth="2.5"/>
            <path
              d="M16 3 A13 13 0 0 1 29 16"
              stroke="#e8a020"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          {/* Inner dot */}
          <div
            className="absolute inset-[10px] rounded-full"
            style={{ background: 'rgba(232,160,32,0.5)', boxShadow: '0 0 8px rgba(232,160,32,0.4)' }}
          />
        </div>

        {/* Stage text */}
        <span
          key={stageKey}
          className="text-sm text-parchment-dim flex-1 min-w-0 stage-text-enter truncate"
          style={{ fontFamily: 'Syne, system-ui, sans-serif', fontWeight: 500 }}
        >
          {STAGES[stageIndex].text}
        </span>

        {/* Progress dots */}
        <div className="flex gap-1.5 flex-none">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-500"
              style={{
                background: i <= stageIndex
                  ? '#e8a020'
                  : 'rgba(232,160,32,0.18)',
                boxShadow: i === stageIndex
                  ? '0 0 6px rgba(232,160,32,0.6)'
                  : 'none',
                transform: i === stageIndex ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Skeleton cards ────────────────────────────────── */}
      <SkeletonCard delay={60} />
      <SkeletonCard delay={160} />
      <SkeletonCard delay={260} />
    </div>
  )
}
