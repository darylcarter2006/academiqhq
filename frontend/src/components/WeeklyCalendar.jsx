import React from 'react'
import { getBlockStyle, getCourseColor, hasConflict, groupOverlappingBlocks } from '../utils/scheduleUtils.js'

const DAYS = ['M', 'T', 'W', 'R', 'F']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
// 14 labels: 8 AM through 9 PM inclusive
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8)
const GRID_HEIGHT = 832 // 13 hours × 64px

function formatHour(h) {
  if (h === 12) return '12 PM'
  if (h === 0)  return '12 AM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function CourseBlock({ course, style, widthPct, leftPct, isConflicting, onRemove }) {
  const colorClass = getCourseColor(course.courseCode)
  const lastName = course.professor?.split(' ').pop() ?? course.professor ?? ''

  return (
    <div
      className={`absolute border rounded overflow-hidden cursor-default select-none ${colorClass}`}
      style={{
        top:    style.top,
        height: style.height,
        width:  `${widthPct}%`,
        left:   `${leftPct}%`,
      }}
      title={`${course.courseCode} — ${course.professor}\n${formatTime(course.startTime)}–${formatTime(course.endTime)}`}
    >
      <div className="px-1.5 py-1 h-full overflow-hidden flex flex-col">
        <p className="text-[11px] font-semibold leading-tight truncate">{course.courseCode}</p>
        {style.height >= 32 && (
          <p className="text-[10px] leading-tight truncate opacity-80">{lastName}</p>
        )}
        {style.height >= 52 && course.room && course.room !== 'TBA' && (
          <p className="text-[10px] leading-tight opacity-70 truncate">{course.room}</p>
        )}
        {style.height >= 68 && (
          <p className="text-[10px] leading-tight opacity-70 mt-auto">
            {formatTime(course.startTime)}–{formatTime(course.endTime)}
          </p>
        )}
      </div>
      {/* Conflict badge */}
      {isConflicting && (
        <div
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500"
          title="Time conflict"
        />
      )}
    </div>
  )
}

export default function WeeklyCalendar({ courses, semester }) {
  const totalCredits = courses.reduce((sum, c) => sum + (Number(c.creditHours) || 0), 0)

  // Compute conflict set across all courses
  const conflictingCrns = new Set()
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      if (hasConflict(courses[i], courses[j])) {
        conflictingCrns.add(courses[i].crn)
        conflictingCrns.add(courses[j].crn)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-serif text-xl text-parchment">
          {semester || 'My Schedule'}
        </h2>
        <span className="text-sm text-parchment-muted">
          {totalCredits} Credit Hour{totalCredits !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="card overflow-x-auto p-0">
        <div className="min-w-[560px]">
          {/* Day headers */}
          <div className="flex border-b border-navy-400">
            <div className="w-14 flex-none" />
            {DAY_LABELS.map(d => (
              <div
                key={d}
                className="flex-1 text-center py-2 text-xs font-semibold
                           text-parchment-muted uppercase tracking-widest"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex" style={{ height: GRID_HEIGHT }}>
            {/* Time labels */}
            <div className="w-14 flex-none relative">
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-parchment-muted leading-none"
                  style={{ top: (h - 8) * 64 - 6 }}
                >
                  {formatHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map(day => {
              const dayCoursesWithStyle = courses
                .filter(c => (c.days ?? []).includes(day) && getBlockStyle(c.startTime, c.endTime))
              const groups = groupOverlappingBlocks(dayCoursesWithStyle)

              return (
                <div key={day} className="flex-1 relative border-l border-navy-400">
                  {/* Hour gridlines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-navy-400/40"
                      style={{ top: (h - 8) * 64 }}
                    />
                  ))}

                  {/* Course blocks — render each overlap group side by side */}
                  {groups.map((group) =>
                    group.map((course, idx) => {
                      const style = getBlockStyle(course.startTime, course.endTime)
                      if (!style) return null
                      const widthPct = 100 / group.length
                      const leftPct  = idx * widthPct
                      return (
                        <CourseBlock
                          key={course.crn}
                          course={course}
                          style={style}
                          widthPct={widthPct - 0.5}
                          leftPct={leftPct}
                          isConflicting={conflictingCrns.has(course.crn)}
                        />
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
