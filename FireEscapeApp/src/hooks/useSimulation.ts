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
  nextDist: number;
  distToExit: number;
}

export function useSimulation() {
  const engineRef = useRef<SimulationEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Grid stored separately (60x60 is large, only update on change)
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [viewMode, setViewMode] = useState<'architect' | 'user'>('user');
  const [isReady, setIsReady] = useState(false);

  // Initialize engine once and START AUTO-PILOT IMMEDIATELY
  useEffect(() => {
    const engine = new SimulationEngine(60);
    engineRef.current = engine;
    setGrid(engine.getGridSnapshot());
    setSnap(engine.getSnapshot());
    setIsReady(true);

    // START AUTO-PILOT LOOP AUTOMATICALLY
    timerRef.current = setInterval(() => {
      if (engineRef.current && !engineRef.current.state.escaped && !engineRef.current.state.trapped) {
        engineRef.current.step(undefined, true); // auto-step with fire spread
        setGrid(engineRef.current.getGridSnapshot());
        setSnap(engineRef.current.getSnapshot());
      }
    }, 150);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

  // Trigger fire
  const triggerFire = useCallback((tx?: number, ty?: number) => {
    engineRef.current?.triggerFire(tx, ty);
    refresh();
  }, [refresh]);

  // Restart - resets and restarts auto-pilot automatically
  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    engineRef.current = new SimulationEngine(60);
    setGrid(engineRef.current.getGridSnapshot());
    setSnap(engineRef.current.getSnapshot());

    // Restart auto-pilot loop
    timerRef.current = setInterval(() => {
      if (engineRef.current && !engineRef.current.state.escaped && !engineRef.current.state.trapped) {
        engineRef.current.step(undefined, true);
        setGrid(engineRef.current.getGridSnapshot());
        setSnap(engineRef.current.getSnapshot());
      }
    }, 150);
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
