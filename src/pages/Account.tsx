import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import { User, Mail, Calendar, Save, Loader2, LogOut } from 'lucide-react'

interface UserData {
  id: number
  email: string
  username: string
  created_at: string
}

const Account: React.FC = () => {
  const { api, logout } = useAuth()
  const [user, setUser] = useState<UserData | null>(null)
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await api.get('/account')
      setUser(response.data)
      setUsername(response.data.username)
    } catch (error: any) {
      toast.error('Failed to load account data')
      console.error('Account fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!username.trim()) {
      toast.error('Username cannot be empty')
      return
    }

    setSaving(true)
    try {
      const response = await api.put('/account', { username })
      setUser(response.data)
      toast.success('Account updated successfully!')
    } catch (error: any) {
      toast.error('Failed to update account')
      console.error('Account update error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Loading account...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-slate-400">Failed to load account data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold text-white">Account Settings</h1>
        <p className="text-slate-400 text-lg">Manage your account information</p>
      </motion.div>

      <div className="max-w-2xl space-y-6">
        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <User className="h-6 w-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Profile Information</h2>
          </div>

          <div className="space-y-6">
            {/* Email */}
            <div className="flex items-center space-x-4 p-4 bg-slate-700/30 rounded-lg">
              <Mail className="h-5 w-5 text-blue-400" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <p className="text-white">{user.email}</p>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Username</label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter your username"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={save}
                  disabled={saving || username === user.username}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </motion.button>
              </div>
            </div>

            {/* Join Date */}
            <div className="flex items-center space-x-4 p-4 bg-slate-700/30 rounded-lg">
              <Calendar className="h-5 w-5 text-green-400" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Member Since</label>
                <p className="text-white">{new Date(user.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Account Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">User ID</p>
                <p className="text-white text-2xl font-bold">#{user.id}</p>
              </div>
              <User className="h-8 w-8 text-white/80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Account Status</p>
                <p className="text-white text-2xl font-bold">Active</p>
              </div>
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium mb-1">Sign Out</h3>
              <p className="text-slate-400 text-sm">Sign out of your AutoML account</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="flex items-center space-x-2 px-6 py-3 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30 transition-colors border border-red-500/30"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Account


