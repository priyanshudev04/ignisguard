import { io, Socket } from 'socket.io-client';
import { useSimulationStore } from '../store/simulationStore';
import { GridState, NavigationData, Telemetry } from '../types';

export interface SensorReading {
  sensor_id: number;
  position: [number, number];
  temperature: number;
  smoke_density: number;
  co_level: number;
  battery_level: number;
  is_alarm: boolean;
}

export interface SensorNetworkStatus {
  total_sensors: number;
  active_sensors: number;
  alarm_sensors: number;
  readings: SensorReading[];
}

const SERVER_URL = 'http://localhost:8000'; // Change to your backend URL

class SocketService {
  private socket: Socket | null = null;
  
  connect() {
    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
    });
    
    this.socket.on('connect', () => {
      console.log('Connected to simulation server');
      useSimulationStore.getState().setConnected(true);
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      useSimulationStore.getState().setConnected(false);
    });
    
    this.socket.on('grid_update', (data: GridState) => {
      useSimulationStore.getState().setGrid(data);
    });
    
    this.socket.on('navigation_update', (data: NavigationData) => {
      useSimulationStore.getState().setNavigation(data);
    });
    
    this.socket.on('telemetry_update', (data: Telemetry) => {
      useSimulationStore.getState().setTelemetry(data);
    });
    
    this.socket.on('sensor_update', (data: SensorNetworkStatus) => {
      useSimulationStore.getState().setSensors(data);
      
      console.log('🔥 Sensor Alert:', data.alarm_sensors, 'sensors in alarm');
      if (data.alarm_sensors > 0) {
        const worstSensor = data.readings.reduce((max, reading) => 
          reading.temperature > max.temperature ? reading : max, data.readings[0]
        );
        console.warn(`🚨 CRITICAL: Sensor ${worstSensor.sensor_id} - Temp: ${worstSensor.temperature}°C, Smoke: ${worstSensor.smoke_density}%, CO: ${worstSensor.co_level}ppm`);
      }
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  // Control commands
  move(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') {
    this.socket?.emit('manual_move', { direction });
  }
  
  setAutoPilot(enabled: boolean) {
    this.socket?.emit('set_autopilot', { enabled });
  }
  
  triggerFire(x?: number, y?: number) {
    this.socket?.emit('trigger_fire', { x, y });
  }
  
  restart() {
    this.socket?.emit('restart');
  }
  
  setViewMode(mode: 'architect' | 'user') {
    this.socket?.emit('set_view_mode', { mode });
  }
}

export const socketService = new SocketService();
