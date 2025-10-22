import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import { History as HistoryIcon, Database, Brain, Loader2 } from 'lucide-react'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
}

interface Model {
  model_id: number
  algorithm: string
  task_type: string
  created_at: string
  metrics: any
}

interface HistoryData {
  datasets: Dataset[]
  models: Model[]
}

const History: React.FC = () => {
  const { api } = useAuth()
  const [items, setItems] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await api.get('/history')
      setItems(response.data)
    } catch (error: any) {
      toast.error('Failed to load history')
      console.error('History fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Loading history...</p>
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
        <h1 className="text-4xl font-bold text-white">Training History</h1>
        <p className="text-slate-400 text-lg">View all your datasets and trained models</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Datasets */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Database className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Datasets</h2>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
              {items?.datasets.length || 0}
            </span>
          </div>

          {items?.datasets.length ? (
            <div className="space-y-3">
              {items.datasets.map((dataset) => (
                <div key={dataset.id} className="p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{dataset.filename}</h3>
                      <p className="text-slate-400 text-sm">
                        {formatFileSize(dataset.file_size)} • {new Date(dataset.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-400 text-sm">ID: {dataset.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No datasets uploaded yet</p>
            </div>
          )}
        </motion.div>

        {/* Models */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Brain className="h-6 w-6 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Trained Models</h2>
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
              {items?.models.length || 0}
            </span>
          </div>

          {items?.models.length ? (
            <div className="space-y-3">
              {items.models.map((model) => (
                <div key={model.model_id} className="p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{model.algorithm}</h3>
                      <p className="text-slate-400 text-sm">
                        {model.task_type} • {new Date(model.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-green-400 text-sm">ID: {model.model_id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No models trained yet</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Total Datasets</p>
              <p className="text-white text-2xl font-bold">{items?.datasets.length || 0}</p>
            </div>
            <Database className="h-8 w-8 text-white/80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Trained Models</p>
              <p className="text-white text-2xl font-bold">{items?.models.length || 0}</p>
            </div>
            <Brain className="h-8 w-8 text-white/80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Total Activity</p>
              <p className="text-white text-2xl font-bold">{(items?.datasets.length || 0) + (items?.models.length || 0)}</p>
            </div>
            <HistoryIcon className="h-8 w-8 text-white/80" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default History


