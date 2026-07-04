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
  const [user, setUser]       = useState(null)
  const [courses, setCourses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const tokenRef = useRef(null)

  const semester = courses[0]?.semester ?? ''

  const loadFromBackend = useCallback(async (userId, token) => {
    try {
      const data = await apiFetch(`/schedule/${userId}`, 'GET', undefined, token)
      setCourses(data.courses ?? [])
    } catch (err) {
      console.error('[useSchedule] Failed to load from backend:', err)
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
          setIsLoading(true)
          await loadFromBackend(session.user.id, session.access_token)
          if (mounted) setIsLoading(false)
        } else {
          tokenRef.current = null
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
      } catch (err) {
        console.error('[useSchedule] addCourse sync failed:', err)
      }
    } else {
      writeLocalStorage(newCourses)
    }

    return { error: null }
  }, [courses, semester, user])

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

  return { courses, semester, addCourse, removeCourse, clearSchedule, isLoading, user }
}
