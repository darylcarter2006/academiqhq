import React from 'react'
import { Analytics } from '@vercel/analytics/react'
import Home from './pages/Home.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a logging service
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <p className="text-gold font-semibold mb-2">Something went wrong</p>
            <p className="text-parchment-muted text-sm mb-4">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-lg bg-gold text-navy-900 text-sm font-bold"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Home />
      <Analytics />
    </ErrorBoundary>
  )
}
