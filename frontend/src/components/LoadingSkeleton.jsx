import React, { useEffect, useState } from 'react'

const STAGES = [
  { delay: 0,    text: 'Searching UNCG Banner for sections...' },
  { delay: 3000, text: 'Matching instructors to Rate My Professors...' },
  { delay: 8000, text: 'Asking Claude to rank and explain each professor...' },
  { delay: 14000, text: 'Almost done, finalizing results...' },
]

const pulse = `
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.9; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

function SkeletonCard() {
  const shimmer = {
    background: 'linear-gradient(90deg, #1e2533 25%, #252d3d 50%, #1e2533 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 6,
  }
  return (
    <div style={{
      background: '#161b27',
      border: '1px solid #2a3145',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ ...shimmer, width: 32, height: 32, borderRadius: '50%' }} />
        <div style={{ ...shimmer, width: 180, height: 18 }} />
        <div style={{ ...shimmer, width: 80, height: 22, marginLeft: 'auto', borderRadius: 20 }} />
      </div>
      <div style={{ ...shimmer, width: '60%', height: 13 }} />
      <div style={{ ...shimmer, width: '100%', height: 13 }} />
      <div style={{ ...shimmer, width: '90%', height: 13 }} />
      <div style={{ ...shimmer, width: '75%', height: 13 }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{pulse}</style>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
        background: '#161b27',
        border: '1px solid #2a3145',
        borderRadius: 10,
      }}>
        <div style={{
          width: 20, height: 20,
          border: '2px solid #f5a623',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
        <span style={{ color: '#c9d1d9', fontSize: 14 }}>
          {STAGES[stageIndex].text}
        </span>
      </div>
      {[0, 1, 2].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
