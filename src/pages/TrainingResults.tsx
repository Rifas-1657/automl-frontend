import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import useAppStore from '../store/useAppStore'
import {
  ArrowLeft,
  BarChart3,
  Target,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  TrendingUp,
  Database,
  Zap,
  RefreshCw
} from 'lucide-react'

interface TrainingResult {
  model_id: number
  dataset_id?: number
  algorithm: string
  task_type: string
  created_at: string
  metrics: {
    accuracy?: number
    r2_score?: number
    adjusted_r2?: number
    mse?: number
    rmse?: number
    mae?: number
    precision?: number
    recall?: number
    f1_score?: number
    auc_roc?: number
  }
  cross_validation_score: {
    mean: number
    std: number
    scores: number[]
  }
  dataset_info: {
    total_rows: number
    columns: string[]
    data_types: Record<string, string>
    preview: Array<Record<string, any>>
    has_more: boolean
    input_features?: string[]
    output_feature?: string
  }
  feature_importance: Record<string, number>
  samples?: {
    first: Array<{
      input: Record<string, any>
      actual: any
      prediction: any
    }>
    middle: Array<{
      input: Record<string, any>
      actual: any
      prediction: any
    }>
    last: Array<{
      input: Record<string, any>
      actual: any
      prediction: any
    }>
  }
}

