import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import {
  Brain,
  BarChart3,
  Target,
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Database,
  Zap,
  Award,
  Clock,
  Activity
} from 'lucide-react'

interface AutoMLResult {
  dataset_id: number
  target_column: string
  task_type: string
  dataset_info: {
    filename: string
    shape: [number, number]
    features: string[]
    target_unique_values: number
  }
  algorithms_tested: string[]
  results: Record<string, {
    metrics: Record<string, any>
    cross_validation_score: {
      mean: number
      std: number
    }
    feature_importance?: Record<string, number>
    algorithm_type: string
    error?: string
  }>
  best_model: string
  best_score: number
  visualizations: {
    plot_files: string[]
    plot_urls: string[]
  }
  recommendations: {
    best_for_accuracy: string
    best_for_speed: string
    best_for_interpretability: string
  }
}

const AutoMLResults: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [result, setResult] = useState<AutoMLResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('')

  useEffect(() => {
    if (datasetId) {
      runAutoML()
    }
  }, [datasetId])

  const runAutoML = async () => {
    if (!datasetId) return

    setLoading(true)
    try {
      console.log(`🚀 Running AutoML for dataset ${datasetId}`)
      const response = await api.post(`/automl/${datasetId}`)
      setResult(response.data)
      setSelectedAlgorithm(response.data.best_model)
      toast.success('AutoML analysis completed successfully!')
    } catch (error: any) {
      console.error('AutoML failed:', error)
      toast.error(error.response?.data?.detail || 'AutoML analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const getMetricValue = (metrics: Record<string, any>, key: string) => {
    const value = metrics[key]
    if (typeof value === 'number') {
      return value.toFixed(4)
    }
    return value
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-400'
    if (score >= 0.8) return 'text-blue-400'
    if (score >= 0.7) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getAlgorithmTypeColor = (type: string) => {
    switch (type) {
      case 'linear': return 'bg-blue-500/20 text-blue-400'
      case 'ensemble': return 'bg-green-500/20 text-green-400'
      case 'gradient_boosting': return 'bg-purple-500/20 text-purple-400'
      case 'kernel_method': return 'bg-orange-500/20 text-orange-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Running AutoML Analysis...</p>
            <p className="text-slate-400 text-sm mt-2">Training all algorithms and comparing results</p>
          </div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400">No AutoML results available</p>
          <p className="text-slate-500 text-sm mt-2">
            Click "Run AutoML" to start the analysis
          </p>
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
        className="flex items-center justify-between"
      >
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <h1 className="text-4xl font-bold text-white">AutoML Results</h1>
          </div>
          <p className="text-slate-400 text-lg">
            {result.dataset_info.filename} • {result.task_type.replace('_', ' ')} • {result.algorithms_tested.length} algorithms tested
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={runAutoML}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running...' : 'Re-run AutoML'}</span>
        </motion.button>
      </motion.div>

      {/* Dataset Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Dataset Size</p>
              <p className="text-white text-xl font-bold">
                {result.dataset_info.shape[0]} × {result.dataset_info.shape[1]}
              </p>
            </div>
            <Database className="h-8 w-8 text-white/80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Target Column</p>
              <p className="text-white text-xl font-bold truncate">
                {result.target_column}
              </p>
            </div>
            <Target className="h-8 w-8 text-white/80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Task Type</p>
              <p className="text-white text-xl font-bold capitalize">
                {result.task_type.replace('_', ' ')}
              </p>
            </div>
            <Brain className="h-8 w-8 text-white/80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-500 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Best Model</p>
              <p className="text-white text-xl font-bold">
                {result.best_model}
              </p>
            </div>
            <Award className="h-8 w-8 text-white/80" />
          </div>
        </div>
      </motion.div>

      {/* Algorithm Results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <BarChart3 className="h-6 w-6 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Algorithm Performance Comparison</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {result.algorithms_tested.map((algorithm, index) => {
            const algoResult = result.results[algorithm]
            const isBest = algorithm === result.best_model
            const hasError = algoResult.error

            return (
              <motion.div
                key={algorithm}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  selectedAlgorithm === algorithm
                    ? 'border-purple-500 bg-purple-500/10'
                    : isBest
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                }`}
                onClick={() => setSelectedAlgorithm(algorithm)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-white font-semibold">{algorithm}</h3>
                    {isBest && <Award className="h-4 w-4 text-green-400" />}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getAlgorithmTypeColor(algoResult.algorithm_type)}`}>
                    {algoResult.algorithm_type.replace('_', ' ')}
                  </div>
                </div>

                {hasError ? (
                  <div className="text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Error: {algoResult.error}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 text-sm">Cross-Validation Score</span>
                      <span className={`font-bold ${getScoreColor(algoResult.cross_validation_score.mean)}`}>
                        {(algoResult.cross_validation_score.mean * 100).toFixed(1)}%
                      </span>
                    </div>
                    
                    {Object.entries(algoResult.metrics).map(([key, value]) => {
                      if (key === 'classification_report') return null
                      return (
                        <div key={key} className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                          <span className="text-white">{getMetricValue(algoResult.metrics, key)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Award className="h-6 w-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Best for Accuracy</h3>
          </div>
          <p className="text-slate-300 text-sm mb-2">{result.recommendations.best_for_accuracy}</p>
          <p className="text-slate-400 text-xs">Highest cross-validation score</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Best for Speed</h3>
          </div>
          <p className="text-slate-300 text-sm mb-2">{result.recommendations.best_for_speed}</p>
          <p className="text-slate-400 text-xs">Fastest training and prediction</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Activity className="h-6 w-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Best for Interpretability</h3>
          </div>
          <p className="text-slate-300 text-sm mb-2">{result.recommendations.best_for_interpretability}</p>
          <p className="text-slate-400 text-xs">Most explainable results</p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(`/predict/${datasetId}`)}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-blue-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-400" />
            <div>
              <div className="text-white font-medium">Make Predictions</div>
              <div className="text-slate-400 text-sm">Test with new data</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          // Visualization page removed
          onClick={() => {}}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-green-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-green-400" />
            <div>
              <div className="text-white font-medium">Visualizations (removed)</div>
              <div className="text-slate-400 text-sm">Explore data patterns</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/upload')}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-purple-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-purple-400" />
            <div>
              <div className="text-white font-medium">Upload Another Dataset</div>
              <div className="text-slate-400 text-sm">Run AutoML on new data</div>
            </div>
          </div>
        </motion.button>
      </motion.div>
    </div>
  )
}

export default AutoMLResults
