import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import {
  Home,
  Upload,
  Brain,
  BarChart3,
  Target,
  History,
  User,
  LogOut,
  Zap
} from 'lucide-react'

const Sidebar: React.FC = () => {
  const location = useLocation()
  const { logout } = useAuth()

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Upload, label: 'Upload Dataset', path: '/upload' },
    { icon: Brain, label: 'Analyze', path: '/analyze' },
    // Visualizations entry removed
    { icon: Target, label: 'Predictions', path: '/predict' },
    { icon: History, label: 'History', path: '/history' },
    { icon: User, label: 'Account', path: '/account' },
  ]

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed left-0 top-0 h-full w-64 bg-slate-800/90 backdrop-blur-xl border-r border-slate-700/50 z-50"
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 border-b border-slate-700/50"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AutoML</h1>
              <p className="text-sm text-slate-400">Intelligent Analytics</p>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'
                  }`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="ml-auto w-2 h-2 bg-purple-400 rounded-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 border-t border-slate-700/50"
        >
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
          >
            <LogOut className="h-5 w-5 text-slate-400 group-hover:text-red-400 transition-colors" />
            <span className="font-medium">Logout</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default Sidebar