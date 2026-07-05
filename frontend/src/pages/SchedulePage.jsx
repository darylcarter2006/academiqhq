import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSchedule } from '../hooks/useSchedule.js'
import { supabase } from '../lib/supabase.js'
import WeeklyCalendar from '../components/WeeklyCalendar.jsx'
import MergeScheduleModal from '../components/MergeScheduleModal.jsx'

const LS_KEY = 'academiq_schedule'

export default function SchedulePage() {
  const { courses, semester, removeCourse, clearSchedule, isLoading, syncError, user, addCourses } = useSchedule()
  const [showClearConfirm, setShowClearConfirm]   = useState(false)
  const [bannerDismissed, setBannerDismissed]     = useState(false)
  const [showMerge, setShowMerge]                 = useState(false)
  const prevUserRef = useRef(null)

  const isGuest = !user
  const showGuestBanner = isGuest && courses.length > 0 && !bannerDismissed

  // Detect OAuth redirect-back: user transitions null → defined
  useEffect(() => {
    if (user && prevUserRef.current === null) {
      try {
        const raw = localStorage.getItem(LS_KEY)
        const parsed = JSON.parse(raw ?? '[]')
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShowMerge(true)
        }
      } catch { /* ignore */ }
    }
    prevUserRef.current = user ?? null
  }, [user])

  async function handleMergeSave() {
    let saved = false
    try {
      const raw   = localStorage.getItem(LS_KEY)
      const parsed = JSON.parse(raw ?? '[]')
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { error } = await addCourses(parsed)
        saved = !error
      } else {
        saved = true
      }
    } catch { /* keep the local copy so nothing is lost */ }
    // Only discard the guest schedule once it's actually on the server;
    // on failure it stays in localStorage and the sync banner explains why.
    if (saved) localStorage.removeItem(LS_KEY)
    setShowMerge(false)
  }

  function handleMergeDiscard() {
    localStorage.removeItem(LS_KEY)
    setShowMerge(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gold border-t-transparent animate-spin-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 pt-8 sm:pt-14 pb-16">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">

        {/* Back to home */}
        <Link
          to="/"
          className="text-xs text-parchment-muted hover:text-gold transition-colors w-fit"
        >
          ← Back to recommendations
        </Link>

        {/* Sync error */}
        {syncError && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-5 py-4 text-sm text-red-400">
            <strong className="font-semibold">Sync error:</strong> {syncError}
          </div>
        )}

        {/* Guest banner */}
        {showGuestBanner && (
          <div className="bg-navy-700 border border-gold/30 rounded-xl px-5 py-4
                          flex items-start justify-between gap-4">
            <p className="text-sm text-parchment-dim leading-relaxed">
              You're building as a guest.{' '}
              <Link to="/signup" className="text-gold hover:text-gold-light transition-colors">
                Create a free account
              </Link>{' '}
              to save your schedule and access it anywhere.
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-parchment-muted hover:text-parchment text-xl leading-none flex-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-serif text-2xl sm:text-3xl text-parchment">My Schedule</h1>
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-xs text-parchment-muted hover:text-gold transition-colors"
              >
                Sign out
              </button>
            )}
            {!user && (
              <Link
                to="/login"
                className="text-xs text-parchment-muted border border-navy-400 rounded-full
                           px-3.5 py-2 hover:border-gold hover:text-gold transition-colors"
              >
                Sign in
              </Link>
            )}
            {courses.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm text-parchment-muted border border-navy-400 rounded-lg
                           px-4 py-2 hover:border-red-700 hover:text-red-400 transition-colors"
              >
                Clear Schedule
              </button>
            )}
          </div>
        </div>

        {/* Clear confirmation */}
        {showClearConfirm && (
          <div className="card p-5 flex flex-col gap-3 border-red-900">
            <p className="text-sm text-parchment">
              Clear your entire schedule? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => { await clearSchedule(); setShowClearConfirm(false) }}
                className="px-5 py-2 rounded-lg bg-red-900 text-red-100 text-sm font-bold
                           hover:bg-red-800 transition-colors"
              >
                Yes, Clear It
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-5 py-2 rounded-lg border border-navy-400 text-parchment-muted
                           text-sm hover:border-navy-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {courses.length === 0 && (
          <div className="card p-8 text-center flex flex-col gap-3 items-center">
            <p className="font-serif text-lg text-parchment">No courses yet</p>
            <p className="text-parchment-muted text-sm">
              Search for professors and click "Add to Schedule" to build your semester.
            </p>
            <Link
              to="/"
              className="text-gold hover:text-gold-light text-sm transition-colors mt-1"
            >
              Find professors →
            </Link>
          </div>
        )}

        {/* Calendar */}
        {courses.length > 0 && (
          <>
            <WeeklyCalendar courses={courses} semester={semester} />

            {/* Course list with remove buttons */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-parchment-muted uppercase tracking-widest">
                Enrolled Courses
              </h3>
              {courses.map(c => (
                <div key={c.crn} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-parchment font-semibold truncate">
                      {c.courseCode} · {c.professor}
                    </p>
                    <p className="text-xs text-parchment-muted truncate">
                      CRN {c.crn} · Section {c.section}
                      {c.creditHours ? ` · ${c.creditHours} cr` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCourse(c.crn)}
                    className="text-xs text-parchment-muted hover:text-red-400
                               transition-colors flex-none min-h-[36px] px-3"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      <MergeScheduleModal
        isOpen={showMerge}
        onSave={handleMergeSave}
        onDiscard={handleMergeDiscard}
      />
    </div>
  )
}
