import math
import random
from typing import List, Dict, Tuple

class PDRSystem:
    def __init__(self, start_x, start_y, step_len=1.0):
        self.est_x = start_x
        self.est_y = start_y
        self.heading = 0.0 # 0 = East
        self.step_length = step_len
        
        # Sensor Noise Parameters
        self.gyro_bias = 0.02 
        self.accel_noise = 0.1
        self.step_count = 0
        
        # Error accumulation for realism
        self.heading_drift = 0.0

    def simulate_hardware_reading(self, true_curr, true_next):
        """Generates noisy sensor data based on actual movement."""
        dx = true_next.x - true_curr.x
        dy = true_next.y - true_curr.y
        
        # Ideal Heading
        target_angle = math.atan2(dy, dx)
        
        # Simulate Gyro: Change in angle + Noise + Drift
        gyro_z = (target_angle - self.heading) + random.gauss(0, self.gyro_bias)
        self.heading_drift += random.gauss(0, 0.005)  # Accumulated drift
        gyro_z += self.heading_drift
        
        # Simulate Accel: Spike if moving, Gravity (0.98) if still
        is_moving = (dx != 0 or dy != 0)
        if is_moving:
            self.step_count += 1
            accel_mag = (1.5 + random.gauss(0, self.accel_noise))
        else:
            accel_mag = 0.98 + random.gauss(0, self.accel_noise)
        
        return accel_mag, gyro_z

    def update_estimate(self, accel, gyro_z):
        """Integrates raw sensor data to get position."""
        # 1. Integrate Gyro to get Heading
        self.heading += gyro_z
        
        # 2. Threshold Accel to detect Step
        if accel > 1.2: # Step Threshold
            # Move in direction of heading with step length variation
            actual_step = self.step_length * random.uniform(0.95, 1.05)
            self.est_x += actual_step * math.cos(self.heading)
            self.est_y += actual_step * math.sin(self.heading)
            
        return self.est_x, self.est_y
    
    def get_error_metrics(self) -> Dict[str, float]:
        """Returns current PDR error statistics."""
        return {
            'step_count': self.step_count,
            'heading_drift': self.heading_drift,
            'estimated_position': (self.est_x, self.est_y)
        }


class IoTSensor:
    """Individual IoT sensor node with unique ID and characteristics."""
    
    def __init__(self, x: int, y: int, sensor_id: int):
        self.x = x
        self.y = y
        self.sensor_id = sensor_id
        self.temperature = 25.0  # Celsius (baseline)
        self.smoke_density = 0.0  # 0-100%
        self.co_level = 0.0  # Carbon monoxide ppm
        self.battery_level = 100.0
        self.is_active = True
        
        # Sensor degradation parameters
        self.calibration_drift = random.uniform(-0.02, 0.02)
        self.sensitivity = random.uniform(0.9, 1.1)
        
    def take_reading(self, nearby_fires: List, distance_threshold: float = 5.0) -> Dict:
        """
        Takes environmental readings based on proximity to fires.
        Returns sensor data dictionary.
        """
        if not self.is_active:
            return {'error': 'Sensor inactive'}
        
        # Base readings with small noise
        base_temp = 25.0 + random.gauss(0, 0.5)
        base_smoke = 0.0 + random.gauss(0, 0.5)
        base_co = 0.0 + random.gauss(0, 0.3)
        
        # Add effects from nearby fires
        for fire in nearby_fires:
            distance = math.hypot(fire.x - self.x, fire.y - self.y)
            if distance <= distance_threshold:
                # Temperature increases exponentially as fire gets closer
                temp_effect = 150.0 / (distance + 1)
                self.temperature += temp_effect
                
                # Smoke density based on distance
                smoke_effect = 80.0 / (distance + 1)
                self.smoke_density = min(100.0, self.smoke_density + smoke_effect)
                
                # CO levels spike near fire
                co_effect = 500.0 / (distance + 1)
                self.co_level = min(1000.0, self.co_level + co_effect)
        
        # Apply sensor characteristics
        self.temperature = self.temperature * self.sensitivity + self.calibration_drift
        self.smoke_density = max(0, min(100, self.smoke_density * self.sensitivity))
        self.co_level = max(0, min(1000, self.co_level * self.sensitivity))
        
        # Battery drain
        self.battery_level = max(0, self.battery_level - 0.001)
        
        return {
            'sensor_id': self.sensor_id,
            'position': (self.x, self.y),
            'temperature': round(self.temperature, 2),
            'smoke_density': round(self.smoke_density, 2),
            'co_level': round(self.co_level, 2),
            'battery_level': round(self.battery_level, 2),
            'is_alarm': self.temperature > 60 or self.smoke_density > 40 or self.co_level > 200
        }
    
    def reset_environmental(self):
        """Reset environmental readings (called when simulation restarts)."""
        self.temperature = 25.0
        self.smoke_density = 0.0
        self.co_level = 0.0
        self.battery_level = 100.0


