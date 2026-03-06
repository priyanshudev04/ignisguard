export interface Node {
  x: number;
  y: number;
  type: 'EMPTY' | 'WALL' | 'FIRE' | 'SMOKE' | 'CROWD' | 'WINDOW' | 'EXIT';
  visited: boolean;
  fireRisk: number;
}

export interface GridState {
  size: number;
  nodes: Node[][];
  agentPosition: { x: number; y: number };
  pdrPosition: { x: number; y: number };
  path: { x: number; y: number }[];
  ghostPaths: { x: number; y: number }[][];
}

export interface NavigationData {
  instruction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'WAIT' | 'SAFE' | 'STOP!' | 'ESCAPED';
  distance: number;
  nextAction: string;
  nextDistance: number;
  distanceToExit: number;
}

export interface Telemetry {
  steps: number;
  escaped: boolean;
  trapped: boolean;
  panicMode: boolean;
  casualties: number;
  windowUsage: number;
}

export type ViewMode = 'architect' | 'user';
