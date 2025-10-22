import * as React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './auth/AuthContext'
import GlobalLoading from './components/GlobalLoading'
import ErrorBoundary from './components/ErrorBoundary'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Analyze from './pages/Analyze'
import Train from './pages/Train'
import Predict from './pages/Predict'
import History from './pages/History'
import Account from './pages/Account'
import TrainingResults from './pages/TrainingResults'
import AutoMLResults from './pages/AutoMLResults'
import FileInputTest from './pages/FileInputTest'
import UploadDiagnostic from './pages/UploadDiagnostic'

// Components
import ProtectedRoute from './components/ProtectedRoute'
// import DebugAuth from './components/DebugAuth'

function App() {
  return (
    <AuthProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          {/* Animated background */}
          <div className="fixed inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
            <div className="absolute -inset-10 opacity-50">
              <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
              <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
            </div>
          </div>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#f8fafc',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f8fafc',
                },
              },
            }}
          />

          {/* <DebugAuth /> */}
          
          <GlobalLoading />
          <ErrorBoundary>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } />
            <Route path="/analyze" element={
              <ProtectedRoute>
                <Analyze />
              </ProtectedRoute>
            } />
            <Route path="/analyze/:datasetId" element={
              <ProtectedRoute>
                <Analyze />
              </ProtectedRoute>
            } />
            <Route path="/train" element={
              <ProtectedRoute>
                <Train />
              </ProtectedRoute>
            } />
            <Route path="/train/:datasetId" element={
              <ProtectedRoute>
                <Train />
              </ProtectedRoute>
            } />
            <Route path="/training-results/:modelId" element={
              <ProtectedRoute>
                <TrainingResults />
              </ProtectedRoute>
            } />
            <Route path="/predict" element={
              <ProtectedRoute>
                <Predict />
              </ProtectedRoute>
            } />
            <Route path="/predict/:datasetId" element={
              <ProtectedRoute>
                <Predict />
              </ProtectedRoute>
            } />
            {/* Visualization routes removed */}
            <Route path="/automl" element={
              <ProtectedRoute>
                <AutoMLResults />
              </ProtectedRoute>
            } />
            <Route path="/automl/:datasetId" element={
              <ProtectedRoute>
                <AutoMLResults />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            } />
            <Route path="/account" element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            } />
            <Route path="/file-input-test" element={<FileInputTest />} />
            <Route path="/upload-diagnostic" element={<UploadDiagnostic />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App