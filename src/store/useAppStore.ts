import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Dataset {
  id: number
  filename: string
  file_size: number
  created_at: string
  file_path?: string
}

interface Model {
  id: number
  algorithm: string
  task_type: string
  created_at: string
  metrics: {
    r2_score?: number
    accuracy?: number
    cross_validation_score?: {
      mean: number
      std: number
    }
  }
}

interface TrainingConfig {
  targetColumn: string
  taskType: string
  inputFeatures: string[]
  algorithm: string
}

interface AppState {
  // Dataset state
  selectedDataset: Dataset | null
  availableDatasets: Dataset[]
  
  // Model state
  recentModels: Model[]
  selectedModel: Model | null
  
  // Training configuration state
  trainingConfig: Record<number, TrainingConfig> // datasetId -> training config
  
  // Navigation state
  canGoBack: boolean
  previousPath: string | null
  lastModelId: string | null
  
  // Loading states
  isLoadingDatasets: boolean
  isLoadingModels: boolean
  
  // Actions
  setSelectedDataset: (dataset: Dataset | null) => void
  setAvailableDatasets: (datasets: Dataset[]) => void
  setRecentModels: (models: Model[]) => void
  setSelectedModel: (model: Model | null) => void
  setTrainingConfig: (datasetId: number, config: TrainingConfig) => void
  getTrainingConfig: (datasetId: number) => TrainingConfig | null
  setCanGoBack: (canGoBack: boolean) => void
  setPreviousPath: (path: string | null) => void
  setLastModelId: (modelId: string | null) => void
  setLoadingDatasets: (loading: boolean) => void
  setLoadingModels: (loading: boolean) => void
  
  // Utility functions
  getDatasetById: (id: number) => Dataset | null
  getModelById: (id: number) => Model | null
  clearState: () => void
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedDataset: null,
      availableDatasets: [],
      recentModels: [],
      selectedModel: null,
      trainingConfig: {},
      canGoBack: false,
      previousPath: null,
      lastModelId: null,
      isLoadingDatasets: false,
      isLoadingModels: false,
      
      // Actions
      setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
      setAvailableDatasets: (datasets) => set({ availableDatasets: datasets }),
      setRecentModels: (models) => set({ recentModels: models }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setTrainingConfig: (datasetId, config) => set((state) => ({
        trainingConfig: { ...state.trainingConfig, [datasetId]: config }
      })),
      getTrainingConfig: (datasetId) => {
        const state = get()
        return state.trainingConfig[datasetId] || null
      },
      setCanGoBack: (canGoBack) => set({ canGoBack }),
      setPreviousPath: (path) => set({ previousPath: path }),
      setLastModelId: (modelId) => set({ lastModelId: modelId }),
      setLoadingDatasets: (loading) => set({ isLoadingDatasets: loading }),
      setLoadingModels: (loading) => set({ isLoadingModels: loading }),
      
      // Utility functions
      getDatasetById: (id) => {
        const datasets = get().availableDatasets
        return datasets.find(d => d.id === id) || null
      },
      
      getModelById: (id) => {
        const models = get().recentModels
        return models.find(m => m.id === id) || null
      },
      
      clearState: () => set({
        selectedDataset: null,
        availableDatasets: [],
        recentModels: [],
        selectedModel: null,
        trainingConfig: {},
        canGoBack: false,
        previousPath: null,
        lastModelId: null,
        isLoadingDatasets: false,
        isLoadingModels: false,
      }),
    }),
    {
      name: 'automl-app-store',
      partialize: (state) => ({
        selectedDataset: state.selectedDataset,
        trainingConfig: state.trainingConfig,
        canGoBack: state.canGoBack,
        previousPath: state.previousPath,
        lastModelId: state.lastModelId,
      }),
    }
  )
)

export default useAppStore
