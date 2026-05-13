import React, { useEffect, useState } from 'react'

const STAGES = [
  { delay: 0,     text: 'Searching UNCG Banner for sections…' },
  { delay: 3000,  text: 'Matching instructors to Rate My Professors…' },
  { delay: 8000,  text: 'Asking Claude to rank and explain each professor…' },
  { delay: 14000, text: 'Almost done, finalizing results…' },
]

function SkeletonCard() {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="animate-shimmer w-9 h-9 rounded-full flex-none" />
        <div className="animate-shimmer h-5 w-44 rounded" />
        <div className="animate-shimmer h-6 w-20 rounded-full ml-auto" />
      </div>
      <div className="animate-shimmer h-3 w-3/5 rounded" />
      <div className="flex gap-2 mt-1">
        <div className="animate-shimmer h-12 w-20 rounded-lg" />
        <div className="animate-shimmer h-12 w-20 rounded-lg" />
        <div className="animate-shimmer h-12 w-20 rounded-lg" />
      </div>
      <div className="animate-shimmer h-3 w-full rounded mt-1" />
      <div className="animate-shimmer h-3 w-11/12 rounded" />
      <div className="animate-shimmer h-3 w-4/5 rounded" />
    </div>
  )
}

export default function LoadingSkeleton() {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const timers = STAGES.slice(1).map((stage, i) =>
      setTimeout(() => setStageIndex(i + 1), stage.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Status bar */}
      <div className="card flex items-center gap-3.5 px-5 py-4">
        <div className="flex-none w-5 h-5 rounded-full border-2 border-gold border-t-transparent animate-spin-gold" />
        <span className="text-sm text-parchment-dim">{STAGES[stageIndex].text}</span>
      </div>

      {/* Skeleton cards */}
      {[0, 1, 2].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
