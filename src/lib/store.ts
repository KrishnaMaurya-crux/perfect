import { create } from "zustand";

export type AppView = "home" | "tool" | "history";

interface AppState {
  currentView: AppView;
  selectedToolId: string | null;
  uploadedFiles: File[];
  processingProgress: number;
  isProcessing: boolean;
  isComplete: boolean;
  authDialogOpen: boolean;

  navigateHome: () => void;
  selectTool: (toolId: string) => void;
  navigateHistory: () => void;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  setUploadedFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  startProcessing: () => void;
  setProcessingProgress: (progress: number) => void;
  completeProcessing: () => void;
  resetTool: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "home",
  selectedToolId: null,
  uploadedFiles: [],
  processingProgress: 0,
  isProcessing: false,
  isComplete: false,
  authDialogOpen: false,

  navigateHome: () =>
    set({
      currentView: "home",
      selectedToolId: null,
      uploadedFiles: [],
      processingProgress: 0,
      isProcessing: false,
      isComplete: false,
    }),

  selectTool: (toolId: string) =>
    set({
      currentView: "tool",
      selectedToolId: toolId,
      uploadedFiles: [],
      processingProgress: 0,
      isProcessing: false,
      isComplete: false,
    }),

  navigateHistory: () =>
    set({
      currentView: "history",
      selectedToolId: null,
      uploadedFiles: [],
      processingProgress: 0,
      isProcessing: false,
      isComplete: false,
    }),

  openAuthDialog: () => set({ authDialogOpen: true }),

  closeAuthDialog: () => set({ authDialogOpen: false }),

  setUploadedFiles: (files) => set({ uploadedFiles: files }),

  addFiles: (files) =>
    set((state) => ({ uploadedFiles: [...state.uploadedFiles, ...files] })),

  removeFile: (index) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((_, i) => i !== index),
    })),

  clearFiles: () => set({ uploadedFiles: [] }),

  startProcessing: () => set({ isProcessing: true, processingProgress: 0, isComplete: false }),

  setProcessingProgress: (progress) => set({ processingProgress: progress }),

  completeProcessing: () =>
    set({ isProcessing: false, isComplete: true, processingProgress: 100 }),

  resetTool: () =>
    set({
      uploadedFiles: [],
      processingProgress: 0,
      isProcessing: false,
      isComplete: false,
    }),
}));
