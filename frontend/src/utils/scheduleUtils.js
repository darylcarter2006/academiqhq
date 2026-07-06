function toMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function to24h(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = m[2]
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

function timeRangesOverlap(a, b) {
  const startA = toMinutes(a.startTime)
  const endA   = toMinutes(a.endTime)
  const startB = toMinutes(b.startTime)
  const endB   = toMinutes(b.endTime)
  if (startA == null || endA == null || startB == null || endB == null) return false
  return startA < endB && endA > startB
}

// Normalizes a course into its list of {days, startTime, endTime} meetings.
// Courses saved before multi-meeting support only have top-level
// days/startTime/endTime (one implicit meeting) — this keeps those working
// without a data migration.
export function getMeetings(course) {
  if (Array.isArray(course.meetings)) return course.meetings
  if ((course.days && course.days.length) || course.startTime || course.endTime) {
    return [{
      days: course.days ?? [],
      startTime: course.startTime ?? null,
      endTime: course.endTime ?? null,
    }]
  }
  return []
}

export function hasConflict(courseA, courseB) {
  const meetingsA = getMeetings(courseA)
  const meetingsB = getMeetings(courseB)
  return meetingsA.some(a => meetingsB.some(b => {
    const daysA = new Set(a.days ?? [])
    const daysB = new Set(b.days ?? [])
    const sharedDay = [...daysA].some(d => daysB.has(d))
    return sharedDay && timeRangesOverlap(a, b)
  }))
}

// Parse a Banner schedule string like "MWF 10:00 AM–10:50 AM" (en-dash
// U+2013) into every meeting it describes. A single section can meet on
// different days at different times — e.g. a lecture plus a recitation —
// formatted as "TR 9:30 AM–10:45 AM / W 10:00 AM–10:50 AM". Every
// ' / '-separated segment is parsed, not just the first, or the extra
// days silently vanish from the calendar.
export function parseScheduleString(scheduleStr) {
  if (!scheduleStr || scheduleStr.trim() === 'TBA') return []

  const segments = scheduleStr.split(' / ').map(s => s.trim()).filter(Boolean)
  const meetings = []

  for (const seg of segments) {
    // Match: DAYS HH:MM AM/PM–HH:MM AM/PM (en-dash or hyphen).
    // Banner day codes include S (Sat) and U (Sun); the calendar only
    // renders M–F columns, but weekend letters must not fail the parse.
    const match = seg.match(
      /^([MTWRFSU]+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i
    )
    if (!match) continue

    const days = [...match[1]].filter(ch => 'MTWRFSU'.includes(ch))
    meetings.push({
      days,
      startTime: to24h(match[2]),
      endTime:   to24h(match[3]),
    })
  }

  return meetings
}

export function getCoursePrefix(courseCode) {
  if (!courseCode) return ''
  return courseCode.trim().split(/[\s-]/)[0].toUpperCase()
}

// Returns Tailwind border+bg+text classes for a course block.
export function getCourseColor(courseCode) {
  const prefix = getCoursePrefix(courseCode)
  const map = {
    CSC: 'bg-blue-900/70 border-blue-700 text-blue-100',
    MAT: 'bg-green-900/70 border-green-700 text-green-100',
    BIO: 'bg-teal-900/70 border-teal-700 text-teal-100',
    STA: 'bg-purple-900/70 border-purple-700 text-purple-100',
  }
  return map[prefix] ?? 'bg-navy-600 border-navy-400 text-parchment'
}

// Grid: 8 AM (480 min) – 9 PM (1260 min), 64 px/hour (16 px/15 min), total 832 px.
const GRID_START_MIN = 480
const PX_PER_15 = 16

export function getBlockStyle(startTime, endTime) {
  const startMin = toMinutes(startTime)
  const endMin   = toMinutes(endTime)
  if (startMin == null || endMin == null) return null
  const top    = ((startMin - GRID_START_MIN) / 15) * PX_PER_15
  const height = ((endMin  - startMin)        / 15) * PX_PER_15
  return { top, height }
}

// Group same-day block instances (already filtered to one day column) into
// overlap buckets for side-by-side rendering. Items only need
// startTime/endTime — days are irrelevant since everything passed in is
// already known to fall on the same day.
export function groupOverlappingBlocks(blocksForDay) {
  const groups = []
  const assigned = new Set()

  for (let i = 0; i < blocksForDay.length; i++) {
    if (assigned.has(i)) continue
    const group = [blocksForDay[i]]
    assigned.add(i)
    for (let j = i + 1; j < blocksForDay.length; j++) {
      if (assigned.has(j)) continue
      if (group.some(g => timeRangesOverlap(g, blocksForDay[j]))) {
        group.push(blocksForDay[j])
        assigned.add(j)
      }
    }
    groups.push(group)
  }

  return groups
}
