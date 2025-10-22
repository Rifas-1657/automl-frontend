import React from 'react'
import { useAuth } from '../auth/AuthContext'

const DebugAuth: React.FC = () => {
  const { token, isAuthenticated, api } = useAuth()
  
  const testApiCall = async () => {
    try {
      console.log('🧪 Testing API call...')
      const response = await api.get('/test-auth')
      console.log('✅ API call successful:', response.data)
    } catch (error: any) {
      console.error('❌ API call failed:', error)
    }
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 p-4 rounded-lg shadow-lg text-white text-sm max-w-sm">
      <h3 className="font-bold mb-2">🔍 Auth Debug</h3>
      <div className="space-y-1">
        <div>Token: {token ? `${token.substring(0, 20)}...` : 'None'}</div>
        <div>Authenticated: {isAuthenticated ? '✅' : '❌'}</div>
        <div>API Base: {api.defaults.baseURL}</div>
        <button 
          onClick={testApiCall}
          className="mt-2 px-3 py-1 bg-blue-600 rounded text-xs hover:bg-blue-700"
        >
          Test API Call
        </button>
      </div>
    </div>
  )
}

export default DebugAuth
