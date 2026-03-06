import asyncio
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from simulation import Simulation
from layout import LayoutManager

# ==========================================
# SOCKET.IO + FASTAPI SETUP
# ==========================================
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
)

app = FastAPI(title="SafeRoute Evac API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(sio, app)

# ==========================================
# SIMULATION INSTANCE
# ==========================================
sim: Simulation = Simulation(size=60, layout_mgr=LayoutManager())
auto_pilot_enabled = False
auto_pilot_task = None

# ==========================================
# HELPERS
# ==========================================
def get_grid_state() -> dict:
    nodes = []
    for y in range(sim.size):
        row = []
        for x in range(sim.size):
            node = sim.grid[(x, y)]
            is_exit = node in sim.goals
            node_type = 'EXIT' if is_exit else node.type
            row.append({
                "x": x,
                "y": y,
                "type": node_type,
                "visited": node.visited,
                "fireRisk": round(node.fire_risk, 2),
            })
        nodes.append(row)

    path = []
    if hasattr(sim, 'solver') and sim.solver:
        path_nodes = sim.solver.get_whole_path()
        path = [{"x": n.x, "y": n.y} for n in path_nodes]

    ghost_paths = []
    if hasattr(sim, 'ghost_paths'):
        ghost_paths = sim.ghost_paths

    pdr_x, pdr_y = sim.pdr_trace[-1] if sim.pdr_trace else (sim.start_node.x, sim.start_node.y)

    return {
        "size": sim.size,
        "nodes": nodes,
        "agentPosition": {"x": sim.start_node.x, "y": sim.start_node.y},
        "pdrPosition": {"x": round(pdr_x), "y": round(pdr_y)},
        "path": path,
        "ghostPaths": ghost_paths,
    }


def get_navigation_data() -> dict:
    dist = sim.solver.get_distance_to_exit() if not sim.escaped else 0
    return {
        "instruction": sim.instruction,
        "distance": sim.dist_to_turn,
        "nextAction": sim.next_action,
        "nextDistance": sim.next_dist,
        "distanceToExit": round(dist, 1),
    }


def get_telemetry() -> dict:
    return {
        "steps": sim.steps,
        "escaped": sim.escaped,
        "trapped": sim.trapped,
        "panicMode": sim.panic_mode,
        "casualties": sim.casualties,
        "windowUsage": sim.window_usage_count,
    }


async def broadcast_state():
    """Emits all state updates to connected clients."""
    await sio.emit('grid_update', get_grid_state())
    await sio.emit('navigation_update', get_navigation_data())
    await sio.emit('telemetry_update', get_telemetry())
    
    # Stream IoT sensor data (only if there are active readings)
    if hasattr(sim, 'sensor_readings_cache') and sim.sensor_readings_cache:
        sensor_status = sim.get_sensor_network_status()
        if sensor_status['alarm_sensors'] > 0:  # Only emit if there are alarms
            await sio.emit('sensor_update', sensor_status)


# ==========================================
# AUTO PILOT LOOP
# ==========================================
async def auto_pilot_loop():
    global auto_pilot_enabled
    while auto_pilot_enabled and not sim.escaped:
        sim.step(allow_fire=True)
        await broadcast_state()
        await asyncio.sleep(0.15)  # ~6fps updates


# ==========================================
# SOCKET.IO EVENTS
# ==========================================
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    # Send current state to newly connected client
    await broadcast_state()


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def manual_move(sid, data):
    direction = data.get('direction', '')
    direction_map = {
        'UP': (0, 1),
        'DOWN': (0, -1),
        'LEFT': (-1, 0),
        'RIGHT': (1, 0),
    }
    if direction in direction_map:
        sim.step(manual_move=direction_map[direction])
        await broadcast_state()


@sio.event
async def set_autopilot(sid, data):
    global auto_pilot_enabled, auto_pilot_task
    auto_pilot_enabled = data.get('enabled', False)
    
    if auto_pilot_enabled and (auto_pilot_task is None or auto_pilot_task.done()):
        auto_pilot_task = asyncio.create_task(auto_pilot_loop())
    elif not auto_pilot_enabled and auto_pilot_task:
        auto_pilot_task.cancel()
        auto_pilot_task = None


@sio.event
async def trigger_fire(sid, data):
    x = data.get('x')
    y = data.get('y')
    if x is not None and y is not None:
        sim.toggle_fire(target_pos=(x, y))
    else:
        sim.toggle_fire()
    await broadcast_state()


@sio.event
async def restart(sid, data=None):
    global sim, auto_pilot_enabled, auto_pilot_task
    auto_pilot_enabled = False
    if auto_pilot_task:
        auto_pilot_task.cancel()
        auto_pilot_task = None
    sim = Simulation(size=60, layout_mgr=LayoutManager())
    await broadcast_state()


@sio.event
async def set_view_mode(sid, data):
    # View mode is handled on the client side, just acknowledge
    pass


# ==========================================
# REST ENDPOINTS
# ==========================================
@app.get("/health")
def health():
    return {"status": "ok", "steps": sim.steps, "escaped": sim.escaped}


@app.get("/sensors")
def get_sensor_status():
    """Returns detailed IoT sensor network status."""
    if hasattr(sim, 'get_sensor_network_status'):
        return sim.get_sensor_network_status()
    return {"error": "Sensor system not available"}


@app.get("/pdr")
def get_pdr_data():
    """Returns PDR (Pedestrian Dead Reckoning) metrics."""
    if hasattr(sim, 'pdr'):
        return {
            'estimated_position': sim.pdr.get_error_metrics(),
            'trace': sim.pdr_trace[-20:] if sim.pdr_trace else []
        }
    return {"error": "PDR system not available"}


# ==========================================
# ASGI ENTRY POINT
# ==========================================
# Run with: uvicorn api:socket_app --host 0.0.0.0 --port 8000 --reload
