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

interface VisualizationData {
  plot_files: string[]
  plot_urls: string[]
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
  
  // Visualization state
  visualizationData: Record<number, VisualizationData> // datasetId -> visualization data
  
  // Training configuration state
  trainingConfig: Record<number, TrainingConfig> // datasetId -> training config
  
  // Navigation state
  canGoBack: boolean
  previousPath: string | null
  lastModelId: string | null
  
  // Loading states
  isLoadingDatasets: boolean
  isLoadingModels: boolean
  isLoadingVisualizations: boolean
  
  // Actions
  setSelectedDataset: (dataset: Dataset | null) => void
  setAvailableDatasets: (datasets: Dataset[]) => void
  setRecentModels: (models: Model[]) => void
  setSelectedModel: (model: Model | null) => void
  setVisualizationData: (datasetId: number, data: VisualizationData) => void
  getVisualizationData: (datasetId: number) => VisualizationData | null
  setTrainingConfig: (datasetId: number, config: TrainingConfig) => void
  getTrainingConfig: (datasetId: number) => TrainingConfig | null
  setCanGoBack: (canGoBack: boolean) => void
  setPreviousPath: (path: string | null) => void
  setLastModelId: (modelId: string | null) => void
  setLoadingDatasets: (loading: boolean) => void
  setLoadingModels: (loading: boolean) => void
  setLoadingVisualizations: (loading: boolean) => void
  
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
      visualizationData: {},
      trainingConfig: {},
      canGoBack: false,
      previousPath: null,
      lastModelId: null,
      isLoadingDatasets: false,
      isLoadingModels: false,
      isLoadingVisualizations: false,
      
      // Actions
      setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
      setAvailableDatasets: (datasets) => set({ availableDatasets: datasets }),
      setRecentModels: (models) => set({ recentModels: models }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setVisualizationData: (datasetId, data) => set((state) => ({
        visualizationData: { ...state.visualizationData, [datasetId]: data }
      })),
      getVisualizationData: (datasetId) => {
        const state = get()
        return state.visualizationData[datasetId] || null
      },
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
      setLoadingVisualizations: (loading) => set({ isLoadingVisualizations: loading }),
      
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
        visualizationData: {},
        trainingConfig: {},
        canGoBack: false,
        previousPath: null,
        lastModelId: null,
        isLoadingDatasets: false,
        isLoadingModels: false,
        isLoadingVisualizations: false,
      }),
    }),
    {
      name: 'automl-app-store',
      partialize: (state) => ({
        selectedDataset: state.selectedDataset,
        visualizationData: state.visualizationData,
        trainingConfig: state.trainingConfig,
        canGoBack: state.canGoBack,
        previousPath: state.previousPath,
        lastModelId: state.lastModelId,
      }),
    }
  )
)

export default useAppStore
