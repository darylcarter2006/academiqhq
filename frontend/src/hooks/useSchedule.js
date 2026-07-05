import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { hasConflict } from '../utils/scheduleUtils.js'

const LS_KEY = 'academiq_schedule'
const API_BASE = import.meta.env.VITE_API_URL || ''

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalStorage(courses) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(courses))
  } catch {
    // Ignore storage errors (private browsing, quota exceeded)
  }
}

async function apiFetch(path, method = 'GET', body, token) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail ?? `Server error ${res.status}`)
  }
  return res.json()
}

export function useSchedule() {
  const [user, setUser]         = useState(null)
  const [courses, setCourses]   = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncError, setSyncError] = useState(null)
  const tokenRef = useRef(null)
  const loadedUserRef = useRef(null)

  const semester = courses[0]?.semester ?? ''

  const loadFromBackend = useCallback(async (userId, token) => {
    try {
      const data = await apiFetch(`/schedule/${userId}`, 'GET', undefined, token)
      setCourses(data.courses ?? [])
      setSyncError(null)
    } catch (err) {
      console.error('[useSchedule] Failed to load from backend:', err)
      setSyncError(err.message)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session?.user) {
          tokenRef.current = session.access_token
          setUser(session.user)
          // TOKEN_REFRESHED and tab-refocus re-emit SIGNED_IN for the same
          // user; reloading then would clobber unsynced local changes.
          if (loadedUserRef.current !== session.user.id) {
            setIsLoading(true)
            await loadFromBackend(session.user.id, session.access_token)
            loadedUserRef.current = session.user.id
            if (mounted) setIsLoading(false)
          }
        } else {
          tokenRef.current = null
          loadedUserRef.current = null
          setUser(null)
          setCourses(readLocalStorage())
          setIsLoading(false)
        }
      }
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session) {
        setCourses(readLocalStorage())
        setIsLoading(false)
      }
      // session present: onAuthStateChange fires and handles it
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadFromBackend])

  const addCourse = useCallback(async (course, semesterLabel) => {
    if (courses.some(c => c.crn === course.crn)) {
      return { error: 'This section is already in your schedule.' }
    }

    // Conflicts are allowed — addCourse never blocks them, only the calendar warns.
    const newCourses = [...courses, { ...course, semester: semesterLabel || semester }]

    setCourses(newCourses)

    if (user && tokenRef.current) {
      try {
        await apiFetch(
          `/schedule/${user.id}`,
          'POST',
          { semester: semesterLabel || semester, courses: newCourses },
          tokenRef.current,
        )
        setSyncError(null)
      } catch (err) {
        console.error('[useSchedule] addCourse sync failed:', err)
        setSyncError(`Schedule not saved: ${err.message}`)
      }
    } else {
      writeLocalStorage(newCourses)
    }

    return { error: null }
  }, [courses, semester, user])

  // Batch add (used by the guest-schedule merge): dedupes by CRN and issues a
  // single save, unlike calling addCourse in a loop which would race itself.
  const addCourses = useCallback(async (coursesToAdd) => {
    const additions = coursesToAdd.filter(c => !courses.some(e => e.crn === c.crn))
    if (additions.length === 0) return { error: null }

    const newCourses = [...courses, ...additions]
    setCourses(newCourses)

    if (user && tokenRef.current) {
      try {
        await apiFetch(
          `/schedule/${user.id}`,
          'POST',
          { semester: newCourses[0]?.semester ?? '', courses: newCourses },
          tokenRef.current,
        )
        setSyncError(null)
      } catch (err) {
        console.error('[useSchedule] addCourses sync failed:', err)
        setSyncError(`Schedule not saved: ${err.message}`)
        return { error: err.message }
      }
    } else {
      writeLocalStorage(newCourses)
    }

    return { error: null }
  }, [courses, user])

  const removeCourse = useCallback(async (crn) => {
    const newCourses = courses.filter(c => c.crn !== crn)
    setCourses(newCourses)

    if (user && tokenRef.current) {
      try {
        await apiFetch(
          `/schedule/${user.id}/course/${crn}`,
          'DELETE',
          undefined,
          tokenRef.current,
        )
      } catch (err) {
        console.error('[useSchedule] removeCourse sync failed:', err)
      }
    } else {
      writeLocalStorage(newCourses)
    }
  }, [courses, user])

  const clearSchedule = useCallback(async () => {
    setCourses([])

    if (user && tokenRef.current) {
      try {
        await apiFetch(
          `/schedule/${user.id}`,
          'POST',
          { semester: '', courses: [] },
          tokenRef.current,
        )
      } catch (err) {
        console.error('[useSchedule] clearSchedule sync failed:', err)
      }
    } else {
      localStorage.removeItem(LS_KEY)
    }
  }, [user])

  return { courses, semester, addCourse, addCourses, removeCourse, clearSchedule, isLoading, syncError, user }
}
