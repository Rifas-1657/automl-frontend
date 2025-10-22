import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import useAppStore from '../store/useAppStore'
import {
  Brain,
  BarChart3,
  Target,
  ArrowLeft,
  ArrowRight,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Database,
  Zap,
  Settings,
  Eye,
  BarChart,
  Activity,
  Layers
} from 'lucide-react'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
  columns?: string[]
  data_preview?: any[]
}

interface AlgorithmRecommendation {
  name: string
  type: string
  description: string
  pros: string[]
  cons: string[]
  best_for: string[]
  accuracy_estimate?: number
}

interface AnalysisResult {
  task_type: string
  suggestions: string[]
  target: string
  analysis_summary: {
    dataset_shape: [number, number]
    missing_values: Record<string, number>
    data_quality_score: number
    recommendations: string[]
  }
}

interface TrainingResults {
  [algorithm: string]: {
    metrics: {
      accuracy?: number
      precision?: number
      recall?: number
      f1_score?: number
      r2_score?: number
      mse?: number
      mae?: number
    }
    cross_validation_score: {
      mean: number
      std: number
    }
    feature_importance?: Record<string, number>
    predictions?: number[]
    actual?: number[]
  }
}

const Analyze: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const { api } = useAuth()
  
  // Global state
  const {
    selectedDataset,
    setSelectedDataset,
    availableDatasets,
    setAvailableDatasets
  } = useAppStore()
  
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [algorithms, setAlgorithms] = useState<AlgorithmRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('')
  const [selectedInputs, setSelectedInputs] = useState<string[]>([])
  const [selectedOutput, setSelectedOutput] = useState<string>('')
  const [trainingResults, setTrainingResults] = useState<TrainingResults | null>(null)
  const [showDataPreview, setShowDataPreview] = useState(false)

  const [showDatasetModal, setShowDatasetModal] = useState(false)

  useEffect(() => {
    if (datasetId) {
      fetchDatasetInfo()
      analyzeDataset()
    } else {
      // If opened without a dataset id, show dataset selection modal
      fetchAvailableDatasets()
      setShowDatasetModal(true)
    }
  }, [datasetId])

  const fetchAvailableDatasets = async () => {
    try {
      const res = await api.get('/datasets')
      const list: any[] = Array.isArray(res.data) ? res.data : []
      setAvailableDatasets(list)
      
      // If only one dataset, auto-select it
      if (list.length === 1) {
        navigate(`/analyze/${list[0].id}`)
        setShowDatasetModal(false)
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
      toast.error('Failed to fetch datasets')
    }
  }

  const fetchDatasetInfo = async () => {
    try {
      console.log(`🔍 Fetching RAW dataset info for ID: ${datasetId}`)
      
      // Get raw data preview to ensure data integrity
      const previewResponse = await api.get(`/datasets/${datasetId}/preview`)
      const rawData = previewResponse.data
      
      console.log('📊 RAW DATA PREVIEW:', rawData)
      console.log('📊 RAW DATA SAMPLE:', rawData.sample_data)
      console.log('📊 PREPROCESSING APPLIED:', rawData.preprocessing_applied)
      
      if (rawData.preprocessing_applied) {
        console.warn('⚠️ WARNING: Data preprocessing was applied!')
        toast.error('Data corruption detected! Please re-upload the file.')
        return
      }
      
      // Use raw data for dataset info
      const datasetInfo = {
        id: rawData.dataset_id,
        filename: rawData.filename,
        columns: rawData.columns,
        data_preview: rawData.sample_data,
        shape: rawData.shape,
        dtypes: rawData.dtypes,
        preprocessing_applied: rawData.preprocessing_applied,
        warning: rawData.warning
      }
      
      console.log('📊 RAW DATASET INFO:', datasetInfo)
      setDataset(datasetInfo)
      setSelectedDataset(datasetInfo)
      
      toast.success('RAW data loaded successfully!')
    } catch (error) {
      console.error('Failed to fetch raw dataset info:', error)
      toast.error('Failed to fetch raw dataset info')
    }
  }

  const analyzeDataset = async () => {
    if (!datasetId) return

    setLoading(true)
    try {
      console.log(`🧠 Starting analysis for dataset ${datasetId}`)
      const response = await api.post(`/analyze/${datasetId}`)
      setAnalysis(response.data)
      
      // Fetch detailed algorithm recommendations
      const algoResponse = await api.get(`/algorithms/${datasetId}`)
      console.log('🤖 Algorithm recommendations:', algoResponse.data)
      setAlgorithms(algoResponse.data.algorithm_recommendations || [])
      
      // Auto-select target column if available
      if (response.data.target && dataset?.columns) {
        setSelectedOutput(response.data.target)
      }
      
      toast.success('Dataset analysis completed successfully!')
    } catch (error: any) {
      console.error('Analysis failed:', error)
      toast.error(error.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const runTraining = async () => {
    if (!datasetId || !selectedOutput || selectedInputs.length === 0) {
      toast.error('Please select input columns and output column')
      return
    }
    if (!selectedAlgorithm) {
      toast.error('Please select an algorithm to train')
      return
    }

    setTraining(true)
    try {
      console.log(`🚀 Starting training with inputs: ${selectedInputs.join(', ')}, output: ${selectedOutput}, algorithm: ${selectedAlgorithm}`)
      const payload = {
        dataset_id: parseInt(datasetId!),
        input_columns: selectedInputs,
        output_column: selectedOutput,
        algorithms: [selectedAlgorithm],
        // Always let backend infer fresh task type to prevent stale mismatch
        task_type: 'auto'
      }
      console.log('🚀 Training payload', payload)
      await api.post(`/train`, payload)
      toast.success('Model trained successfully!')
      // Navigate to detailed Train page for viewing results/prediction options
      navigate(`/train/${datasetId}?algorithm=${selectedAlgorithm}`, {
        state: {
          datasetId: parseInt(datasetId!),
          inputColumns: selectedInputs,
          targetColumn: selectedOutput,
          taskType: analysis?.task_type || '',
          datasetName: dataset?.filename || '',
          algorithm: selectedAlgorithm
        }
      })
    } catch (error: any) {
      console.error('Training failed:', error)
      toast.error(error.response?.data?.detail || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  const handleInputToggle = (column: string) => {
    if (column === selectedOutput) {
      toast.error('Cannot select target column as input feature')
      return
    }
    setSelectedInputs(prev => prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column])
  }

  const handleTargetSelect = (column: string) => {
    setSelectedOutput(column)
    setSelectedInputs(prev => prev.filter(c => c !== column))
  }

  const trainWithAlgorithm = async () => {
    if (!datasetId || !selectedAlgorithm) return
    navigate(`/train/${datasetId}?algorithm=${selectedAlgorithm}`, {
      state: {
        datasetId: parseInt(datasetId!),
        inputColumns: selectedInputs,
        targetColumn: selectedOutput,
        taskType: analysis?.task_type || '',
        datasetName: dataset?.filename || '',
        algorithm: selectedAlgorithm
      }
    })
  }

  const handleBack = () => {
    try {
      if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/dashboard')
      }
    } catch {
      navigate('/dashboard')
    }
  }

  const getTaskTypeColor = (taskType: string) => {
    switch (taskType) {
      case 'regression':
        return 'from-blue-500 to-cyan-500'
      case 'classification':
        return 'from-green-500 to-emerald-500'
      case 'binary_classification':
        return 'from-purple-500 to-pink-500'
      default:
        return 'from-slate-500 to-slate-600'
    }
  }

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case 'regression':
        return TrendingUp
      case 'classification':
        return Target
      default:
        return Brain
    }
  }

  const handleDatasetSelect = (selectedDataset: Dataset) => {
    navigate(`/analyze/${selectedDataset.id}`)
    setShowDatasetModal(false)
  }

  return (
    <div className="p-8 space-y-8">
      {/* Dataset Selection Modal */}
      {showDatasetModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            navigate('/dashboard')
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white">Select Dataset to Analyze</h2>
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <AlertCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6">
              {availableDatasets.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No datasets available</p>
                  <button
                    onClick={() => navigate('/upload')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                  >
                    Upload Dataset
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {availableDatasets.map((dataset) => (
                    <motion.button
                      key={dataset.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDatasetSelect(dataset)}
                      className="w-full p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-purple-500/50 transition-all duration-200 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Database className="h-5 w-5 text-blue-400" />
                          <div>
                            <p className="text-white font-medium">{dataset.filename}</p>
                            <p className="text-slate-400 text-sm">
                              {(dataset.file_size / 1024).toFixed(1)} KB • {new Date(dataset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <h1 className="text-4xl font-bold text-white">Dataset Analysis</h1>
          </div>
          <p className="text-slate-400 text-lg">
            {dataset ? `Analyzing: ${dataset.filename}` : 'Loading dataset...'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDataPreview(!showDataPreview)}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all duration-200"
          >
            <Eye className="h-4 w-4" />
            <span>{showDataPreview ? 'Hide' : 'Show'} Data</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={analyzeDataset}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Re-analyze'}</span>
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-12"
        >
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Analyzing dataset...</p>
            <p className="text-slate-400 text-sm mt-2">This may take a few moments</p>
          </div>
        </motion.div>
      ) : analysis ? (
        <>
          {/* Data Preview */}
          {showDataPreview && dataset && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Database className="h-6 w-6 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Data Preview</h3>
              </div>
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="min-w-max text-sm data-table">
                  <thead>
                    <tr className="border-b border-slate-600">
                      {dataset.columns?.slice(0, 10).map((col, idx) => (
                        <th key={idx} className="text-left p-2 text-slate-300 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.data_preview?.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-700/50">
                        {dataset.columns?.slice(0, 10).map((col, colIdx) => (
                          <td key={colIdx} className="p-2 text-slate-400 whitespace-nowrap">
                            {row[col]?.toString() || 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Column Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Input Column Selection */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Settings className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Select Input Columns</h3>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dataset?.columns?.map((column) => (
                  <label key={column} className="flex items-center space-x-3 p-2 hover:bg-slate-700/30 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedInputs.includes(column)}
                      onChange={() => handleInputToggle(column)}
                      className="w-4 h-4 text-green-500 bg-slate-700 border-slate-600 rounded focus:ring-green-500"
                    />
                    <span className="text-slate-300 text-sm">{column}</span>
                    {selectedInputs.includes(column) && (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                  </label>
                ))}
              </div>
              <p className="text-slate-400 text-sm mt-2">
                Selected: {selectedInputs.length} columns
              </p>
            </div>

            {/* Output Column Selection */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Target className="h-6 w-6 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Select Output Column</h3>
              </div>
              <select
                value={selectedOutput}
                onChange={(e) => handleTargetSelect(e.target.value)}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Choose target variable...</option>
                {dataset?.columns?.map((column) => (
                  <option key={column} value={column}>{column}</option>
                ))}
              </select>
              {selectedOutput && (
                <p className="text-green-400 text-sm mt-2">
                  ✓ Target: {selectedOutput}
                </p>
              )}
            </div>
          </motion.div>

          {/* Training Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Activity className="h-6 w-6 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Model Training</h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={runTraining}
                disabled={training || !selectedOutput || selectedInputs.length === 0 || !selectedAlgorithm}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {training ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>{training ? 'Training...' : 'Train Selected'}</span>
              </motion.button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="text-slate-400">Input Columns</div>
                <div className="text-white font-medium">{selectedInputs.length}</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="text-slate-400">Target Column</div>
                <div className="text-white font-medium">{selectedOutput || 'Not selected'}</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="text-slate-400">Algorithms</div>
                <div className="text-white font-medium">{algorithms.length}</div>
              </div>
            </div>
          </motion.div>

          {/* Algorithm Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Zap className="h-6 w-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Recommended Algorithms</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {algorithms.map((algorithm, index) => (
                <motion.div
                  key={algorithm.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedAlgorithm === algorithm.name
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedAlgorithm(algorithm.name)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">{algorithm.name}</h4>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      algorithm.type === 'ensemble' ? 'bg-blue-500/20 text-blue-400' :
                      algorithm.type === 'linear' ? 'bg-green-500/20 text-green-400' :
                      algorithm.type === 'gradient_boosting' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {algorithm.type.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <p className="text-slate-300 text-sm mb-3">{algorithm.description}</p>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-green-400 text-xs font-medium">Pros:</span>
                      <ul className="text-slate-400 text-xs mt-1">
                        {algorithm.pros.slice(0, 2).map((pro, i) => (
                          <li key={i}>• {pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-red-400 text-xs font-medium">Cons:</span>
                      <ul className="text-slate-400 text-xs mt-1">
                        {algorithm.cons.slice(0, 1).map((con, i) => (
                          <li key={i}>• {con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Training Results */}
          {trainingResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
            >
              <div className="flex items-center space-x-3 mb-6">
                <BarChart className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Training Results</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(trainingResults).map(([algorithm, results]) => (
                  <div key={algorithm} className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-semibold">{algorithm}</h4>
                      <div className="text-green-400 font-medium">
                        {results.metrics.accuracy ? 
                          `${(results.metrics.accuracy * 100).toFixed(1)}%` :
                          results.metrics.r2_score ? 
                          `R²: ${results.metrics.r2_score.toFixed(3)}` :
                          'N/A'
                        }
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(results.metrics).map(([metric, value]) => (
                        <div key={metric} className="bg-slate-600/30 rounded p-2">
                          <div className="text-slate-400 text-xs">{metric.replace('_', ' ')}</div>
                          <div className="text-white font-medium">
                            {typeof value === 'number' ? value.toFixed(3) : value}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <div className="text-slate-400 text-xs">Cross-Validation Score</div>
                      <div className="text-white font-medium">
                        {results.cross_validation_score.mean.toFixed(3)} ± {results.cross_validation_score.std.toFixed(3)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Analysis Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Task Type */}
            <div className={`bg-gradient-to-br ${getTaskTypeColor(analysis.task_type)} p-6 rounded-xl shadow-lg`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Task Type</p>
                  <p className="text-white text-xl font-bold capitalize">
                    {analysis.task_type.replace('_', ' ')}
                  </p>
                </div>
                {React.createElement(getTaskTypeIcon(analysis.task_type), {
                  className: "h-8 w-8 text-white/80"
                })}
              </div>
            </div>

            {/* Dataset Shape */}
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Dataset Size</p>
                  <p className="text-white text-xl font-bold">
                    {(dataset as any)?.shape?.[0] ?? analysis.analysis_summary.dataset_shape[0]} × {(dataset as any)?.shape?.[1] ?? analysis.analysis_summary.dataset_shape[1]}
                  </p>
                </div>
                <Database className="h-8 w-8 text-white/80" />
              </div>
            </div>

            {/* Data Quality */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Data Quality</p>
                  <p className="text-white text-xl font-bold">
                    {analysis.analysis_summary.data_quality_score.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-white/80" />
              </div>
            </div>

            {/* Target Column */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">Target Column</p>
                  <p className="text-white text-xl font-bold truncate">
                    {selectedOutput || analysis.target}
                  </p>
                </div>
                <Target className="h-8 w-8 text-white/80" />
              </div>
            </div>
          </motion.div>

          

          {/* Data Quality Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Missing Values */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="h-6 w-6 text-orange-400" />
                <h3 className="text-lg font-semibold text-white">Missing Values</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(analysis.analysis_summary.missing_values).map(([column, count]) => (
                  count > 0 && (
                    <div key={column} className="flex justify-between items-center p-2 bg-slate-700/30 rounded">
                      <span className="text-slate-300">{column}</span>
                      <span className="text-orange-400 font-medium">{count}</span>
                    </div>
                  )
                ))}
                {Object.values(analysis.analysis_summary.missing_values).every(count => count === 0) && (
                  <p className="text-green-400 text-sm">No missing values found!</p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="h-6 w-6 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Recommendations</h3>
              </div>
              <div className="space-y-2">
                {analysis.analysis_summary.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 bg-slate-700/30 rounded">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Visualization navigation removed */}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/predict/${datasetId}`)}
              className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-green-500/50 transition-all duration-200 text-left"
            >
              <div className="flex items-center space-x-3">
                <Target className="h-6 w-6 text-green-400" />
                <div>
                  <div className="text-white font-medium">Make Predictions</div>
                  <div className="text-slate-400 text-sm">Test with new data</div>
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
                  <div className="text-slate-400 text-sm">Analyze more data</div>
                </div>
              </div>
            </motion.button>
          </motion.div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-400">No analysis available</p>
          <p className="text-slate-500 text-sm mt-2">
            Click "Re-analyze" to start the analysis process
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default Analyze