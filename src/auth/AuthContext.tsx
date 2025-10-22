import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import axios from 'axios'
import toast from 'react-hot-toast'

type AuthContextType = {
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  signup: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  api: ReturnType<typeof axios.create>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      try {
        // Validate token format (basic check)
        const parts = storedToken.split('.')
        if (parts.length === 3) {
          return storedToken
        }
      } catch (e) {
        console.warn('Invalid token format, clearing...')
        localStorage.removeItem('token')
      }
    }
    return null
  })

  const [loadingCount, setLoadingCount] = useState<number>(0)
  const isLoading = loadingCount > 0

  const api = useMemo(() => {
    // Resolve and validate base URL; fall back if invalid
    const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api'
    let baseURLCandidate: string | undefined
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      baseURLCandidate = (import.meta as any).env.VITE_API_BASE_URL as string | undefined
    }
    let baseURL = DEFAULT_BASE_URL
    try {
      if (baseURLCandidate) {
        const url = new URL(baseURLCandidate)
        // Basic sanity checks: localhost/127.0.0.1 with port, ends with /api (optional)
        if (!url.protocol.startsWith('http')) throw new Error('Invalid protocol')
        baseURL = baseURLCandidate
      }
    } catch {
      console.warn(`⚠️ Invalid VITE_API_BASE_URL provided (${baseURLCandidate}); falling back to ${DEFAULT_BASE_URL}`)
      baseURL = DEFAULT_BASE_URL
    }
    
    console.log(`🔧 Using API base URL: ${baseURL}`)

    const instance = axios.create({ baseURL })
    
    // Request interceptor
    instance.interceptors.request.use((config) => {
      setLoadingCount((c) => c + 1)
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        console.log(`🚀 Sending request to ${config.url} with token: ${token.substring(0, 20)}...`)
      } else {
        console.warn(`⚠️ No token available for request to ${config.url}`)
      }
      return config
    })
    
    // Response interceptor with centralized error handling and basic retry
    const MAX_RETRIES = 1
    instance.interceptors.response.use(
      (response) => {
        setLoadingCount((c) => Math.max(0, c - 1))
        console.log(`✅ Response from ${response.config.url}: ${response.status}`)
        return response
      },
      async (error) => {
        setLoadingCount((c) => Math.max(0, c - 1))
        const status = error.response?.status
        const url = error.config?.url
        
        // Check for CORS errors specifically
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          console.error(`❌ CORS/Network Error from ${url}: ${error.message}`)
          console.error(`❌ This might be a CORS issue. Check if backend is running and CORS is configured properly.`)
        } else {
          console.error(`❌ Error from ${url}: ${status} -`, error.response?.data)
        }

        // Retry once on 502/503/504 network/server hiccups
        const retriable = [502, 503, 504]
        const cfg: any = error.config || {}
        cfg.__retryCount = cfg.__retryCount || 0
        if (retriable.includes(status) && cfg.__retryCount < MAX_RETRIES) {
          cfg.__retryCount += 1
          console.warn(`🔁 Retrying ${url} (attempt ${cfg.__retryCount})`)
          return instance(cfg)
        }

        if (status === 401) {
          console.warn('401 Unauthorized - clearing token')
          setToken(null)
          localStorage.removeItem('token')
          try {
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
          } catch {}
        } else {
          // Avoid duplicate toasts for prediction 400s that are handled in-page
          const isPredict = typeof url === 'string' && url.includes('/predict/')
          if (!(status === 400 && isPredict)) {
            const msg = error.response?.data?.detail || error.message || 'Request failed'
            try {
              toast.error(typeof msg === 'string' ? msg : 'An unexpected error occurred')
            } catch {}
          }
        }

        return Promise.reject(error)
      }
    )
    return instance
  }, [token])

  const login = async (username: string, password: string) => {
    const form = new URLSearchParams({ username, password })
    
    // Create a separate axios instance for login (no auth required)
    const baseURL = typeof import.meta !== 'undefined' &&
      typeof (import.meta as any).env !== 'undefined' &&
      (import.meta as any).env.VITE_API_BASE_URL
        ? (import.meta as any).env.VITE_API_BASE_URL
        : 'http://127.0.0.1:8000/api'
    
    const loginApi = axios.create({ baseURL })
    
    console.log(`🔐 Attempting login for user: ${username}`)
    const res = await loginApi.post('/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    console.log(`✅ Login successful, token received: ${res.data.access_token.substring(0, 20)}...`)
    
    setToken(res.data.access_token)
    localStorage.setItem('token', res.data.access_token)
  }

  const signup = async (email: string, username: string, password: string) => {
    // Create a separate axios instance for signup (no auth required)
    const baseURL = typeof import.meta !== 'undefined' &&
      typeof (import.meta as any).env !== 'undefined' &&
      (import.meta as any).env.VITE_API_BASE_URL
        ? (import.meta as any).env.VITE_API_BASE_URL
        : 'http://127.0.0.1:8000/api'
    
    const signupApi = axios.create({ baseURL })
    
    console.log(`📝 Attempting signup for user: ${username}`)
    await signupApi.post('/signup', { email, username, password })
    console.log(`✅ Signup successful, proceeding to login`)
    
    await login(username, password)
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem('token')
  }

  const value = useMemo<AuthContextType>(() => ({ token, isAuthenticated: !!token, login, signup, logout, api, isLoading }), [token, api, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


