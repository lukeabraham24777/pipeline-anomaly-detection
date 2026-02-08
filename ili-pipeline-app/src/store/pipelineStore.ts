import { create } from 'zustand';
import type {
  RunFile,
  NormalizedAnomaly,
  AnomalyMatch,
  OdometerDriftPoint,
  ProcessingState,
  PipelineInsights,
  AlignmentZone,
  CleaningReport,
} from '@/types';

interface PipelineStore {
  // File uploads
  runFiles: RunFile[];
  setRunFiles: (files: RunFile[]) => void;
  addRunFile: (file: RunFile) => void;
  removeRunFile: (index: number) => void;
  clearRunFiles: () => void;

  // Processed data
  alignedAnomalies: NormalizedAnomaly[];
  setAlignedAnomalies: (anomalies: NormalizedAnomaly[]) => void;

  matches: AnomalyMatch[];
  setMatches: (matches: AnomalyMatch[]) => void;

  alignmentZones: AlignmentZone[];
  setAlignmentZones: (zones: AlignmentZone[]) => void;

  odometerDrift: OdometerDriftPoint[];
  setOdometerDrift: (drift: OdometerDriftPoint[]) => void;

  // Cleaning reports
  cleaningReports: CleaningReport[];
  setCleaningReports: (reports: CleaningReport[]) => void;

  // Processing state
  processing: ProcessingState;
  setProcessing: (state: Partial<ProcessingState>) => void;

  // AI insights
  insights: PipelineInsights | null;
  setInsights: (insights: PipelineInsights | null) => void;

  // Reset
  reset: () => void;
}

const initialProcessing: ProcessingState = {
  status: 'idle',
  progress: 0,
  message: '',
};

export const usePipelineStore = create<PipelineStore>((set) => ({
  runFiles: [],
  setRunFiles: (files) => set({ runFiles: files }),
  addRunFile: (file) => set((s) => ({ runFiles: [...s.runFiles, file] })),
  removeRunFile: (index) =>
    set((s) => ({ runFiles: s.runFiles.filter((_, i) => i !== index) })),
  clearRunFiles: () => set({ runFiles: [] }),

  alignedAnomalies: [],
  setAlignedAnomalies: (anomalies) => set({ alignedAnomalies: anomalies }),

  matches: [],
  setMatches: (matches) => set({ matches }),

  alignmentZones: [],
  setAlignmentZones: (zones) => set({ alignmentZones: zones }),

  odometerDrift: [],
  setOdometerDrift: (drift) => set({ odometerDrift: drift }),

  cleaningReports: [],
  setCleaningReports: (reports) => set({ cleaningReports: reports }),

  processing: initialProcessing,
  setProcessing: (state) =>
    set((s) => ({ processing: { ...s.processing, ...state } })),

  insights: null,
  setInsights: (insights) => set({ insights }),

  reset: () =>
    set({
      runFiles: [],
      alignedAnomalies: [],
      matches: [],
      alignmentZones: [],
      odometerDrift: [],
      cleaningReports: [],
      processing: initialProcessing,
      insights: null,
    }),
}));
