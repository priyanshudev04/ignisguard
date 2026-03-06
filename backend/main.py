import streamlit as st
import matplotlib.pyplot as plt
import numpy as np
import time
from simulation import Simulation
from sensors import NavigationFeedback
from layout import LayoutManager

# ==========================================
# PAGE CONFIGURATION
# ==========================================
st.set_page_config(
    page_title="SafeRoute Evac System",
    page_icon="🔥",
    layout="wide"
)

st.markdown("""
<style>
    .stApp { background-color: #121212; color: #ffffff; }
    div[data-testid="stMetricValue"] { font-size: 2.2rem; color: #4CAF50; font-family: monospace; }
    .status-box {
        border: 1px solid #333;
        background-color: #1e1e1e;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        margin-bottom: 10px;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# SESSION STATE
# ==========================================
if 'sim' not in st.session_state:
    layout_mgr = LayoutManager()
    st.session_state.sim = Simulation(size=60, layout_mgr=layout_mgr)
    st.session_state.step_count = 0
    st.session_state.feedback = NavigationFeedback()

sim = st.session_state.sim
feedback = st.session_state.feedback

# ==========================================
# SIDEBAR
# ==========================================
with st.sidebar:
    st.header("🎛️ Control Panel")
    
    st.subheader("Manual Override")
    c1, c2, c3 = st.columns([1,1,1])
    with c2: 
        if st.button("⬆️"): sim.step(manual_move=(0, 1))
    c4, c5, c6 = st.columns([1,1,1])
    with c4: 
        if st.button("⬅️"): sim.step(manual_move=(-1, 0))
    with c5: 
        if st.button("⬇️"): sim.step(manual_move=(0, -1))
    with c6: 
        if st.button("➡️"): sim.step(manual_move=(1, 0))

    st.subheader("Simulation Control")
    run_auto = st.checkbox("Engage Auto-Pilot", value=False)
    
    st.error("HAZARD CONTROL")
    if st.button("🔥 TRIGGER ALARM"):
        sim.toggle_fire()
        st.toast("ALARM TRIGGERED", icon="🔥")
        
    if st.button("🔄 RESTART"):
        st.session_state.sim = Simulation(size=60, layout_mgr=LayoutManager())
        st.rerun()

# ==========================================
# MAIN DISPLAY
# ==========================================
col_map, col_info = st.columns([3, 1])

with col_info:
    st.markdown("### 📡 Telemetry")
    dist = sim.solver.get_distance_to_exit() if not sim.escaped else 0
    st.metric("Dist. to Exit", f"{dist:.1f} m")
    
    instruction = sim.app_instruction
    arrow_icon = {
        "UP": "⬆️", "DOWN": "⬇️", "LEFT": "⬅️", "RIGHT": "➡️", 
        "WAIT": "🛑", "SAFE": "✅", "STOP!": "⚠️", "ESCAPED": "🏃"
    }.get(instruction, "❓")
    
    st.markdown(f"""
    <div class='status-box'>
        <div style='font-size: 60px;'>{arrow_icon}</div>
        <div style='font-size: 24px; font-weight: bold;'>{instruction}</div>
    </div>
    """, unsafe_allow_html=True)
    
    # Generate Haptic Text
    haptic_msg = feedback.trigger(instruction)
    st.markdown("### 📳 Device Output")
    st.text_area("Haptic Log", value=haptic_msg if haptic_msg else "Standby...", height=80, disabled=True)

    if sim.panic_mode:
        st.error("EVACUATE IMMEDIATELY")

with col_map:
    # MATPLOTLIB RENDERING
    fig, ax = plt.subplots(figsize=(10, 10), facecolor='#121212')
    ax.set_facecolor('#121212')
    
    # Build RGB Grid
    grid_colors = np.zeros((sim.size, sim.size, 3))
    
    # Colors
    C_WALL = [0.2, 0.2, 0.2]
    C_FLOOR = [0.95, 0.95, 0.95]
    C_FIRE = [1.0, 0.2, 0.0]
    C_EXIT = [0.0, 0.8, 0.0]
    C_WINDOW = [0.0, 0.6, 1.0]
    C_CROWD = [1.0, 0.8, 0.0]
    
    for y in range(sim.size):
        for x in range(sim.size):
            node = sim.grid[(x,y)]
            if node.type == 'WALL': grid_colors[y, x] = C_WALL
            elif node.type == 'FIRE': grid_colors[y, x] = C_FIRE
            elif node.type == 'CROWD': grid_colors[y, x] = C_CROWD
            elif node.type == 'WINDOW': grid_colors[y, x] = C_WINDOW
            elif node in sim.goals: grid_colors[y, x] = C_EXIT
            else: grid_colors[y, x] = C_FLOOR
            
            # Fog of War (Darken unexplored areas)
            if not node.visited:
                grid_colors[y, x] = [c * 0.5 for c in grid_colors[y, x]]

    ax.imshow(grid_colors, origin='lower')
    
    # --- VISUALIZATION ADDITIONS ---
    
    # 1. DRAW SENSORS (Gold Dots)
    if hasattr(sim, 'sensors'):
        sensor_x = [s.x for s in sim.sensors]
        sensor_y = [s.y for s in sim.sensors]
        ax.scatter(sensor_x, sensor_y, c='gold', s=10, marker='.', alpha=0.5, label="IoT Sensors")

    # 2. Real Position (GPS)
    ax.scatter(sim.start_node.x, sim.start_node.y, c='blue', s=150, edgecolors='white', zorder=10, label="Real Pos")
    
    # 3. PDR Estimated Position (Red X)
    if sim.pdr_trace:
        px, py = sim.pdr_trace[-1]
        ax.scatter(px, py, c='red', marker='x', s=120, linewidth=3, zorder=11, label="PDR Est.")
    
    ax.legend(loc='upper right', fontsize='small', framealpha=0.9)
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(f"Step: {st.session_state.step_count}", color='white')
    
    st.pyplot(fig)

# Auto-Run Logic
if run_auto and not sim.escaped:
    sim.step()
    st.session_state.step_count += 1
    time.sleep(0.1)
    st.rerun()