const TrainingResults: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>()
  const navigate = useNavigate()
  const { api } = useAuth()
  
  // Global state
  const { lastModelId } = useAppStore()
  
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datasetData, setDatasetData] = useState<Array<Record<string, any>>>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [predictions, setPredictions] = useState<Array<string | number | null>>([])
  const [predConfs, setPredConfs] = useState<Array<number | null>>([])

  useEffect(() => {
    const effectiveModelId = modelId || lastModelId
    if (effectiveModelId) {
      console.log('🔍 Using modelId:', effectiveModelId, 'from URL:', !!modelId, 'from global state:', !!lastModelId)
      fetchTrainingResults(effectiveModelId)
    } else {
      console.error('❌ No modelId available from URL or global state')
      setError('No model ID available')
      setLoading(false)
    }
  }, [modelId, lastModelId])

  const loadMoreData = async () => {
    if (!result || loadingMore) return
    
    try {
      setLoadingMore(true)
      const datasetId = (result as any).dataset_id || result.model_id
      const response = await api.get(`/datasets/${datasetId}/data?offset=${currentOffset}&limit=10`)
      
      if (response.data.data) {
        const newRows = response.data.data as Array<Record<string, any>>
        setDatasetData(prev => [...prev, ...newRows])
        setCurrentOffset(prev => prev + newRows.length)
        setHasMore(response.data.has_more)

        // compute predictions for appended rows
        await computePredictionsForRows(newRows, predictions.length)
      }
    } catch (error: any) {
      console.error('❌ Failed to load more data:', error)
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      } else if (error.response?.status === 404) {
        toast.error('Dataset not found')
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.')
      } else {
        toast.error('Failed to load more data')
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const retryTraining = async () => {
    if (!result) return
    
    try {
      setLoading(true)
      console.log('🔄 Retrying training for model:', result.model_id)
      
      const response = await api.post(`/train/retry/${result.model_id}`)
      
      if (response.data.status === 'success') {
        console.log('✅ Retry training successful:', response.data)
        toast.success('Training completed successfully!')
        
        // Update the result with new data
        setResult({
          ...result,
          algorithm: response.data.algorithm,
          task_type: response.data.task_type,
          metrics: response.data.metrics,
          cross_validation_score: response.data.cross_validation_score,
          dataset_info: response.data.dataset_info,
          feature_importance: response.data.feature_importance
        })
        
        // Update dataset data if available
        if (response.data.dataset_info?.preview) {
          setDatasetData(response.data.dataset_info.preview)
          setHasMore(response.data.dataset_info.has_more)
          setCurrentOffset(response.data.dataset_info.preview.length)
        }
      }
    } catch (error: any) {
      console.error('❌ Retry training failed:', error)
      toast.error(error.response?.data?.detail || 'Failed to retry training')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrainingResults = async (effectiveModelId: string) => {
    try {
      setLoading(true)
      console.log('🔍 Fetching training results for model ID:', effectiveModelId)
      const response = await api.get(`/train/results/${effectiveModelId}`)
      console.log('📊 Training results received:', response.data)
      
      // Debug the dataset_info data
      if (response.data.dataset_info) {
        console.log('🔍 Dataset info:', response.data.dataset_info)
        console.log('🔍 Total rows:', response.data.dataset_info.total_rows)
        console.log('🔍 Has more:', response.data.dataset_info.has_more)
        console.log('🔍 Preview data:', response.data.dataset_info.preview)
        
        // Set initial dataset data from preview
        const initialRows = response.data.dataset_info.preview || []
        setDatasetData(initialRows)
        setHasMore(response.data.dataset_info.has_more || false)
        setCurrentOffset(initialRows.length || 0)
        setPredictions([])
      }
      
      setResult(response.data)
    } catch (error: any) {
      console.error('❌ Failed to fetch training results:', error)
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.')
        toast.error('Authentication failed. Redirecting to login...')
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      } else if (error.response?.status === 404) {
        setError('Model not found. Please check if the model exists.')
        toast.error('Model not found')
      } else if (error.response?.status === 500) {
        setError('Server error. Please try again later.')
        toast.error('Server error. Please try again later.')
      } else {
        setError(error.response?.data?.detail || 'Failed to fetch training results')
        toast.error('Failed to fetch training results')
      }
    } finally {
      setLoading(false)
    }
  }

  // Compute predictions for a set of rows starting at startIndex
  const computePredictionsForRows = async (
    rows: Array<Record<string, any>>, 
    startIndex: number
  ) => {
    try {
      if (!result) return
      const inputCols = result.dataset_info?.input_features || result.dataset_info?.columns || []
      const datasetId = (result as any).dataset_id || result.model_id

      const normalize = (v: any) => {
        if (v === undefined || v === null) return null
        if (typeof v === 'string') {
          const s = v.trim()
          if (s === '' || s === '-') return null
          const n = Number(s)
          if (!Number.isNaN(n)) return n
          return s
        }
        return v
      }

      const requests = rows.map((row) => {
        const payload: Record<string, any> = {}
        inputCols.forEach(col => {
          if (col in row) {
            let v = normalize(row[col])
            // Fill missing values client-side by type to avoid null predictions
            if (v === null || v === undefined || v === '') {
              const dtype = (result.dataset_info?.data_types || {})[col]
              if (dtype && String(dtype).toLowerCase().includes('object')) v = 'Unknown'
              else v = 0
            }
            payload[col] = v
          }
        })
        const alg = (result as any)?.algorithm
        const url = alg ? `/predict/${datasetId}?algorithm=${encodeURIComponent(alg)}` : `/predict/${datasetId}`
        return api.post(url, { dataset_id: datasetId, input_features: payload })
          .then(res => ({ p: res.data?.prediction ?? null, c: res.data?.confidence ?? null }))
          .catch(() => ({ p: null, c: null }))
      })

      const responses = await Promise.all(requests)
      const newPreds: Array<string | number | null> = responses.map(r => (r && 'p' in r ? (r as any).p : null))
      const newConfs: Array<number | null> = responses.map(r => (r && 'c' in r ? (r as any).c : null))
      setPredictions(prev => {
        const out = [...prev]
        for (let i = 0; i < newPreds.length; i++) out[startIndex + i] = newPreds[i]
        return out
      })
      setPredConfs(prev => {
        const out = [...prev]
        for (let i = 0; i < newConfs.length; i++) out[startIndex + i] = newConfs[i]
        return out
      })
    } catch (e) {
      // ignore individual prediction errors per row
    }
  }

  // After initial data load, compute predictions for those rows
  useEffect(() => {
    if (!result) return
    if (datasetData.length > predictions.length) {
      const start = predictions.length
      const slice = datasetData.slice(start)
      computePredictionsForRows(slice, start)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetData, result])

  const formatMetric = (value: number, type: 'percentage' | 'decimal' = 'decimal') => {
    if (isNaN(value) || value === null || value === undefined) {
      return 'N/A'
    }
    if (type === 'percentage') {
      return `${(value * 100).toFixed(1)}%`
    }
    return value.toFixed(4)
  }


  if (loading) {
    console.log('🔄 TrainingResults: Rendering loading state')
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Loading training results...</p>
          </div>
        </div>
        
        {/* Test Button - Always Available */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              console.log('🧪 Test button clicked (loading state)')
              alert('Button is working! This confirms the buttons are clickable.')
            }}
            className="px-4 py-2 bg-yellow-600 rounded-lg text-white hover:bg-yellow-500 transition-colors cursor-pointer"
          >
            🧪 Test Button (Loading State)
          </button>
        </div>
        
        {/* Action Buttons - Always Available */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              console.log('🔙 Go Back button clicked (loading)')
              navigate(-1)
            }}
            className="px-6 py-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              console.log('🏠 Dashboard button clicked (loading)')
              navigate('/dashboard')
            }}
            className="px-6 py-3 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    console.log('❌ TrainingResults: Rendering error state')
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={() => {
                console.log('🔙 Error state back button clicked')
                window.location.href = '/dashboard'
              }}
              className="mt-4 px-4 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600"
            >
              Go Back
            </button>
          </div>
        </div>
        
        {/* Test Button - Always Available */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              console.log('🧪 Test button clicked (error state)')
              alert('Button is working! This confirms the buttons are clickable.')
            }}
            className="px-4 py-2 bg-yellow-600 rounded-lg text-white hover:bg-yellow-500 transition-colors cursor-pointer"
          >
            🧪 Test Button (Error State)
          </button>
        </div>
        
        {/* Action Buttons - Always Available */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              console.log('🔙 Go Back button clicked (error)')
              navigate(-1)
            }}
            className="px-6 py-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              console.log('🏠 Dashboard button clicked (error)')
              navigate('/dashboard')
            }}
            className="px-6 py-3 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!result) {
    console.log('❓ TrainingResults: Rendering no result state')
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No training results found</p>
          </div>
        </div>
        
        {/* Test Button - Always Available */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              console.log('🧪 Test button clicked (no result state)')
              alert('Button is working! This confirms the buttons are clickable.')
            }}
            className="px-4 py-2 bg-yellow-600 rounded-lg text-white hover:bg-yellow-500 transition-colors cursor-pointer"
          >
            🧪 Test Button (No Result State)
          </button>
        </div>
        
        {/* Action Buttons - Always Available */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              console.log('🔙 Go Back button clicked (no result)')
              navigate(-1)
            }}
            className="px-6 py-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              console.log('🏠 Dashboard button clicked (no result)')
              navigate('/dashboard')
            }}
            className="px-6 py-3 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  console.log('✅ TrainingResults: Rendering main content with result:', !!result)
  console.log('✅ TrainingResults: Loading state:', loading)
  console.log('✅ TrainingResults: Error state:', error)
  console.log('✅ TrainingResults: Result state:', result)
  return (
    <div className="p-8 space-y-8 relative z-10 min-h-screen bg-slate-900">
      {/* Background stabilizer behind content but below any UI */}
      <div className="fixed inset-0 bg-slate-900 z-0 pointer-events-none" />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between relative z-20"
      >
        <div className="space-y-1">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Go back to previous page"
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Training Results</h1>
            <button
              onClick={() => {
                console.log('🔄 Refresh button clicked')
                const effectiveModelId = modelId || lastModelId
                if (effectiveModelId) {
                  fetchTrainingResults(effectiveModelId)
                }
              }}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Refresh training results"
            >
              <RefreshCw className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <p className="text-slate-400 text-sm md:text-base">
            Model: {result.algorithm} • {result.task_type}
          </p>
        </div>
      </motion.div>

      {/* Metrics Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-20"
      >
        {/* Cross-Validation Score */}
        <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">Cross-Validation Score</span>
          </div>
          <div className="text-xl font-bold text-blue-400">
            {formatMetric(result.cross_validation_score?.mean, 'percentage')}
          </div>
          <div className="text-slate-400 text-xs">
            ± {formatMetric(result.cross_validation_score?.std, 'percentage')} (std dev)
          </div>
          {isNaN(result.cross_validation_score?.mean) && (
            <div className="text-red-400 text-xs mt-1">
              ⚠️ Training may have failed - check console for errors
            </div>
          )}
        </div>

        {/* Accuracy (for classification) */}
        {result.metrics?.accuracy !== undefined && !isNaN(result.metrics.accuracy) && (
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-3 mb-2">
              <Target className="h-5 w-5 text-green-400" />
              <span className="text-white font-medium">Accuracy</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {formatMetric(result.metrics.accuracy, 'percentage')}
            </div>
          </div>
        )}

        {/* R² Score (for regression) */}
        {result.metrics.r2_score && (
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-400" />
              <span className="text-white font-medium">R² Score</span>
            </div>
            <div className="text-xl font-bold text-orange-400">
              {formatMetric(result.metrics.r2_score)}
            </div>
          </div>
        )}

        {/* Adjusted R² (regression) */}
        {result.metrics?.adjusted_r2 !== undefined && (
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-300" />
              <span className="text-white font-medium">Adjusted R²</span>
            </div>
            <div className="text-xl font-bold text-orange-300">
              {formatMetric(result.metrics.adjusted_r2)}
            </div>
          </div>
        )}

        {/* Algorithm */}
        <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-3 mb-2">
            <Zap className="h-5 w-5 text-purple-400" />
            <span className="text-white font-medium">Algorithm</span>
          </div>
          <div className="text-base font-bold text-purple-400">
            {result.algorithm}
          </div>
          <div className="text-slate-400 text-xs">
            {result.task_type}
          </div>
        </div>
      </motion.div>

      {/* Real Dataset Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6 relative z-20 pb-24"
      >
        {/* Detailed Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {result.metrics?.mae !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">MAE</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.mae)}</div>
            </div>
          )}
          {result.metrics?.mse !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">MSE</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.mse)}</div>
            </div>
          )}
          {result.metrics?.rmse !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">RMSE</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.rmse)}</div>
            </div>
          )}
          {result.metrics?.precision !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">Precision</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.precision)}</div>
            </div>
          )}
          {result.metrics?.recall !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">Recall</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.recall)}</div>
            </div>
          )}
          {result.metrics?.f1_score !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">F1 Score</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.f1_score)}</div>
            </div>
          )}
          {result.metrics?.auc_roc !== undefined && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-slate-300 text-sm mb-1">ROC-AUC</div>
              <div className="text-lg font-semibold text-slate-100">{formatMetric(result.metrics.auc_roc)}</div>
            </div>
          )}
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center">
          <Database className="h-6 w-6 mr-3" />
          Model Results: Input Features & Output
        </h2>
        
        <div className="bg-slate-800/80 rounded-lg p-4 md:p-6 relative z-[1000]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-white">Selected Features & Target Variable</h3>
              <p className="text-slate-400 text-xs md:text-sm">
                Showing {datasetData.length} of {result.dataset_info?.total_rows || 0} rows
                {result.dataset_info?.input_features && (
                  <span className="ml-2 text-blue-400">
                    • Input: {result.dataset_info.input_features.join(', ')}
                    {result.dataset_info.output_feature && ` • Output: ${result.dataset_info.output_feature}`}
                  </span>
                )}
              </p>
            </div>
            {hasMore && (
              <div className="shrink-0">
                <button
                  onClick={loadMoreData}
                  disabled={loadingMore}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>Show More</span>
                </button>
              </div>
            )}
          </div>
          
          {datasetData.length > 0 ? (
            <div className="results-scroll overflow-x-auto overflow-y-auto max-h-[60vh] w-full max-w-full relative z-20 bg-slate-900 pb-2 rounded-md">
              <table className="min-w-max text-[11px] md:text-xs results-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead className="sticky top-0 z-[1002] bg-slate-800">
                  <tr className="border-b border-slate-700">
                    {result.dataset_info?.columns?.map((col) => (
                      <th key={col} className="text-left py-2 px-3 text-slate-200 font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                    <th className="text-left py-2 px-3 text-slate-200 font-semibold text-green-400 whitespace-nowrap">
                      Predicted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datasetData.map((row, index) => (
                    <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/60">
                      {result.dataset_info?.columns?.map((col) => (
                        <td key={col} className="py-1.5 px-3 text-slate-200 whitespace-nowrap text-ellipsis">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-green-400 font-medium whitespace-nowrap text-ellipsis">
                        {(() => {
                          const pred = predictions[index]
                          const conf = predConfs[index]
                          const outKey = result.dataset_info?.output_feature
                          const outType = outKey ? result.dataset_info?.data_types?.[outKey] : undefined
                          const isOutputString = outType ? String(outType).toLowerCase().includes('object') : false
                          if (pred === null || pred === undefined) return '-'
                          if (isOutputString) {
                            const label = outKey ? String(row[outKey] ?? '') : ''
                            if (label) {
                              if (typeof pred === 'string' && typeof conf === 'number') return `${pred} (${conf})`
                              if (typeof conf === 'number') return `${label} (${conf})`
                              return label
                            }
                          }
                          if (typeof pred === 'number') return String(pred)
                          if (typeof pred === 'string' && typeof conf === 'number') return `${pred} (${conf})`
                          return String(pred)
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No dataset data available</p>
            </div>
          )}
        </div>
        
        {/* Sample Predictions removed per request */}
      </motion.div>

      {/* Feature Importance */}
      {Object.keys(result.feature_importance).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 rounded-lg p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Feature Importance
          </h3>
          <div className="space-y-2">
            {Object.entries(result.feature_importance)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([feature, importance]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-slate-300">{feature}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${importance * 100}%` }}
                      />
                    </div>
                    <span className="text-slate-400 text-sm w-12 text-right">
                      {formatMetric(importance, 'percentage')}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Training Status Alert */}
      {(isNaN(result.cross_validation_score?.mean) || !result.dataset_info?.preview?.length) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div>
              <h3 className="text-red-400 font-medium">Training Failed</h3>
              <p className="text-red-300 text-sm">
                The model training encountered an error. This is likely due to data type conversion issues.
                Please try training again with a different algorithm or check your data.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Removed debug test button for cleaner UI */}

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="sticky bottom-0 left-0 right-0 z-[1003] flex justify-center space-x-4 bg-slate-900/95 backdrop-blur border-t border-slate-700 py-3 px-4"
      >
         <button
           onClick={() => {
             console.log('🔙 Go Back button clicked')
             const dsId = (result as any)?.dataset_id
             if (dsId) {
               navigate(`/analyze/${dsId}`)
             } else {
               navigate('/dashboard')
             }
           }}
           className="px-6 py-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition-colors"
         >
           Go Back
         </button>
        <button
          onClick={() => {
            console.log('🏠 Dashboard button clicked')
            console.log('🏠 Mouse click detected - navigating to dashboard')
            navigate('/dashboard')
          }}
          className="px-6 py-3 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors"
        >
          Dashboard
        </button>
        {(isNaN(result.cross_validation_score?.mean) || !result.dataset_info?.preview?.length) && (
          <button
            onClick={retryTraining}
            disabled={loading}
            className="px-6 py-3 bg-red-600 rounded-lg text-white hover:bg-red-500 disabled:bg-red-400 transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Retry Training</span>
          </button>
        )}
      </motion.div>
    </div>
  )
}

export default TrainingResults