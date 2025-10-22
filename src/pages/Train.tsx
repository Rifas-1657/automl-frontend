import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import useAppStore from '../store/useAppStore'
import {
  Brain,
  Target,
  TrendingUp,
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Zap,
  Clock
} from 'lucide-react'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
}

interface SampleRow {
  input: Record<string, any>
  actual: any
  prediction: any
}

interface TrainingResult {
  model_id: number
  metrics: Record<string, any>
  sample_predictions: Array<{
    input: Record<string, any>
    prediction: number
    confidence?: number
  }>
  algorithm_used: string
  cross_validation_score: {
    mean: number
    std: number
    scores: number[]
  }
  feature_importance?: Record<string, number>
  samples?: {
    first: SampleRow[]
    middle: SampleRow[]
    last: SampleRow[]
  }
}

const Train: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const location = useLocation() as any
  const passed = (location && location.state) || {}
  
  // Global state
  const {
    selectedDataset,
    setSelectedDataset,
    setRecentModels,
    setLoadingModels,
    setPreviousPath,
    setLastModelId,
    setTrainingConfig,
    getTrainingConfig,
    previousPath
  } = useAppStore()
  
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>(passed.algorithm || '')
  const [targetColumn, setTargetColumn] = useState<string>(passed.targetColumn || '')
  const [taskType, setTaskType] = useState<string>(passed.taskType || '')
  const [inputColumns, setInputColumns] = useState<string[]>(passed.inputColumns || [])
  const [datasetName, setDatasetName] = useState<string>(passed.datasetName || '')
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [availableAlgorithms, setAvailableAlgorithms] = useState<string[]>([])
  const [trained, setTrained] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [sampleVisibleCount, setSampleVisibleCount] = useState(10)
  
  // Compute how many algorithms Auto Train will run based on task type/suggestions
  const autoTrainCount = (() => {
    const countFromSuggestions = Array.isArray(availableAlgorithms) ? availableAlgorithms.length : 0
    const isClass = (taskType || '').toLowerCase().includes('class')
    // Align with backend defaults: 2 for classification, 4 for regression
    const backendDefault = isClass ? 2 : 4
    return Math.max(countFromSuggestions, backendDefault)
  })()

  useEffect(() => {
    if (datasetId) {
      const datasetIdNum = parseInt(datasetId)
      
      // Prefer values passed from Analyze page; fallback to cached config only when empty
      const cachedConfig = getTrainingConfig(datasetIdNum)
      if (cachedConfig) {
        console.log('🔧 Considering cached training configuration for dataset:', datasetIdNum)
        if (!targetColumn) setTargetColumn(cachedConfig.targetColumn)
        if (!taskType) setTaskType(cachedConfig.taskType)
        if (!selectedAlgorithm) setSelectedAlgorithm(cachedConfig.algorithm)
        if (!inputColumns || inputColumns.length === 0) setInputColumns(cachedConfig.inputFeatures)
      }
      
      fetchDatasetInfo()
      fetchAnalysisData()
      
      // Check if algorithm was pre-selected from analysis page (query param or state)
      const preSelectedAlgorithm = searchParams.get('algorithm') || passed.algorithm
      if (preSelectedAlgorithm) setSelectedAlgorithm(preSelectedAlgorithm)
    }
  // we intentionally include the local states so we don't overwrite passed values
  }, [datasetId, searchParams, targetColumn, taskType, inputColumns, selectedAlgorithm])

  useEffect(() => {
    if (!targetColumn || !Array.isArray(inputColumns)) return
    // Ensure target not in inputs
    setInputColumns(prev => prev.filter(c => c !== targetColumn))
  }, [targetColumn])

  // Reset samples pagination when new results arrive
  useEffect(() => {
    setSampleVisibleCount(10)
  }, [result?.model_id])

  // Cache training configuration when it changes
  useEffect(() => {
    if (datasetId && targetColumn && taskType && inputColumns.length > 0 && selectedAlgorithm) {
      const datasetIdNum = parseInt(datasetId)
      const config = {
        targetColumn,
        taskType,
        inputFeatures: inputColumns,
        algorithm: selectedAlgorithm
      }
      setTrainingConfig(datasetIdNum, config)
      console.log('🔧 Cached training configuration for dataset:', datasetIdNum, config)
    }
  }, [datasetId, targetColumn, taskType, inputColumns, selectedAlgorithm])

  const fetchDatasetInfo = async () => {
    try {
      const response = await api.get('/datasets')
      const datasetInfo = response.data.find((d: Dataset) => d.id === parseInt(datasetId!))
      if (datasetInfo) {
        setDataset(datasetInfo)
        setSelectedDataset(datasetInfo)
      } else {
        // Dataset not found in user's datasets
        toast.error('Dataset not found. Redirecting to your datasets...')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Failed to fetch dataset info:', error)
      toast.error('Failed to fetch dataset info')
      
      // If dataset not found, redirect to user's datasets
      if (error.response?.status === 404) {
        toast.error('Dataset not found. Redirecting to your datasets...')
        navigate('/dashboard')
      }
    }
  }

  const fetchAnalysisData = async () => {
    try {
      const response = await api.post(`/analyze/${datasetId}`)
      // Only set values if they're not already cached
      if (!targetColumn) {
        setTargetColumn(response.data.target)
        console.log('🔧 Set target column from analysis:', response.data.target)
      } else {
        console.log('🔧 Using cached target column:', targetColumn)
      }
      if (!taskType) {
        setTaskType(response.data.task_type)
        console.log('🔧 Set task type from analysis:', response.data.task_type)
      } else {
        console.log('🔧 Using cached task type:', taskType)
      }
      setAvailableAlgorithms(response.data.suggestions)
      // Auto-select first algorithm if none selected
      try {
        if (!selectedAlgorithm && Array.isArray(response.data.suggestions) && response.data.suggestions.length > 0) {
          setSelectedAlgorithm(response.data.suggestions[0])
        }
      } catch {}
      // IMPORTANT: Do not force-filter suggestions by task type here.
      // Respect user's manual selection and keep full suggestions list.
      
      // CRITICAL: If we have passed inputColumns, use those instead of all columns
      if (inputColumns && inputColumns.length > 0) {
        console.log('🔧 Using passed input columns:', inputColumns)
        console.log('🔧 Number of passed input columns:', inputColumns.length)
      } else {
        console.log('🔧 No input columns passed, will use all available columns')
      }
    } catch (error) {
      console.error('Failed to fetch analysis data:', error)
      if (error.response?.status === 404) {
        toast.error('Dataset not found. Redirecting to your datasets...')
        navigate('/dashboard')
      } else {
        toast.error('Analysis failed')
      }
    }
  }

  const validateConfig = (): string | null => {
    if (!targetColumn) return 'Target column not selected. Go back to Analyze page.'
    if (!inputColumns || inputColumns.length === 0) return 'No input features selected. Go back to Analyze page.'
    if (inputColumns.includes(targetColumn)) return 'Target column cannot be in input features.'
    return null
  }

  const trainModel = async () => {
    if (!datasetId || !targetColumn) return
    const err = validateConfig()
    if (err) { toast.error(err); return }

    setTraining(true)
    setResult(null)
    setShowResults(false)
    setTrained(false)
    
    try {
      // Frontend safeguard: ensure selected features exist in dataset columns before training
      try {
        const ds = await api.get(`/datasets/${datasetId}`)
        const available = ds.data?.columns || []
        const missing = (inputColumns || []).filter((f) => !available.includes(f))
        if (missing.length > 0) {
          toast.error(`Features not in dataset: ${missing.join(', ')}`)
          setTraining(false)
          return
        }
      } catch (e) {
        toast.error('Failed to validate dataset features')
        setTraining(false)
        return
      }

      const chosenAlgorithm = selectedAlgorithm || availableAlgorithms[0] || 'Random Forest'
      const payload = {
        dataset_id: parseInt(datasetId),
        algorithms: [chosenAlgorithm],
        input_columns: inputColumns,
        output_column: targetColumn,
        // Always allow backend to infer task type to avoid mismatches
        task_type: 'auto',
        _verify_features: true
      }
      console.log('🚀 Training payload:', payload)
      const response = await api.post('/train', payload)

      // Verify backend returned the expected feature count and list
      const trainedCount = response.data?.trained_feature_count
      const trainedList = response.data?.trained_features
      if (typeof trainedCount === 'number' && trainedList && Array.isArray(trainedList)) {
        if (trainedCount !== inputColumns.length) {
          throw new Error(`Model trained with wrong number of features: expected ${inputColumns.length}, got ${trainedCount}`)
        }
      }

      // Extract the selected algorithm's results for the View Results panel
      const byAlgo = response.data?.results?.[chosenAlgorithm]
      if (byAlgo && typeof byAlgo === 'object') {
        const mapped: TrainingResult = {
          model_id: response.data?.model_id || 0,
          metrics: byAlgo.metrics || {},
          sample_predictions: (byAlgo.sample_predictions || []).slice(0, 3),
          // Prefer backend-reported trained label when available
          algorithm_used: byAlgo.algorithm_label || chosenAlgorithm,
          cross_validation_score: byAlgo.cross_validation_score || { mean: 0, std: 0, scores: [] },
          feature_importance: byAlgo.feature_importance || {},
          samples: byAlgo.samples || { first: [], middle: [], last: [] }
        }
        setResult(mapped)
      } else {
        setResult(null)
      }
      setTrained(true)
      toast.success(`Model trained successfully with ${trainedCount ?? inputColumns.length} features!`)
      
      // Update global state with recent models
      try {
        const historyResponse = await api.get('/history')
        const models = historyResponse.data?.models || []
        setRecentModels(models.slice(0, 5)) // Keep only recent 5 models
      } catch (error) {
        console.error('Failed to update recent models:', error)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  // Auto train all four, backend will default to four when algorithms omitted
  const autoTrainBest = async () => {
    if (!datasetId || !targetColumn) return
    const err = validateConfig()
    if (err) { toast.error(err); return }

    setTraining(true)
    setResult(null)
    setShowResults(false)
    setTrained(false)

    try {
      // Validate features exist
      try {
        const ds = await api.get(`/datasets/${datasetId}`)
        const available = ds.data?.columns || []
        const missing = (inputColumns || []).filter((f) => !available.includes(f))
        if (missing.length > 0) {
          toast.error(`Features not in dataset: ${missing.join(', ')}`)
          setTraining(false)
          return
        }
      } catch (e) {
        toast.error('Failed to validate dataset features')
        setTraining(false)
        return
      }

      const payload = {
        dataset_id: parseInt(datasetId),
        // No algorithms field -> backend will train the four and pick best
        input_columns: inputColumns,
        output_column: targetColumn,
        task_type: 'auto',
        _verify_features: true
      }
      console.log('🚀 Auto training payload:', payload)
      const response = await api.post('/train', payload)

      const bestKey = response.data?.best_model
      const best = bestKey ? response.data?.results?.[bestKey] : null
      if (!bestKey || !best) {
        toast.error('Auto training did not return a best model')
        setTraining(false)
        return
      }

      const mapped: TrainingResult = {
        model_id: response.data?.model_id || 0,
        metrics: best.metrics || {},
        sample_predictions: (best.sample_predictions || []).slice(0, 3),
        // Prefer backend-reported trained label when available
        algorithm_used: best.algorithm_label || bestKey,
        cross_validation_score: best.cross_validation_score || { mean: 0, std: 0, scores: [] },
        feature_importance: best.feature_importance || {},
        samples: best.samples || { first: [], middle: [], last: [] }
      }
      setResult(mapped)
      setTrained(true)
      setShowResults(true)
      toast.success(`Auto-trained best model: ${bestKey}`)

      // Persist best algorithm and model id in global state for Predict page consistency
      try {
        const idn = parseInt(datasetId)
        const prev = getTrainingConfig(idn)
        setTrainingConfig(idn, {
          targetColumn: prev?.targetColumn || targetColumn,
          taskType: prev?.taskType || taskType,
          inputFeatures: prev?.inputFeatures || inputColumns,
          algorithm: bestKey
        })
        if (response.data?.model_id) setLastModelId(String(response.data.model_id))
      } catch {}
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Auto training failed')
    } finally {
      setTraining(false)
    }
  }


  const getMetricValue = (metrics: Record<string, any>, key: string) => {
    const value = metrics[key]
    if (typeof value === 'number') {
      return value.toFixed(4)
    }
    return value
  }

  const getMetricColor = (value: number, isAccuracy: boolean = false) => {
    if (isAccuracy) {
      if (value >= 0.9) return 'text-green-400'
      if (value >= 0.8) return 'text-blue-400'
      if (value >= 0.7) return 'text-yellow-400'
      return 'text-red-400'
    }
    
    if (value >= 0.8) return 'text-green-400'
    if (value >= 0.6) return 'text-blue-400'
    if (value >= 0.4) return 'text-yellow-400'
    return 'text-red-400'
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('🔙 Train page back button clicked')
              // Navigate to analyze page to preserve data flow
              navigate(`/analyze/${datasetId}`)
            }}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-400" />
          </button>
            <h1 className="text-4xl font-bold text-white">Train Model</h1>
          </div>
          <p className="text-slate-400 text-lg">
            {dataset ? `Training on: ${dataset.filename}` : 'Loading dataset...'}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Training Configuration */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Brain className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Training Configuration</h2>
          </div>

          <div className="space-y-6">
            {/* Training Configuration Display */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Target Column</label>
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg">
                <Target className="h-5 w-5 text-green-400" />
                <span className="text-white font-medium">{targetColumn || 'Loading...'}</span>
              </div>
            </div>

            {/* Task Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Task Type</label>
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <span className="text-white font-medium capitalize">
                  {taskType ? taskType.replace('_', ' ') : 'Loading...'}
                </span>
              </div>
            </div>

            {/* Input Features */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Input Features ({inputColumns?.length || 0})
              </label>
              <div className="flex flex-wrap gap-2">
                {(inputColumns || []).map((f) => (
                  <span key={f} className="px-2 py-1 rounded-md bg-slate-700/50 text-slate-200 text-xs border border-slate-600">{f}</span>
                ))}
              </div>
            </div>

            {/* Algorithm Indicator - shows the algorithm that will be used */}
            <div className="space-y-1">
              <div className="text-slate-300 text-sm">Algorithm</div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-white font-medium">
                {selectedAlgorithm || (availableAlgorithms[0] || 'Determining...')}
              </div>
              <div className="text-slate-400 text-xs">
                This is the algorithm that will be used for Start Training. Auto Train will train all {autoTrainCount} and pick the best automatically.
              </div>
            </div>

            {/* Training Buttons */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={trainModel}
              disabled={training || !targetColumn}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {training ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              <span>{training ? 'Training Model...' : 'Start Training'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={autoTrainBest}
              disabled={training || !targetColumn}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {training ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
              <span>{training ? 'Auto Training...' : 'Auto Train'}</span>
            </motion.button>

            {training && (
              <div className="text-center py-4">
                <div className="animate-pulse text-slate-400 text-sm">
                  Training may take a few minutes depending on dataset size...
                </div>
              </div>
            )}
          </div>
        </motion.div>

            {/* Training Results (deferred until user opts-in) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Training Results</h2>
      </div>

      {trained && !showResults && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-slate-200 text-sm">
            Training completed. Click below to view results and next steps.
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                console.log('📊 View All Results button clicked')
                console.log('📊 Result model_id:', result?.model_id)
                
                // Navigate to detailed results page
                if (result?.model_id) {
                  console.log('📊 Navigating to training results page')
                  setLastModelId(result.model_id.toString())
                  navigate(`/training-results/${result.model_id}`, {
                    state: {
                      algorithm: result.algorithm_used || selectedAlgorithm,
                      datasetId: datasetId
                    }
                  })
                } else {
                  console.error('❌ Model ID not available')
                  toast.error('Model ID not available')
                }
              }}
              className="px-4 py-2 bg-green-600 rounded-lg text-white hover:bg-green-500 cursor-pointer"
            >
              View All Results
            </button>
            <button 
              onClick={() => {
                console.log('🎯 Go to Predict button clicked')
                console.log('🎯 Dataset ID:', datasetId)
                console.log('🎯 Input columns:', inputColumns)
                console.log('🎯 Target column:', targetColumn)
                
                // Navigate to predict page with context to lock algorithm
                console.log('🎯 Navigating to predict page')
                navigate(`/predict/${datasetId}`, {
                  state: {
                    inputColumns,
                    targetColumn,
                    algorithm: result?.algorithm_used || selectedAlgorithm
                  }
                })
              }}
              className="px-4 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600 cursor-pointer"
            >
              Go to Predict
            </button>
            {/* Visualization page removed */}
          </div>
        </div>
      )}

      {result && showResults ? (
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-4">
                {result?.metrics && Object.entries(result.metrics).map(([key, value]) => {
                  if (key === 'classification_report') return null
                  
                  const isAccuracy = key.includes('accuracy') || key.includes('r2')
                  const numValue = typeof value === 'number' ? value : 0
                  
                  return (
                    <div key={key} className="text-center p-4 bg-slate-700/30 rounded-lg">
                      <div className={`text-2xl font-bold ${getMetricColor(numValue, isAccuracy)}`}>
                        {getMetricValue(result.metrics, key)}
                      </div>
                      <div className="text-slate-400 text-sm capitalize">
                        {key.replace('_', ' ')}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Cross-Validation Score */}
              <div className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
                <div className="flex items-center space-x-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-400" />
                  <span className="text-white font-medium">Cross-Validation Score</span>
                </div>
                {result?.cross_validation_score && typeof result.cross_validation_score.mean === 'number' && result.cross_validation_score.mean > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-blue-400">
                      {(result.cross_validation_score.mean * 100).toFixed(1)}%
                    </div>
                    <div className="text-slate-400 text-sm">
                      ± {(result.cross_validation_score.std * 100).toFixed(1)}% (std dev)
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 text-sm">Pending training...</div>
                )}
              </div>

              {/* Algorithm Used */}
              <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg">
                <Zap className="h-5 w-5 text-purple-400" />
                <div>
                  <div className="text-white font-medium">Algorithm Used</div>
                  <div className="text-slate-400 text-sm">{result.algorithm_used}</div>
                </div>
              </div>

              {/* Sample Predictions */}
              {result.samples && (
                <div className="space-y-4">
                  {(() => {
                    const all: any[] = []
                    const s = result.samples as any
                    if (s.first) all.push(...s.first)
                    if (s.middle) all.push(...s.middle)
                    if (s.last) all.push(...s.last)
                    const headers = all[0] ? Object.keys(all[0].input) : []
                    const rows = all.slice(0, sampleVisibleCount)
                    return (
                      <div>
                        <h3 className="text-white font-medium mb-2">Sample Predictions</h3>
                        {rows.length > 0 ? (
                          <>
                            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                              <table className="min-w-max text-sm data-table">
                                <thead>
                                  <tr className="border-b border-slate-700">
                                    <th className="p-2 text-slate-300 text-left">#</th>
                                    {headers.map((col: string) => (
                                      <th key={col} className="p-2 text-slate-300 text-left whitespace-nowrap overflow-hidden text-ellipsis" style={{maxWidth: '12rem'}}>{col}</th>
                                    ))}
                                    <th className="p-2 text-slate-300 text-left">Actual</th>
                                    <th className="p-2 text-slate-300 text-left">Prediction</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-800">
                                      <td className="p-2 text-slate-400">{idx + 1}</td>
                                      {headers.map((h: string, i: number) => (
                                        <td key={i} className="p-2 text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis" style={{maxWidth: '12rem'}}>{String(row.input[h])}</td>
                                      ))}
                                      <td className="p-2 text-slate-200">{String(row.actual)}</td>
                                      <td className="p-2 text-slate-200">{String(row.prediction)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {sampleVisibleCount < all.length && (
                              <div className="mt-3">
                                <button
                                  onClick={() => setSampleVisibleCount(c => Math.min(c + 10, all.length))}
                                  className="px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500"
                                >
                                  Show More
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-400 text-sm">No samples available</div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Show message if no samples available */}
              {result && (!result.samples || Object.values(result.samples).every(s => !s || s.length === 0)) && (
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-400 text-sm text-center">
                    Sample predictions will be available after training completes
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    console.log('🎯 Predict button clicked')
                    console.log('🎯 Dataset ID:', datasetId)
                    console.log('🎯 Input columns:', inputColumns)
                    console.log('🎯 Target column:', targetColumn)
                    console.log('🎯 Algorithm:', selectedAlgorithm)
                    
                    // Navigate to predict page
                    console.log('🎯 Navigating to predict page')
                    navigate(`/predict/${datasetId}`)
                  }}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                >
                  <Target className="h-4 w-4" />
                  <span>Make Predictions</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    console.log('📊 View Charts button clicked')
                    console.log('📊 Dataset ID:', datasetId)
                    
                    // Navigate to visualization page
                    console.log('📊 Navigating to visualization page')
                    navigate(`/visualization/${datasetId}`)
                  }}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>View Charts</span>
                </motion.button>
              </div>
            </div>
          ) : (!trained ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No training results yet</p>
              <p className="text-slate-500 text-sm mt-2">
                Configure and start training to see results here
              </p>
            </div>
          ) : null)}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            console.log('🔍 Analyze button clicked')
            console.log('🔍 Dataset ID:', datasetId)
            console.log('🔍 Navigating to analyze page')
            navigate(`/analyze/${datasetId}`)
          }}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-blue-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-blue-400" />
            <div>
              <div className="text-white font-medium">Back to Analysis</div>
              <div className="text-slate-400 text-sm">View dataset insights</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            console.log('📊 History button clicked')
            console.log('📊 Navigating to history page')
            navigate('/history')
          }}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-green-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-6 w-6 text-green-400" />
            <div>
              <div className="text-white font-medium">View All Models</div>
              <div className="text-slate-400 text-sm">Training history</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            console.log('📁 Upload button clicked')
            console.log('📁 Navigating to upload page')
            navigate('/upload')
          }}
          className="p-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-purple-500/50 transition-all duration-200 text-left"
        >
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-6 w-6 text-purple-400" />
            <div>
              <div className="text-white font-medium">Upload New Dataset</div>
              <div className="text-slate-400 text-sm">Train another model</div>
            </div>
          </div>
        </motion.button>
        </motion.div>
    </div>
  )
}

export default Train