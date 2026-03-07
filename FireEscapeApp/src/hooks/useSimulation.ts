import { useRef, useState, useCallback, useEffect } from 'react';
import { SimulationEngine, NodeType } from '../engine/SimulationEngine';

export interface CellData {
  x: number;
  y: number;
  type: NodeType;
  visited: boolean;
  isGoal: boolean;
  isWindow: boolean;
}

export interface SimSnapshot {
  startNode: { x: number; y: number };
  pdr: { x: number; y: number };
  path: { x: number; y: number }[];
  ghostPaths: { x: number; y: number }[][];
  escaped: boolean;
  trapped: boolean;
  panicMode: boolean;
  steps: number;
  casualties: number;
  instruction: string;
  distToTurn: number;
  nextAction: string;
  nextDirection: string;
  nextDist: number;
  distToExit: number;
}

export function useSimulation() {
  const engineRef = useRef<SimulationEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grid stored separately (60x60 is large, only update on change)
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [viewMode, setViewMode] = useState<'architect' | 'user'>('user');
  const [isReady, setIsReady] = useState(false);
  const [navigationStarted, setNavigationStarted] = useState(false);

  // Initialize engine once - DON'T start auto-pilot yet
  useEffect(() => {
    const engine = new SimulationEngine(60);
    engineRef.current = engine;
    setGrid(engine.getGridSnapshot());
    setSnap(engine.getSnapshot());
    setIsReady(true);
    setNavigationStarted(false);

    // Don't start auto-pilot until fire is triggered
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (initDelayTimerRef.current) clearTimeout(initDelayTimerRef.current);
    };
  }, []);

  // Start navigation after initialization sequence (3.5 seconds total)
  const startNavigation = useCallback(() => {
    if (engineRef.current) {
      // Reset first - clear any existing timers and state
      if (timerRef.current) clearInterval(timerRef.current);
      if (initDelayTimerRef.current) clearTimeout(initDelayTimerRef.current);
      
      setNavigationStarted(true);
      
      // Wait for initialization sequence (2s fire + 1.5s calculating = 3.5s)
      initDelayTimerRef.current = setTimeout(() => {
        // REALISTIC WALKING SPEED: 1 step per second (normal human walking pace)
        timerRef.current = setInterval(() => {
          if (engineRef.current && !engineRef.current.state.escaped && !engineRef.current.state.trapped) {
            engineRef.current.step(undefined, true);
            setGrid(engineRef.current.getGridSnapshot());
            setSnap(engineRef.current.getSnapshot());
          }
        }, 1000); // 1000ms = realistic walking speed (was 150ms = superhuman!)
      }, 3500); // Wait for full init sequence
    }
  }, []);

  const refresh = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setGrid(engine.getGridSnapshot());
    setSnap(engine.getSnapshot());
  }, []);

  // Toggle view mode only
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'architect' ? 'user' : 'architect');
  }, []);

  // Trigger fire - this will start the initialization sequence
  const triggerFire = useCallback((tx?: number, ty?: number) => {
    // Always reset before triggering new fire
    if (timerRef.current) clearInterval(timerRef.current);
    if (initDelayTimerRef.current) clearTimeout(initDelayTimerRef.current);
    setNavigationStarted(false);
    
    engineRef.current?.triggerFire(tx, ty);
    refresh();
    // Start navigation after delay
    startNavigation();
  }, [refresh, startNavigation]);

  // Restart - resets and restarts auto-pilot automatically
  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (initDelayTimerRef.current) clearTimeout(initDelayTimerRef.current);
    
    engineRef.current = new SimulationEngine(60);
    setGrid(engineRef.current.getGridSnapshot());
    setSnap(engineRef.current.getSnapshot());
    setNavigationStarted(false);

    // Reset navigation state - wait for next fire trigger
    // Don't auto-start, wait for user to trigger fire again
  }, []);

  return {
    grid,
    snap,
    isReady,
    viewMode,
    setViewMode,
    toggleViewMode,
    triggerFire,
    restart,
  };
}
