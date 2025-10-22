import React from 'react'

type ErrorBoundaryState = { hasError: boolean; error?: any }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    console.error('Unhandled error in component tree:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-100">
          <div className="p-6 rounded-lg bg-slate-800 border border-slate-700 max-w-md text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-slate-300 mb-4">Try reloading the page or returning to the dashboard.</p>
            <div className="flex gap-2 justify-center">
              <button className="px-4 py-2 bg-purple-600 rounded" onClick={() => window.location.reload()}>Reload</button>
              <a href="/dashboard" className="px-4 py-2 bg-slate-700 rounded">Go to Dashboard</a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}


