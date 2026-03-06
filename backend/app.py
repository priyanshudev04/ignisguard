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
    .secondary-action {
        font-size: 1.2rem;
        color: #FFC107;
        margin-top: 5px;
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
    # Add this in app.py, right under "st.header("🎛️ Control Panel")"

    st.subheader("Upload Custom Layout")
    uploaded_plan = st.file_uploader("Upload SmartDraw PNG", type=["png", "jpg"])
    
    if uploaded_plan is not None:
        if st.button("Generate Map from Image"):
            # Create a fresh simulation and feed it the image
            st.session_state.sim = Simulation(size=60, layout_mgr=None)
            st.session_state.sim.generate_from_image(uploaded_plan)
            # Re-initialize the D* Lite solver with the new targets
            st.session_state.sim.solver.initialize()
            st.rerun()
            
    view_mode = st.radio("👁️ View Mode", ["Architect View (Simulation)", "User View (App)"])

    st.subheader("Timing")
    sim_speed = st.slider("Step Delay (sec)", min_value=0.01, max_value=1.0, value=0.1, step=0.05, 
                          help="Lower is faster. Controls 'Auto-Pilot' speed.")

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
    
    # --- UPGRADE: FIRE TOGGLE ---
    enable_fire_gen = st.checkbox("Enable Random Fire Events", value=False, 
                                  help="If unchecked, fire only starts if you manually ignite it.")
    
    st.error("HAZARD CONTROL")
    with st.expander("🔥 Arsonist Mode (Manual Fire)", expanded=True):
        st.write("Target Coordinates:")
        c_x, c_y = st.columns(2)
        with c_x:
            tgt_x = st.number_input("X", min_value=0, max_value=59, value=30)
        with c_y:
            tgt_y = st.number_input("Y", min_value=0, max_value=59, value=30)
            
        if st.button("🔥 IGNITE TARGET"):
            success = sim.toggle_fire(target_pos=(tgt_x, tgt_y))
            if success:
                st.toast(f"Fire started at ({tgt_x}, {tgt_y})", icon="🔥")
            else:
                st.toast("Invalid Target (Wall or Bounds)", icon="❌")

    if st.button("🎲 RANDOM FIRE"):
        sim.toggle_fire()
        st.toast("Random Alarm Triggered", icon="🔥")
        
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
    
    instruction = sim.instruction
    arrow_icon = {
        "UP": "⬆️", "DOWN": "⬇️", "LEFT": "⬅️", "RIGHT": "➡️", 
        "WAIT": "🛑", "SAFE": "✅", "STOP!": "⚠️", "ESCAPED": "🏃"
    }.get(instruction, "❓")
    
    next_step_html = ""
    if hasattr(sim, 'next_action') and sim.next_action != "Arrive" and instruction not in ["SAFE", "ESCAPED", "WAIT"]:
        next_step_html = f"<div class='secondary-action'>Then {sim.next_action} for {sim.next_dist}m</div>"

    st.markdown(f"""
    <div class='status-box'>
        <div style='font-size: 60px;'>{arrow_icon}</div>
        <div style='font-size: 24px; font-weight: bold;'>Go {instruction} {sim.dist_to_turn}m</div>
        {next_step_html}
    </div>
    """, unsafe_allow_html=True)
    
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
    C_SMOKE = [0.5, 0.5, 0.5]
    
    for y in range(sim.size):
        for x in range(sim.size):
            node = sim.grid[(x,y)]
            if node.type == 'WALL': grid_colors[y, x] = C_WALL
            elif node.type == 'FIRE': grid_colors[y, x] = C_FIRE
            elif node.type == 'SMOKE': grid_colors[y, x] = C_SMOKE
            elif node.type == 'CROWD': grid_colors[y, x] = C_CROWD
            elif node.type == 'WINDOW': grid_colors[y, x] = C_WINDOW
            elif node in sim.goals: grid_colors[y, x] = C_EXIT
            else: grid_colors[y, x] = C_FLOOR
            
            # Fog of War
            if view_mode == "User View (App)":
                if not node.visited:
                     grid_colors[y, x] = [0.0, 0.0, 0.0]
            else:
                if not node.visited:
                    grid_colors[y, x] = [c * 0.4 for c in grid_colors[y, x]]

    ax.imshow(grid_colors, origin='lower')
    
    # Ghost Paths (Magenta Dotted Lines)
    if hasattr(sim, 'ghost_paths'):
        for i, g_path in enumerate(sim.ghost_paths):
            if g_path:
                gpx = [p[0] for p in g_path]
                gpy = [p[1] for p in g_path]
                alpha = 0.2 + (i * 0.1) 
                ax.plot(gpx, gpy, color='magenta', linewidth=1.5, linestyle=':', alpha=alpha)

    # Dynamic Path Visualization (Cyan Line)
    if hasattr(sim.solver, 'get_whole_path'):
        full_path = sim.solver.get_whole_path()
        if full_path:
            px = [n.x for n in full_path]
            py = [n.y for n in full_path]
            ax.plot(px, py, color='cyan', linewidth=2.5, linestyle='--', label="Optimal Path")

    ax.set_xticks(np.arange(0, sim.size, 5))
    ax.set_yticks(np.arange(0, sim.size, 5))
    ax.tick_params(axis='both', colors='white', labelsize=8)
    ax.grid(color='white', linestyle=':', linewidth=0.3, alpha=0.3) 

    if view_mode == "Architect View (Simulation)" and hasattr(sim, 'sensors'):
        sensor_x = [s.x for s in sim.sensors]
        sensor_y = [s.y for s in sim.sensors]
        ax.scatter(sensor_x, sensor_y, c='gold', s=10, marker='.', alpha=0.5, label="IoT Sensors")

    ax.scatter(sim.start_node.x, sim.start_node.y, c='blue', s=150, edgecolors='white', zorder=10, label="Real Pos")
    
    if sim.pdr_trace:
        px, py = sim.pdr_trace[-1]
        ax.scatter(px, py, c='red', marker='x', s=120, linewidth=3, zorder=11, label="PDR Est.")
    
    title_mode = "ARCHITECT VIEW" if view_mode == "Architect View (Simulation)" else "USER APP MODE"
    ax.set_title(f"{title_mode} | Step: {st.session_state.step_count}", color='white', fontsize=10)
    
    if view_mode == "Architect View (Simulation)":
        ax.legend(loc='upper right', fontsize='small', framealpha=0.9)
        
    st.pyplot(fig)

# Auto-Run Logic (Updated)
if run_auto and not sim.escaped:
    # PASS THE CHECKBOX VALUE HERE
    sim.step(allow_fire=enable_fire_gen) 
    st.session_state.step_count += 1
    time.sleep(sim_speed)
    st.rerun()