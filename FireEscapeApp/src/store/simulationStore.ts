import { create } from 'zustand';
import { GridState, NavigationData, Telemetry, ViewMode } from '../types';
import { SensorNetworkStatus } from '../services/socketService';

interface SimulationState {
  // Connection state
  connected: boolean;
  
  // Simulation data
  grid: GridState | null;
  navigation: NavigationData | null;
  telemetry: Telemetry | null;
  sensors: SensorNetworkStatus | null;
  viewMode: ViewMode;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setGrid: (grid: GridState) => void;
  setNavigation: (navigation: NavigationData) => void;
  setTelemetry: (telemetry: Telemetry) => void;
  setSensors: (sensors: SensorNetworkStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  grid: null,
  navigation: null,
  telemetry: null,
  sensors: null,
  viewMode: 'user' as ViewMode,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  ...initialState,
  
  setConnected: (connected) => set({ connected }),
  
  setGrid: (grid) => set({ grid }),
  
  setNavigation: (navigation) => set({ navigation }),
  
  setTelemetry: (telemetry) => set({ telemetry }),
  
  setSensors: (sensors) => set({ sensors }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  reset: () => set(initialState),
}));
