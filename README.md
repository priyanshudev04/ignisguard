# 🔥 IgnisGuard - Fire Escape Simulation System

## Overview
IgnisGuard is an advanced fire evacuation simulation system that combines real-time pathfinding, IoT sensor networks, and mobile navigation to guide people to safety during emergencies.

## Features

### 🚀 Core Capabilities
- **Real-time Fire Simulation** - Dynamic fire spread modeling with environmental factors
- **D* Lite Pathfinding Algorithm** - Adaptive route calculation that responds to changing conditions
- **IoT Sensor Network** - 172+ smart sensors monitoring temperature, smoke, CO levels, and battery status
- **PDR Navigation** - Pedestrian Dead Reckoning for GPS-denied environments
- **Haptic Feedback** - Multi-pattern vibration alerts for navigation guidance
- **Emergency SOS** - One-touch Mayday with GPS location sharing
- **Crowd Simulation** - Panic behavior modeling with app-guided vs unguided agents
- **Dual View Modes** - Architect (simulation) and User (mobile app) interfaces

### 📱 Mobile App (React Native + Expo)
- Turn-by-turn emergency navigation
- Real-time hazard alerts
- SOS/Mayday emergency button
- Live telemetry dashboard
- Offline-capable PDR tracking

### 🖥️ Backend (Python + FastAPI)
- WebSocket real-time updates (~6fps)
- RESTful API endpoints
- Streamlit architect interface
- Multi-parameter sensor fusion
- Dynamic risk calculation

## Project Structure

```
ignisguard/
├── FireEscapeApp/          # React Native mobile application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── engine/         # Simulation engine
│   │   ├── hooks/          # React hooks
│   │   ├── screens/        # App screens
│   │   ├── services/       # Socket & Location services
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript interfaces
│   ├── assets/             # Images and icons
│   └── package.json
├── backend/                # Python simulation backend
│   ├── api.py             # FastAPI + Socket.IO server
│   ├── app.py             # Streamlit UI (Architect view)
│   ├── simulation.py      # Core simulation engine
│   ├── sensors.py         # IoT sensors + PDR + Haptics
│   ├── algorithm.py       # D* Lite pathfinding
│   ├── layout.py          # Floor plan persistence
│   └── floor_plan_offline.json
└── README.md
```

## Tech Stack

### Frontend
- **React Native** with TypeScript
- **Expo SDK 55**
- **Zustand** for state management
- **Socket.IO Client** for real-time updates
- **expo-location** for GPS integration

### Backend
- **Python 3.14+**
- **FastAPI** REST API
- **Socket.IO** WebSocket server
- **Streamlit** for visualization
- **NumPy** for numerical computation
- **Matplotlib** for rendering
- **Pillow** for image processing

## Installation

### Prerequisites
- Node.js 18+ and npm
- Python 3.14 or higher
- Expo Go app (for mobile testing)

### Backend Setup

```bash
cd backend
pip install fastapi uvicorn python-socketio pillow numpy matplotlib streamlit pandas pyarrow
python -m uvicorn api:socket_app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

```bash
cd FireEscapeApp
npm install
npm start
```

Then scan the QR code with Expo Go app or press `w` for web browser.

## Usage

### Starting the System

1. **Start Backend Server:**
```bash
cd backend
python -m uvicorn api:socket_app --host 0.0.0.0 --port 8000 --reload
```

2. **Start Mobile App:**
```bash
cd FireEscapeApp
npm start
```

3. **Access Options:**
   - Press `w` in terminal for web browser
   - Scan QR code with Expo Go app for mobile
   - Press `a` for Android emulator

### Features Demo

#### Mobile App Interface
- **Navigation Display**: Large arrow showing direction with distance
- **Emergency Box**: Real-time hazard status and risk level
- **SOS Button**: Emergency location sharing
- **Telemetry Strip**: Steps, mode, and status indicators

#### Architect Interface (Streamlit)
- Upload custom floor plans (PNG images)
- Manual fire ignition control
- Auto-pilot simulation mode
- Sensor network visualization
- PDR trace tracking

## Algorithm Details

### D* Lite Pathfinding
The system uses an incremental heuristic search algorithm that:
- Maintains a "mental map" of perceived vs actual terrain
- Updates paths dynamically as new hazards are detected
- Considers multiple cost factors:
  - Physical obstacles (walls, fire, rubble)
  - Sensor-detected heat signatures
  - Crowd density penalties
  - Window vs exit hierarchy (5000 cost penalty)

### IoT Sensor Network
Each of the 172 sensors provides:
- **Temperature** (°C) - Alarm threshold: >60°C
- **Smoke Density** (0-100%) - Alarm threshold: >40%
- **CO Level** (ppm) - Alarm threshold: >200ppm
- **Battery Status** - Degradation tracking
- **Unique ID** - Individual sensor identification

### PDR System
Simulates realistic navigation errors:
- Gyroscope bias and drift accumulation
- Accelerometer noise for step detection
- Variable step length (±5% randomness)
- Heading error metrics tracking

## API Endpoints

### WebSocket Events
- `grid_update` - Simulation grid state
- `navigation_update` - Turn-by-turn instructions
- `telemetry_update` - Steps, escaped, panic mode
- `sensor_update` - IoT sensor readings (when alarms active)

### REST Endpoints
- `GET /health` - Server health check
- `GET /sensors` - Detailed sensor network status
- `GET /pdr` - PDR metrics and trace data

## Performance Metrics

| Metric | Value |
|--------|-------|
| Sensor Coverage | 1 per 21 cells (19% improvement) |
| Update Rate | ~6fps (150ms intervals) |
| Path Recalculation | Dynamic (on sensor detection) |
| Grid Size | 60×60 (3600 cells) |
| Sensor Parameters | 4 (temp, smoke, CO, battery) |

## Testing Commands

### Test IoT Sensor:
```bash
cd backend
python -c "from sensors import IoTSensor; s = IoTSensor(5,5,1); print(s.take_reading([]))"
```

### Test PDR System:
```bash
python -c "from sensors import PDRSystem; p = PDRSystem(0,0); print(p.get_error_metrics())"
```

### Test Full Simulation:
```bash
python -c "from simulation import Simulation; from layout import LayoutManager; sim = Simulation(60, LayoutManager()); print(f'Sensors: {len(sim.iot_sensors)}'); print(sim.get_sensor_network_status())"
```

## Development

### Code Quality
- TypeScript strict mode enabled
- Python type hints throughout
- Comprehensive error handling
- Real-time validation

### Running Tests
(Tests to be implemented)

## Contributing

This is a research project focused on emergency evacuation systems. Key areas for enhancement:
- Mesh networking between IoT sensors
- Room-aware sensor placement
- Machine learning for fire prediction
- Multi-agent coordination
- Building information modeling (BIM) integration

## License

This project is provided as-is for educational and research purposes.

## Acknowledgments

Built with modern web technologies and emergency response best practices to save lives during fire emergencies.

---

**⚠️ IMPORTANT**: This is a simulation system for research and training purposes. Always follow local fire safety regulations and building codes in real-world implementations.
