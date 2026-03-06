/**
 * Local JavaScript simulation engine - ported from Python backend.
 * Runs fully on-device, no server required.
 */

export type NodeType = 'EMPTY' | 'WALL' | 'FIRE' | 'SMOKE' | 'CROWD' | 'WINDOW' | 'EXIT' | 'RUBBLE';

export interface GridNode {
  x: number;
  y: number;
  type: NodeType;
  visited: boolean;
  fireRisk: number;
  crowdDensity: number;
  perceivedType: NodeType;
  perceivedCrowd: number;
  g: number;
  rhs: number;
  neighbors: GridNode[];
  isGoal: boolean;
  isWindow: boolean;
}

export interface SimState {
  grid: Map<string, GridNode>;
  nodesList: GridNode[];
  size: number;
  goals: GridNode[];
  windows: GridNode[];
  startNode: GridNode;
  fireFront: GridNode[];
  panicMode: boolean;
  escaped: boolean;
  trapped: boolean;
  steps: number;
  casualties: number;
  instruction: string;
  distToTurn: number;
  nextAction: string;
  nextDist: number;
  distToExit: number;
  path: { x: number; y: number }[];
  ghostPaths: { x: number; y: number }[][];
  pdrX: number;
  pdrY: number;
}

const key = (x: number, y: number) => `${x},${y}`;

