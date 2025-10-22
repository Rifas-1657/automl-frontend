import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { toast } from 'react-hot-toast'
import useAppStore from '../store/useAppStore'
import {
  Target,
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
}

interface PredictionRequest {
  input_features: Record<string, any>
}

const Predict: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const { api } = useAuth()
  
  // Global state
  const {
    selectedDataset,
    setSelectedDataset,
    previousPath
  } = useAppStore()
  
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [inputFeatures, setInputFeatures] = useState<Record<string, any>>({})
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingDataset, setLoadingDataset] = useState(true)
  const [featureNames, setFeatureNames] = useState<string[]>([])
  const [expectedFeatures, setExpectedFeatures] = useState<string[] | null>(null)
  const [targetColumn, setTargetColumn] = useState<string>('')
  const [categoricalOptions, setCategoricalOptions] = useState<Record<string, string[]>>({})
  const [errors, setErrors] = useState<string>('')
  const [taskType, setTaskType] = useState<string>('')
  // Disable auto-predict to avoid auto-correction while typing
  const [autoPredict, setAutoPredict] = useState<boolean>(false)
  const [outputIsNumeric, setOutputIsNumeric] = useState<boolean | null>(null)
  const debounceRef = useRef<number | undefined>(undefined)
  const [batchRows, setBatchRows] = useState<any[]>([])
  const [batchResults, setBatchResults] = useState<Array<{ prediction: number | string | null, confidence?: number }>>([])
  const [batchErrors, setBatchErrors] = useState<string[]>([])
  const [batchProgress, setBatchProgress] = useState<number>(0)
  const [batchRunning, setBatchRunning] = useState<boolean>(false)
  const [history, setHistory] = useState<Array<{ ts: string, input: Record<string, any>, prediction: any }>>([])
  const location = useLocation() as any
  const passed = (location && location.state) || {}
  const [inputColumns] = useState<string[]>(passed.inputColumns || [])
  const [availableDatasets, setAvailableDatasets] = useState<Dataset[]>([])
  const [selectorLoading, setSelectorLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  useEffect(() => {
    if (datasetId) {
      // Check if we already have the dataset in global state
      if (selectedDataset && selectedDataset.id === parseInt(datasetId)) {
        setDataset(selectedDataset)
        fetchAnalysisData()
        loadHistory()
        setLoadingDataset(false)
      } else {
        fetchDatasetInfo()
        fetchAnalysisData()
        loadHistory()
      }
    } else {
      // No dataset in URL → offer selection/upload inline
      ;(async () => {
        try {
          setSelectorLoading(true)
          const res = await api.get('/datasets')
          setAvailableDatasets(res.data || [])
        } catch (e) {
          console.error('Failed to list datasets:', e)
          toast.error('Failed to load your datasets')
        } finally {
          setSelectorLoading(false)
          setLoadingDataset(false)
        }
      })()
    }
  }, [datasetId, selectedDataset])

  const fetchDatasetInfo = async () => {
    try {
      // Fetch the specific dataset by ID
      const response = await api.get(`/datasets/${datasetId}`)
      if (response.data) {
        setDataset(response.data)
        setSelectedDataset(response.data)
        console.log('📊 Fetched dataset:', response.data)
      } else {
        toast.error('Dataset not found')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('❌ Failed to fetch dataset:', error)
      toast.error('Failed to fetch dataset info')
      navigate('/dashboard')
    } finally {
      setLoadingDataset(false)
    }
  }
  const fetchAnalysisData = async () => {
    try {
      const response = await api.post(`/analyze/${datasetId}`)
      
      // Use passed targetColumn first, otherwise use analysis target
      const target = passed.targetColumn || response.data.target
      setTargetColumn(target)
      console.log('🎯 Target column set to:', target, 'from passed:', passed.targetColumn, 'from analysis:', response.data.target)
      setTaskType(response.data.task_type || '')
      
      const ds = await api.get(`/datasets/${datasetId}`)
      const columns: string[] = ds.data.columns || []
      // Best-effort detection of target numeric-ness from preview rows (if provided)
      try {
        const preview: any[] = ds.data?.data_preview || []
        if (preview.length > 0 && target) {
          let numeric = true
          for (const r of preview.slice(0, 10)) {
            const v = r?.[target]
            if (v === null || v === undefined || v === '') continue
            const n = Number(v)
            if (typeof v === 'string' && v.trim() !== '' && Number.isNaN(n)) { numeric = false; break }
          }
          setOutputIsNumeric(numeric)
        }
      } catch {}
      
      const features = inputColumns.length > 0 
        ? inputColumns 
        : columns.filter(c => c !== target).slice(0, 20)
      
      setFeatureNames(features)
      // Fetch prediction schema (expected features + categorical choices)
      try {
        const schema = await api.get(`/predict/schema/${datasetId}`)
        const feats = schema.data?.expected_features
        if (Array.isArray(feats) && feats.length > 0) {
          setExpectedFeatures(feats)
          setFeatureNames(feats)
        }
        if (schema.data?.categorical_options) {
          setCategoricalOptions(schema.data.categorical_options)
        }
      } catch (e) {
        // non-fatal
      }
      // Try to fetch latest trained model metadata to get exact expected features and algorithm
      try {
        const hist = await api.get('/history')
        const models: any[] = hist.data?.models || []
        const recent = models.find(m => m && typeof m === 'object' && m.dataset_id === parseInt(datasetId!)) || models[0]
        const feats = (recent?.metrics && (recent.metrics.features || recent.metrics?.metrics?.features)) || null
        if (Array.isArray(feats) && feats.length > 0) {
          setExpectedFeatures(feats)
          // If our current featureNames differ, prefer the trained ones
          setFeatureNames(feats)
        }
        // Lock algorithm from navigation state first, else from most recent model on this dataset
        if (!passed?.algorithm && recent?.algorithm) {
          (passed as any).algorithm = recent.algorithm
        }
      } catch {}
    } catch (error) {
      console.error('Failed to fetch analysis data:', error)
      setFeatureNames([])
    }
  }

  const handleInputChange = (key: string, value: string) => {
    const isCategorical = !!categoricalOptions[key]
    // Do not auto-convert typed values; send exactly what the user typed for non-categorical too
    setInputFeatures(prev => ({
      ...prev,
      [key]: isCategorical ? value : value
    }))
    setErrors('')
    if (autoPredict) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        makePrediction()
      }, 400)
    }
  }

  const validateInputs = (): string | null => {
    if (!datasetId) return 'Invalid dataset ID'
    const keys = Object.keys(inputFeatures || {})
    if (keys.length === 0) return 'Please provide input features'
    // If backend has an expected feature list, ensure exact match before calling
    if (Array.isArray(expectedFeatures) && expectedFeatures.length > 0) {
      const missing = expectedFeatures.filter(f => !(f in (inputFeatures || {})))
      const unexpected = keys.filter(k => !expectedFeatures.includes(k))
      if (missing.length > 0) return `Missing required features: ${missing.join(', ')}`
      if (unexpected.length > 0) return `Unexpected features: ${unexpected.join(', ')}`
    }
    for (const k of keys) {
      if (inputFeatures[k] === '' || inputFeatures[k] === undefined || inputFeatures[k] === null) return `Please enter a value for ${k}`
    }
    return null
  }

  const saveHistory = (entry: { input: Record<string, any>, prediction: any }) => {
    const ts = new Date().toISOString()
    const n = { ts, ...entry }
    setHistory(prev => {
      const arr = [n, ...prev].slice(0, 50)
      try { localStorage.setItem(`predict_history_${datasetId}`, JSON.stringify(arr)) } catch {}
      return arr
    })
  }
  const loadHistory = () => {
    try { const s = localStorage.getItem(`predict_history_${datasetId}`); if (s) setHistory(JSON.parse(s)) } catch {}
  }
  const makePrediction = async () => {
    const err = validateInputs()
    if (err) { setErrors(err); toast.error(err); return }
    
    // Only validate categorical against known allowed values; do not coerce or constrain numeric ranges
    const validationErrors: string[] = []
    for (const [key, value] of Object.entries(inputFeatures)) {
      if (!!categoricalOptions[key]) {
        const allowed = categoricalOptions[key]
        const v = String(value)
        if (!allowed.includes(v)) {
          validationErrors.push(`Invalid value for ${key}. Allowed: ${allowed.join(', ')}`)
        }
      }
    }
    if (validationErrors.length > 0) {
      setErrors(validationErrors.join(', '))
      toast.error(validationErrors.join(', '))
      return
    }
    
    setLoading(true)
    try {
      // If an algorithm was passed from Train page, include it as a query param to ensure consistent model
      const algo = passed?.algorithm
      const url = algo ? `/predict/${datasetId}?algorithm=${encodeURIComponent(algo)}` : `/predict/${datasetId}`
      const response = await api.post(url, { dataset_id: parseInt(datasetId!), input_features: inputFeatures })
      setPrediction(response.data)
      saveHistory({ input: inputFeatures, prediction: response.data })
      toast.success('Prediction made successfully!')
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      // Emergency recovery: detect corrupted model by unexpected_features, delete, and redirect to retrain
      if (detail && typeof detail === 'object' && detail.type === 'unexpected_features') {
        try {
          toast.error('Model appears corrupted. Preparing retrain...')
          await api.delete(`/models/corrupted/${datasetId}`)
          navigate(`/train/${datasetId}`, {
            state: {
              inputColumns: featureNames.length > 0 ? featureNames : expectedFeatures || Object.keys(inputFeatures || {}),
              targetColumn: targetColumn || (passed?.targetColumn || ''),
              forceRetrain: true
            }
          })
          return
        } catch {}
      }
      let msg = 'Failed to make prediction'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) {
        try { msg = detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ') } catch {}
      } else if (detail) {
        try { msg = JSON.stringify(detail) } catch {}
      }
      toast.error(msg)
      setErrors(msg)
    } finally {
      setLoading(false)
    }
  }

  const parseCsv = async (file: File): Promise<any[]> => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim())
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',')
      const obj: Record<string, any> = {}
      headers.forEach((h, idx) => {
        // Keep raw strings to avoid unintended coercion; backend handles numeric casting
        const v = (vals[idx] ?? '').trim()
        obj[h] = v
      })
      rows.push(obj)
    }
    return rows
  }

  const handleBatchFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const rows = await parseCsv(file)
      if (rows.length === 0) { toast.error('CSV is empty or invalid'); return }
      setBatchRows(rows)
      setBatchResults([])
      setBatchErrors([])
      setBatchProgress(0)
    } catch { toast.error('Failed to parse CSV') } finally { if (e.target) e.target.value = '' }
  }

  const runBatchPredictions = async () => {
    if (batchRows.length === 0) { toast.error('No CSV rows to predict'); return }
    setBatchRunning(true)
    const results: Array<{ prediction: number | string | null, confidence?: number }> = []
    const errors: string[] = []
    for (let i = 0; i < batchRows.length; i++) {
      try {
        // Sanitize row to expected features if known
        let payload: Record<string, any> = {}
        const row = batchRows[i]
        if (Array.isArray(expectedFeatures) && expectedFeatures.length > 0) {
          expectedFeatures.forEach((f) => {
            let v = row[f]
            if (v === undefined || v === '') v = null
            payload[f] = v
          })
        } else {
          payload = { ...row }
        }
        // Optional client-side categorical check to avoid 400s
        let invalidMsg: string | null = null
        Object.keys(categoricalOptions || {}).forEach((col) => {
          if (payload[col] === null || payload[col] === undefined || payload[col] === '') return
          const allowed = categoricalOptions[col]
          const valS = String(payload[col])
          if (allowed && !allowed.includes(valS)) {
            invalidMsg = `Row ${i + 1}: invalid ${col}='${valS}'. Allowed: ${allowed.join(', ')}`
          }
        })
        if (invalidMsg) {
          errors.push(invalidMsg)
          results.push({ prediction: null })
        } else {
          const { data } = await api.post(`/predict/${datasetId}`, { dataset_id: parseInt(datasetId!), input_features: payload })
          results.push({ prediction: data.prediction, confidence: data.confidence })
          errors.push('')
        }
      } catch (err: any) {
        // Capture server-side detail to help fix NAN cases
        let msg = ''
        const detail = err?.response?.data?.detail
        if (typeof detail === 'string') msg = detail
        else if (detail?.type === 'invalid_categorical_value') {
          try { msg = (detail.invalid || []).map((d: any) => `${d.column}='${d.value}'`).join('; ') } catch {}
        }
        results.push({ prediction: null })
        errors.push(msg || 'prediction failed')
      }
      setBatchProgress(Math.round(((i + 1) * 100) / batchRows.length))
    }
    setBatchResults(results)
    setBatchErrors(errors)
    setBatchRunning(false)
  }

  const downloadCsv = () => {
    if (batchRows.length === 0 || batchResults.length === 0) return
    const headers = Object.keys(batchRows[0])
    const lines: string[] = []
    lines.push([...headers, 'prediction', 'confidence'].join(','))
    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i]
      const out = headers.map(h => String(row[h] ?? ''))
      const r = batchResults[i]
      out.push(String(r?.prediction ?? ''))
      out.push(r?.confidence !== undefined ? String(r.confidence) : '')
      lines.push(out.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `predictions_${datasetId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loadingDataset) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-lg">Loading dataset...</p>
          </div>
        </div>
      </div>
    )
  }

  // Inline dataset chooser when user navigates without datasetId
  if (!datasetId && !dataset) {
    return (
      <div className="p-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Choose a Dataset for Predictions</h1>
            <p className="text-slate-400">Select a past dataset or upload a new one.</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Your Datasets</h2>
              <button onClick={async () => {
                try { setSelectorLoading(true); const res = await api.get('/datasets'); setAvailableDatasets(res.data || []) } finally { setSelectorLoading(false) }
              }} className="px-3 py-1.5 bg-slate-700 text-white rounded">Refresh</button>
            </div>
            {selectorLoading ? (
              <div className="text-slate-400">Loading…</div>
            ) : availableDatasets.length === 0 ? (
              <div className="text-slate-400">No datasets yet. Upload one below.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/40">
                {availableDatasets.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2">
                    <div className="text-slate-300">{d.filename}</div>
                    <button onClick={() => navigate(`/predict/${d.id}`)} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500">Use</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-3">Upload New Dataset</h2>
            <input type="file" accept=".csv,.xlsx,.json" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return
              try {
                setUploading(true)
                const form = new FormData()
                form.append('file', file)
                const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
                const newId = res.data?.dataset?.id
                if (newId) { toast.success('Dataset uploaded'); navigate(`/predict/${newId}`) }
              } catch (err) {
                console.error('Upload failed:', err)
                toast.error('Upload failed')
              } finally {
                setUploading(false)
                if (e.target) e.target.value = ''
              }
            }} className="text-slate-300" />
            {uploading && <div className="text-slate-400 text-sm mt-2">Uploading…</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                // Prefer going back to training page for current dataset when available
                if (datasetId) {
                  navigate(`/train/${datasetId}`)
                } else if (previousPath) {
                  navigate(previousPath)
                } else {
                  navigate('/dashboard')
                }
              }}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title={previousPath ? `Go back to ${previousPath}` : 'No previous page'}
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <h1 className="text-4xl font-bold text-white">Make Predictions</h1>
          </div>
          <p className="text-slate-400 text-lg">
            Using dataset: {dataset?.filename || '—'}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8">
        {/* Input Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Target className="h-6 w-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Input Features</h2>
          </div>

          <div className="space-y-4">
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-blue-400 text-sm font-medium mb-1">Target Column</div>
              <div className="text-white">{targetColumn || 'Loading...'}</div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {featureNames.map((feature) => {
                const options = categoricalOptions[feature]
                return (
                  <div key={feature}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {feature.replace('_', ' ').toUpperCase()}
                    </label>
                    {options?.length ? (
                      <select
                        onChange={(e) => handleInputChange(feature, e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                        defaultValue=""
                      >
                        <option value="" disabled>Choose…</option>
                        {options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Enter value"
                        onChange={(e) => handleInputChange(feature, e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            {errors && (
  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
    {typeof errors === 'string' ? errors : JSON.stringify(errors)}
  </div>
)}            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" checked={autoPredict} onChange={(e) => setAutoPredict(e.target.checked)} />
                Auto-predict while typing
              </label>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={makePrediction}
                disabled={loading || featureNames.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{loading ? 'Predicting...' : 'Predict'}</span>
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={makePrediction}
              disabled={loading || Object.keys(inputFeatures).length === 0}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{loading ? 'Making Prediction...' : 'Make Prediction'}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Prediction Result */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Prediction Result</h2>
          </div>

          {prediction ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    {(() => {
                      const p = prediction?.prediction
                      const conf = prediction?.confidence
                      const isClassification = outputIsNumeric === null
                        ? (taskType || '').toLowerCase().includes('class')
                        : !outputIsNumeric
                      if (isClassification) {
                        // Classification → show label (score) when available; fallback to string
                        if (typeof p === 'string' && typeof conf === 'number') return `${p} (${conf})`
                        return String(p ?? '')
                      }
                      // Regression → show numeric only
                      if (typeof p === 'number') return p
                      // Fallback to best-effort number parse or string
                      const n = Number(p)
                      return Number.isNaN(n) ? String(p ?? '') : n
                    })()}
                  </div>
                  <div className="text-slate-300 text-sm">
                    Predicted Value
                  </div>
                </div>
              </div>

              {prediction.confidence && (
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-300 text-sm mb-1">Confidence</div>
                  <div className="text-white font-semibold">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="text-slate-300 text-sm mb-2">Algorithm Used</div>
                <div className="text-white font-medium">
                  {prediction.algorithm_used}
                </div>
              </div>

              {(prediction.metrics || prediction.cross_validation_score) && (
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-300 text-sm mb-2">Model Metrics</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm results-table">
                      <tbody>
                        {prediction.metrics && Object.entries(prediction.metrics).map(([k,v]: any) => (
                          <tr key={k} className="border-b border-slate-700/40">
                            <td className="p-2 text-slate-400 whitespace-nowrap">{k}</td>
                            <td className="p-2 text-white">{typeof v === 'number' ? v.toFixed(4) : String(v)}</td>
                          </tr>
                        ))}
                        {prediction.cross_validation_score && (
                          <tr>
                            <td className="p-2 text-slate-400 whitespace-nowrap">cv_mean ± cv_std</td>
                            <td className="p-2 text-white">
                              {(() => {
                                const m = prediction.cross_validation_score?.mean
                                const s = prediction.cross_validation_score?.std
                                return [m, s].every((x: any) => typeof x === 'number') ? `${m.toFixed(4)} ± ${s.toFixed(4)}` : ''
                              })()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="text-slate-300 text-sm mb-2">Input Features</div>
                <div className="text-white text-sm">
                  {JSON.stringify(prediction.input_features, null, 2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No prediction yet</p>
              <p className="text-slate-500 text-sm mt-2">
                Fill in the input features and click "Make Prediction"
              </p>
            </div>
          )}
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Batch Prediction (CSV)</h2>
          <input type="file" accept=".csv" onChange={handleBatchFile} className="text-slate-300" />
        </div>
        {batchRows.length > 0 && (
          <div className="space-y-3">
            <div className="text-slate-300 text-sm">Rows loaded: {batchRows.length}</div>
            {batchRunning ? (
              <div>
                <div className="h-2 bg-slate-700 rounded">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded" style={{ width: `${batchProgress}%` }} />
                </div>
                <div className="text-slate-400 text-xs mt-1">{batchProgress}%</div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={runBatchPredictions} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">Run Batch Predictions</button>
                {batchResults.length > 0 && (
                  <button onClick={downloadCsv} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Download Results CSV</button>
                )}
              </div>
            )}
            {batchResults.length > 0 && (
              <div className="results-scroll">
                <table className="data-table text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {Object.keys(batchRows[0]).map(h => (<th key={h} className="text-left p-2 text-slate-300">{h}</th>))}
                      <th className="text-left p-2 text-slate-300">prediction</th>
                      <th className="text-left p-2 text-slate-300">confidence</th>
                      <th className="text-left p-2 text-slate-300">error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        {Object.keys(batchRows[0]).map(h => (<td key={h} className="p-2 text-slate-400">{String(row[h] ?? '')}</td>))}
                        <td className="p-2 text-slate-200">{batchResults[idx]?.prediction !== null && batchResults[idx]?.prediction !== undefined ? String(batchResults[idx]?.prediction) : ''}</td>
                        <td className="p-2 text-slate-200">{batchResults[idx]?.confidence !== undefined ? String(batchResults[idx]?.confidence) : ''}</td>
                        <td className="p-2 text-red-300 text-xs">{batchErrors[idx] || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6"
      >
        <h2 className="text-xl font-semibold text-white mb-4">Prediction History</h2>
        {history.length === 0 ? (
          <div className="text-slate-400">No history yet</div>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="p-3 bg-slate-700/30 rounded-lg border border-slate-700/40">
                <div className="text-slate-400 text-xs mb-2">{new Date(h.ts).toLocaleString()}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-2 bg-slate-800/50 rounded">
                    <div className="text-slate-300 text-xs mb-1">Inputs</div>
                    <pre className="pre-json">{JSON.stringify(h.input, null, 2)}</pre>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded">
                    <div className="text-slate-300 text-xs mb-1">Prediction</div>
                    <pre className="pre-json">{JSON.stringify(h.prediction, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
      </div>
    </div>
  )
}

export default Predict