class NavigationFeedback:
    def __init__(self):
        self.last_instruction = None
        self.haptic_pattern_map = {
            'LEFT': {'pattern': '[Short-Short]', 'intensity': 'medium', 'audio': 'Left turn ahead'},
            'RIGHT': {'pattern': '[Long]', 'intensity': 'medium', 'audio': 'Right turn ahead'},
            'UP': {'pattern': '[Single]', 'intensity': 'light', 'audio': 'Move forward'},
            'DOWN': {'pattern': '[Continuous]', 'intensity': 'strong', 'audio': 'Turn back'},
            'WAIT': {'pattern': '[Double Pulse]', 'intensity': 'medium', 'audio': 'Wait'},
            'SAFE': {'pattern': '[Confirmation]', 'intensity': 'light', 'audio': 'Safe zone'},
            'STOP!': {'pattern': '[INTENSE PULSE]', 'intensity': 'maximum', 'audio': 'DANGER STOP'},
            'ESCAPED': {'pattern': '[Success Melody]', 'intensity': 'celebratory', 'audio': 'You made it!'}
        }

    def trigger(self, instruction: str) -> str:
        """Simulates Haptic vibration and Audio cues."""
        if instruction == self.last_instruction:
            return ""
        
        self.last_instruction = instruction
        pattern_info = self.haptic_pattern_map.get(instruction, {'pattern': '[Unknown]', 'intensity': 'none', 'audio': ''})
        
        haptic_feedback = f"📳 VIB: {pattern_info['pattern']} ({instruction})"
        audio_feedback = f"🔊 AUDIO: '{pattern_info['audio']}'" if pattern_info['audio'] else ""
        
        return f"{haptic_feedback} {audio_feedback}".strip()
    
    def get_emergency_alert(self, danger_type: str) -> str:
        """Returns emergency alert patterns for specific dangers."""
        alerts = {
            'FIRE_NEARBY': "🚨 EMERGENCY: [Rapid Vibration] - Fire detected nearby!",
            'SMOKE_DETECTED': "⚠️ WARNING: [Pulsing Vibration] - Smoke in area!",
            'HIGH_CO': "☠️ DANGER: [Continuous Strong Vibration] - Toxic air!",
            'CROWD_DANGER': "👥 ALERT: [Irregular Pattern] - Heavy crowd detected!"
        }
        return alerts.get(danger_type, "⚠️ Unknown danger")

class NavigationFeedback:
    def __init__(self):
        self.last_instruction = None

    def trigger(self, instruction):
        """Simulates Haptic vibration and Audio cues."""
        if instruction == self.last_instruction:
            return ""
        self.last_instruction = instruction
        
        if instruction == "LEFT":
            return "📳 VIB: [Short-Short] (Left)"
        elif instruction == "RIGHT":
            return "📳 VIB: [Long] (Right)"
        elif instruction == "DOWN":
            return "📳 VIB: [Continuous] (Back)"
        elif instruction == "STOP!":
            return "🚨 HAPTIC: [INTENSE PULSE]"
        return ""