function heuristic(a: GridNode, b: GridNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function edgeCost(u: GridNode, v: GridNode): number {
  if (
    u.perceivedType === 'FIRE' || u.perceivedType === 'WALL' || u.perceivedType === 'RUBBLE' ||
    v.perceivedType === 'FIRE' || v.perceivedType === 'WALL' || (v.perceivedType as string) === 'RUBBLE'
  ) return Infinity;
  let cost = 1.0;
  if (v.fireRisk > 0) cost += v.fireRisk;
  if (v.perceivedType === 'CROWD') cost += 10.0 * Math.pow(v.perceivedCrowd, 2);
  return cost;
}

export class SimulationEngine {
  state: SimState;
  private km = 0;
  private queue: [number, number, GridNode][] = []; // [k1, k2, node]
  private inQueue: Map<GridNode, [number, number]> = new Map();

  constructor(size = 60) {
    const grid = new Map<string, GridNode>();
    const nodesList: GridNode[] = [];

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const node: GridNode = {
          x, y, type: 'EMPTY', visited: false,
          fireRisk: 0, crowdDensity: 0,
          perceivedType: 'EMPTY', perceivedCrowd: 0,
          g: Infinity, rhs: Infinity,
          neighbors: [], isGoal: false, isWindow: false,
        };
        grid.set(key(x, y), node);
        nodesList.push(node);
      }
    }

    // Connect neighbors
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const n of nodesList) {
      for (const [dx, dy] of dirs) {
        const nb = grid.get(key(n.x + dx, n.y + dy));
        if (nb) n.neighbors.push(nb);
      }
    }

    const goals: GridNode[] = [];
    const windows: GridNode[] = [];

    // Build walls and exits from layout
    this._buildLayout(grid, size, goals, windows);

    // Perceived state init
    for (const n of nodesList) {
      n.perceivedType = n.type === 'WALL' ? 'WALL' : 'EMPTY';
    }
    for (const g of goals)   { g.perceivedType = 'EXIT';   }
    for (const w of windows) { w.perceivedType = 'WINDOW'; }

    // Pick random valid start
    const validSpawns = nodesList.filter(n =>
      n.type === 'EMPTY' && !n.isGoal && !n.isWindow &&
      n.x > 5 && n.x < size - 5 && n.y > 5 && n.y < size - 5
    );
    const startNode = validSpawns[Math.floor(Math.random() * validSpawns.length)];

    this.state = {
      grid, nodesList, size, goals, windows, startNode,
      fireFront: [], panicMode: false, escaped: false, trapped: false,
      steps: 0, casualties: 0,
      instruction: 'READY', distToTurn: 0, nextAction: 'Wait', nextDist: 0,
      distToExit: 0, path: [], ghostPaths: [],
      pdrX: startNode.x, pdrY: startNode.y,
    };

    this._dstarInit();
  }

  private _buildLayout(grid: Map<string, GridNode>, size: number, goals: GridNode[], windows: GridNode[]) {
    const wall = (x: number, y: number) => {
      const n = grid.get(key(x, y));
      if (n) { n.type = 'WALL'; n.perceivedType = 'WALL'; }
    };
    const drawWall = (x1: number, x2: number, y1: number, y2: number) => {
      for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++)
        for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++)
          wall(x, y);
    };
    const punchDoor = (x: number, y: number, width = 2, vertical = false) => {
      for (let i = 0; i < width; i++) {
        const n = vertical ? grid.get(key(x, y + i)) : grid.get(key(x + i, y));
        if (n) { n.type = 'EMPTY'; n.perceivedType = 'EMPTY'; }
      }
    };

    // Outer walls
    drawWall(0, size-1, 0, 0); drawWall(0, size-1, size-1, size-1);
    drawWall(0, 0, 0, size-1); drawWall(size-1, size-1, 0, size-1);

    // Inner walls (matching Python layout)
    drawWall(1, 25, 27, 27); drawWall(33, 58, 27, 27);
    drawWall(1, 25, 32, 32); drawWall(33, 58, 32, 32);
    drawWall(25, 25, 1, 27); drawWall(25, 25, 32, 58);
    drawWall(32, 32, 1, 27); drawWall(32, 32, 32, 58);
    drawWall(1, 25, 45, 45); punchDoor(25, 38, 2, true); punchDoor(25, 50, 2, true);
    drawWall(32, 58, 45, 45); drawWall(45, 45, 32, 58);
    punchDoor(32, 38, 2, true); punchDoor(32, 50, 2, true);
    punchDoor(38, 45, 2); punchDoor(50, 45, 2);
    drawWall(1, 12, 12, 12); drawWall(12, 12, 1, 12);
    punchDoor(25, 12, 2, true); punchDoor(6, 12, 2);
    drawWall(42, 42, 1, 27); drawWall(32, 42, 8, 8);
    drawWall(32, 42, 16, 16); drawWall(42, 58, 12, 12); drawWall(42, 58, 20, 20);
    punchDoor(42, 4, 2, true); punchDoor(42, 12, 2, true); punchDoor(42, 20, 2, true);
    punchDoor(42, 6, 2, true); punchDoor(42, 16, 2, true); punchDoor(42, 24, 2, true);
    punchDoor(32, 12, 2, true);

    // Exits
    const exitCoords = [
      [0,28],[0,29],[0,30],[0,31],
      [59,28],[59,29],[59,30],[59,31],
      [28,0],[29,0],[30,0],[31,0],
      [28,59],[29,59],[30,59],[31,59],
    ];
    for (const [ex, ey] of exitCoords) {
      const n = grid.get(key(ex, ey));
      if (n) { n.type = 'EXIT'; n.perceivedType = 'EXIT'; n.isGoal = true; goals.push(n); }
    }

    // Windows
    for (let i = 5; i < 55; i += 8) {
      if ([27,28,29,30,31,32].includes(i)) continue;
      for (const [wx, wy] of [[0,i],[59,i],[i,0],[i,59]]) {
        const n = grid.get(key(wx, wy));
        if (n && !n.isGoal) {
          n.type = 'WINDOW'; n.perceivedType = 'WINDOW'; n.isWindow = true;
          windows.push(n);
        }
      }
    }
  }

  // ---- D* Lite ----
  private _calcKey(u: GridNode): [number, number] {
    const m = Math.min(u.g, u.rhs);
    return [m + heuristic(u, this.state.startNode) + this.km, m];
  }

  private _updateVertex(u: GridNode) {
    if (u.g !== u.rhs) {
      const k = this._calcKey(u);
      this.queue.push([k[0], k[1], u]);
      this.queue.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
      this.inQueue.set(u, k);
    } else {
      this.inQueue.delete(u);
    }
  }

  private _computeShortestPath() {
    const { startNode, goals, windows } = this.state;
    let iters = 0;
    while (this.queue.length > 0 && iters++ < 50000) {
      const [k1, k2, u] = this.queue[0];
      const kq = this.inQueue.get(u);
      if (!kq || kq[0] !== k1 || kq[1] !== k2) { this.queue.shift(); continue; }

      const ks = this._calcKey(startNode);
      if (k1 > ks[0] || (k1 === ks[0] && k2 >= ks[1])) {
        if (startNode.rhs <= startNode.g) break;
      }

      this.queue.shift();
      this.inQueue.delete(u);
      const kNew = this._calcKey(u);

      if (k1 < kNew[0] || (k1 === kNew[0] && k2 < kNew[1])) {
        this.queue.push([kNew[0], kNew[1], u]);
        this.queue.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
        this.inQueue.set(u, kNew);
      } else if (u.g > u.rhs) {
        u.g = u.rhs;
        for (const s of u.neighbors) {
          if (s.perceivedType !== 'RUBBLE') {
            const c = edgeCost(s, u);
            if (c + u.g < s.rhs) s.rhs = c + u.g;
            this._updateVertex(s);
          }
        }
      } else {
        const gOld = u.g; u.g = Infinity;
        for (const s of [...u.neighbors, u]) {
          if (Math.abs(s.rhs - (edgeCost(s, u) + gOld)) < 1e-9) {
            s.rhs = Infinity;
            for (const sp of s.neighbors) {
              if (!['FIRE','WALL','RUBBLE'].includes(sp.perceivedType)) {
                const v = edgeCost(s, sp) + sp.g;
                if (v < s.rhs) s.rhs = v;
              }
            }
          }
          this._updateVertex(s);
        }
      }
    }
  }

  private _dstarInit() {
    const { goals, windows, nodesList } = this.state;
    this.km = 0; this.queue = []; this.inQueue = new Map();
    for (const n of nodesList) { n.g = Infinity; n.rhs = Infinity; }

    for (const t of [...goals, ...windows]) {
      if (!['FIRE','RUBBLE'].includes(t.perceivedType as string)) {
        t.rhs = t.isWindow ? 5000.0 : 0.0;
      }
      const k = this._calcKey(t);
      this.queue.push([k[0], k[1], t]);
      this.inQueue.set(t, k);
    }
    this.queue.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
    this._computeShortestPath();
  }

  private _getPath(): GridNode[] {
    const { startNode, goals, windows } = this.state;
    if (startNode.g === Infinity) return [];
    const path: GridNode[] = [startNode];
    let curr = startNode;
    const visited = new Set<GridNode>([curr]);

    for (let i = 0; i < 200; i++) {
      if (curr.isGoal || curr.isWindow) break;
      let best: GridNode | null = null; let minVal = Infinity;
      for (const n of curr.neighbors) {
        const c = edgeCost(curr, n);
        if (c === Infinity) continue;
        const v = c + n.g;
        if (v < minVal) { minVal = v; best = n; }
      }
      if (best && !visited.has(best)) {
        path.push(best); visited.add(best); curr = best;
      } else break;
    }
    return path;
  }

  private _getDistToExit(): number {
    return Math.max(0, this._getPath().length - 1);
  }

  private _snapshotPath() {
    const p = this._getPath();
    if (p.length > 1) {
      const coords = p.map(n => ({ x: n.x, y: n.y }));
      this.state.ghostPaths.push(coords);
      if (this.state.ghostPaths.length > 8) this.state.ghostPaths.shift();
    }
  }

  private _updateMap(changed: GridNode[]) {
    for (const u of changed) {
      if (['RUBBLE','WALL','FIRE'].includes(u.perceivedType as string)) {
        u.g = Infinity;
        if (!u.isGoal && !u.isWindow) u.rhs = Infinity;
      }
      for (const s of [...u.neighbors, u]) {
        if (!['RUBBLE','WALL','FIRE'].includes(s.perceivedType as string)) {
          s.rhs = Infinity;
          for (const sp of s.neighbors) {
            if (!['RUBBLE','WALL','FIRE'].includes(sp.perceivedType as string)) {
              const v = edgeCost(s, sp) + sp.g;
              if (v < s.rhs) s.rhs = v;
            }
          }
        }
        this._updateVertex(s);
      }
    }
    this._computeShortestPath();
  }

  private _checkLOS(target: GridNode): boolean {
    const { startNode, grid } = this.state;
    const x0 = startNode.x, y0 = startNode.y;
    const x1 = target.x, y1 = target.y;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist > 15) return false;
    const steps = Math.floor(dist);
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = Math.round(x0 + t * (x1 - x0));
      const cy = Math.round(y0 + t * (y1 - y0));
      const n = grid.get(key(cx, cy));
      if (n && n.type === 'WALL') return false;
    }
    return true;
  }

  private _spreadFire(allowRandom = true) {
    const { nodesList, startNode, goals, fireFront } = this.state;
    if (allowRandom && Math.random() < (this.state.panicMode ? 0.05 : 0.15)) {
      const rx = 1 + Math.floor(Math.random() * (this.state.size - 2));
      const ry = 1 + Math.floor(Math.random() * (this.state.size - 2));
      const s = this.state.grid.get(key(rx, ry));
      if (s && s.type === 'EMPTY' && s !== startNode) {
        s.type = 'FIRE'; fireFront.push(s);
      }
    }

    const newFire: GridNode[] = [];
    for (const f of fireFront) {
      for (const n of f.neighbors) {
        if (n.type !== 'FIRE' && n.type !== 'WALL' && !n.isGoal) {
          if (Math.random() < 0.35) {
            n.type = 'FIRE'; newFire.push(n);
          } else if (Math.random() < 0.5 && n.type === 'EMPTY') {
            n.type = 'SMOKE';
          }
        }
      }
    }
    fireFront.push(...newFire);
    if (fireFront.length > 0) this.state.panicMode = true;
  }

  private _processVision() {
    const { nodesList } = this.state;
    const updates: GridNode[] = [];
    for (const n of nodesList) {
      if (this._checkLOS(n)) {
        n.visited = true;
        const actual = n.type === 'CROWD' ? 'EMPTY' : n.type;
        if (n.perceivedType !== actual) {
          n.perceivedType = actual as NodeType;
          updates.push(n);
        }
      }
    }
    if (updates.length > 0) {
      this._snapshotPath();
      this._updateMap(updates);
    }
  }

  private _moveAgent() {
    const { startNode } = this.state;
    if (startNode.rhs === Infinity) return null;
    let best: GridNode | null = null; let minC = Infinity;
    for (const n of startNode.neighbors) {
      const c = edgeCost(startNode, n);
      if (c === Infinity) continue;
      const val = c + n.g;
      if (val < minC) { minC = val; best = n; }
    }
    if (best && minC !== Infinity) {
      this.km += heuristic(best, startNode);
      this.state.startNode = best;
      return best;
    }
    return null;
  }

  private _getNavData() {
    const path = this._getPath();
    if (path.length < 2) return { instruction: 'ARRIVED', dist: 0, nextAction: 'Done', nextDist: 0 };

    const p0 = path[0], p1 = path[1];
    const vec1 = { x: p1.x - p0.x, y: p1.y - p0.y };

    const dirName = (v: {x:number,y:number}) => {
      if (v.x === 0 && v.y === 1)  return 'UP';
      if (v.x === 0 && v.y === -1) return 'DOWN';
      if (v.x === 1 && v.y === 0)  return 'RIGHT';
      if (v.x === -1 && v.y === 0) return 'LEFT';
      return 'WAIT';
    };

    const curDir = dirName(vec1);
    let curDist = 0; let pivotIdx = -1;

    for (let i = 0; i < path.length - 1; i++) {
      const vt = { x: path[i+1].x - path[i].x, y: path[i+1].y - path[i].y };
      if (vt.x === vec1.x && vt.y === vec1.y) { curDist++; pivotIdx = i + 1; }
      else break;
    }

    let nextAction = 'Arrive'; let nextDist = 0;
    if (pivotIdx >= 0 && pivotIdx < path.length - 1) {
      const pPivot = path[pivotIdx], pNext = path[pivotIdx + 1];
      const vec2 = { x: pNext.x - pPivot.x, y: pNext.y - pPivot.y };
      const cross = vec1.x * vec2.y - vec1.y * vec2.x;
      if (cross > 0) nextAction = 'Turn LEFT';
      else if (cross < 0) nextAction = 'Turn RIGHT';
      for (let i = pivotIdx; i < path.length - 1; i++) {
        const vt = { x: path[i+1].x - path[i].x, y: path[i+1].y - path[i].y };
        if (vt.x === vec2.x && vt.y === vec2.y) nextDist++;
        else break;
      }
    }
    return { instruction: curDir, dist: curDist, nextAction, nextDist };
  }

  // ---- PUBLIC API ----

  step(manualMove?: { dx: number; dy: number }, allowFire = false) {
    const s = this.state;
    if (s.escaped) return;

    // Check escape
    if (s.startNode.isGoal || s.startNode.isWindow) {
      s.escaped = true; s.instruction = 'ESCAPED'; return;
    }

    if (s.steps % 5 === 0) this._snapshotPath();

    if (allowFire) this._spreadFire(true);
    this._processVision();

    // Update path
    const pathNodes = this._getPath();
    s.path = pathNodes.map(n => ({ x: n.x, y: n.y }));
    s.distToExit = this._getDistToExit();

    if (manualMove) {
      const nx = s.startNode.x + manualMove.dx;
      const ny = s.startNode.y + manualMove.dy;
      const next = s.grid.get(key(nx, ny));
      if (next && next.type !== 'WALL') {
        this.km += heuristic(next, s.startNode);
        s.startNode = next;
      }
    } else if (s.panicMode) {
      const next = this._moveAgent();
      if (next) {
        const nav = this._getNavData();
        s.instruction = nav.instruction;
        s.distToTurn = nav.dist;
        s.nextAction = nav.nextAction;
        s.nextDist = nav.nextDist;
      } else {
        s.trapped = true; s.instruction = 'STOP!';
      }
    }

    // PDR (simple noisy estimate)
    const noise = () => (Math.random() - 0.5) * 0.4;
    s.pdrX = s.startNode.x + noise();
    s.pdrY = s.startNode.y + noise();

    s.steps++;
  }

  triggerFire(tx?: number, ty?: number) {
    const s = this.state;
    let f: GridNode | undefined;
    if (tx !== undefined && ty !== undefined) {
      f = s.grid.get(key(tx, ty));
      if (f && f.type === 'WALL') f = undefined;
    } else {
      const valid = s.nodesList.filter(n => n.type === 'EMPTY' && n !== s.startNode);
      f = valid[Math.floor(Math.random() * valid.length)];
    }
    if (f) {
      f.type = 'FIRE'; s.fireFront.push(f);
      s.panicMode = true;
    }
  }

  restart() {
    Object.assign(this, new SimulationEngine(this.state.size));
  }

  getSnapshot() {
    const s = this.state;
    return {
      size: s.size,
      startNode: { x: s.startNode.x, y: s.startNode.y },
      pdr: { x: Math.round(s.pdrX), y: Math.round(s.pdrY) },
      path: s.path,
      ghostPaths: s.ghostPaths,
      escaped: s.escaped,
      trapped: s.trapped,
      panicMode: s.panicMode,
      steps: s.steps,
      casualties: s.casualties,
      instruction: s.instruction,
      distToTurn: s.distToTurn,
      nextAction: s.nextAction,
      nextDist: s.nextDist,
      distToExit: s.distToExit,
    };
  }

  getGridSnapshot(): { x: number; y: number; type: NodeType; visited: boolean; isGoal: boolean; isWindow: boolean }[][] {
    const s = this.state;
    const rows = [];
    for (let y = 0; y < s.size; y++) {
      const row = [];
      for (let x = 0; x < s.size; x++) {
        const n = s.grid.get(key(x, y))!;
        row.push({ x, y, type: n.type, visited: n.visited, isGoal: n.isGoal, isWindow: n.isWindow });
      }
      rows.push(row);
    }
    return rows;
  }
}
