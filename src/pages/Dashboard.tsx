import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import useAppStore from '../store/useAppStore'
import {
  Upload,
  Brain,
  BarChart3,
  Target,
  Database,
  TrendingUp,
  Zap,
  ArrowRight
} from 'lucide-react'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
}

interface RecentModel {
  id: number
  algorithm: string
  task_type: string
  created_at: string
  metrics: {
    r2_score?: number
    accuracy?: number
    mse?: number
  }
}

const Dashboard: React.FC = () => {
  const { api } = useAuth()
  
  // Global state
  const {
    availableDatasets,
    recentModels,
    setAvailableDatasets,
    setRecentModels,
    setLoadingDatasets,
    setLoadingModels,
    isLoadingDatasets,
    isLoadingModels
  } = useAppStore()
  
  const [loading, setLoading] = useState(true)

  const getModelScore = (model: RecentModel) => {
    if (model.metrics.r2_score !== undefined) {
      return `R²: ${model.metrics.r2_score.toFixed(3)}`
    }
    if (model.metrics.accuracy !== undefined) {
      return `Acc: ${(model.metrics.accuracy * 100).toFixed(1)}%`
    }
    return 'Pending training...'
  }

  const getModelScoreDisplay = (model: RecentModel) => {
    if (model.metrics.r2_score !== undefined) {
      return (model.metrics.r2_score * 100).toFixed(1) + '%'
    }
    if (model.metrics.accuracy !== undefined) {
      return (model.metrics.accuracy * 100).toFixed(1) + '%'
    }
    return 'Pending...'
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      console.log('📊 Fetching dashboard data...')
      const [datasetsRes, historyRes] = await Promise.all([
        api.get('/datasets'),
        api.get('/history')
      ])
      
      console.log('✅ Dashboard data fetched successfully')
      console.log('📊 Datasets:', datasetsRes.data)
      console.log('🤖 History:', historyRes.data)
      
      // Update global state
      setAvailableDatasets(datasetsRes.data)
      
      // Fix: Ensure we get models from the correct structure
      const models = historyRes.data?.models || []
      const processedModels = models.slice(0, 3).map((model: any) => ({
        id: model.model_id || model.id,
        algorithm: model.algorithm,
        task_type: model.task_type,
        created_at: model.created_at,
        metrics: model.metrics || {}
      }))
      
      console.log('🤖 Recent models processed:', processedModels)
      setRecentModels(processedModels)
    } catch (error: any) {
      console.error('❌ Failed to fetch dashboard data:', error)
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message,
        url: error.config?.url
      })
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    {
      title: 'Total Datasets',
      value: availableDatasets.length,
      icon: Database,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Models Trained',
      value: recentModels.length,
      icon: Brain,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Predictions Made',
      value: '24',
      icon: Target,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Accuracy Score',
      value: '94.2%',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500'
    }
  ]

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-slate-700 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-700 rounded-lg"></div>
            ))}
          </div>
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
        <h1 className="text-4xl font-bold text-white">Welcome to AutoML</h1>
        <p className="text-slate-400 text-lg">Transform your data into intelligent insights</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={`bg-gradient-to-br ${stat.color} p-6 rounded-xl shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">{stat.title}</p>
                  <p className="text-white text-2xl font-bold">{stat.value}</p>
                </div>
                <Icon className="h-8 w-8 text-white/80" />
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Upload Dataset */}
        <Link to="/upload">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-purple-500/50 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                <Upload className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Upload Dataset</h3>
                <p className="text-slate-400 text-sm">Start your ML journey</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
            </div>
          </motion.div>
        </Link>

        {/* Analyze Data */}
        <Link to="/analyze">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-pink-500/50 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-pink-500/20 rounded-lg group-hover:bg-pink-500/30 transition-colors">
                <Brain className="h-6 w-6 text-pink-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Analyze Data</h3>
                <p className="text-slate-400 text-sm">Get algorithm recommendations</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-pink-400 transition-colors" />
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Datasets */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Datasets</h3>
            <Link to="/history" className="text-purple-400 hover:text-purple-300 text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {availableDatasets.length > 0 ? (
              availableDatasets.slice(0, 5).map((dataset) => (
                <div key={dataset.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-white text-sm font-medium">{dataset.filename}</p>
                      <p className="text-slate-400 text-xs">
                        {(dataset.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/analyze/${dataset.id}`}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    Analyze
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No datasets uploaded yet</p>
            )}
          </div>
        </motion.div>

        {/* Recent Models */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Models</h3>
            <Link to="/history" className="text-purple-400 hover:text-purple-300 text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentModels.length > 0 ? (
              recentModels.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Brain className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-white text-sm font-medium">{model.algorithm}</p>
                      <p className="text-slate-400 text-xs">
                        {model.task_type} • {getModelScore(model)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-sm font-medium">
                      {getModelScoreDisplay(model)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No models trained yet</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard