function toMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export function hasConflict(courseA, courseB) {
  const daysA = new Set(courseA.days ?? [])
  const daysB = new Set(courseB.days ?? [])
  const sharedDay = [...daysA].some(d => daysB.has(d))
  if (!sharedDay) return false

  const startA = toMinutes(courseA.startTime)
  const endA   = toMinutes(courseA.endTime)
  const startB = toMinutes(courseB.startTime)
  const endB   = toMinutes(courseB.endTime)
  if (startA == null || endA == null || startB == null || endB == null) return false

  return startA < endB && endA > startB
}

// Parse a Banner schedule string like "MWF 10:00 AM–10:50 AM" (en-dash U+2013).
// Handles "TR 2:00 PM–3:15 PM", multi-meeting "MWF ... / T ...", and "TBA".
export function parseScheduleString(scheduleStr) {
  if (!scheduleStr || scheduleStr.trim() === 'TBA') {
    return { days: [], startTime: null, endTime: null }
  }

  const first = scheduleStr.split(' / ')[0].trim()

  // Match: DAYS HH:MM AM/PM–HH:MM AM/PM (en-dash or hyphen)
  const match = first.match(
    /^([MTWRF]+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i
  )
  if (!match) return { days: [], startTime: null, endTime: null }

  const dayStr = match[1]
  const days = [...dayStr].filter(ch => 'MTWRF'.includes(ch))

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

  return {
    days,
    startTime: to24h(match[2]),
    endTime:   to24h(match[3]),
  }
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

// Group courses in a single day column into overlap buckets.
// Returns an array of groups; each group is an array of course objects that
// overlap with at least one other course in the group.
// Courses with no overlap sit in their own single-item group.
export function groupOverlappingBlocks(coursesForDay) {
  const groups = []
  const assigned = new Set()

  for (let i = 0; i < coursesForDay.length; i++) {
    if (assigned.has(i)) continue
    const group = [coursesForDay[i]]
    assigned.add(i)
    for (let j = i + 1; j < coursesForDay.length; j++) {
      if (assigned.has(j)) continue
      // Check against any member already in the group
      if (group.some(g => hasConflict(g, coursesForDay[j]))) {
        group.push(coursesForDay[j])
        assigned.add(j)
      }
    }
    groups.push(group)
  }

  return groups
}
