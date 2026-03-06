"""
Test script to verify the enhanced sensor system works correctly.
Run this while the backend server is running.
"""

import asyncio
import socketio

async def test_sensor_system():
    sio = socketio.AsyncClient()
    
    @sio.event
    async def connect():
        print("✅ Connected to backend")
        
        # Trigger fire manually via socket
        await sio.emit('trigger_fire', {'x': 30, 'y': 30})
        print("🔥 Fire triggered at (30, 30)")
        
        # Wait for sensor updates
        await asyncio.sleep(2)
        
    @sio.event
    async def sensor_update(data):
        print(f"\n🚨 SENSOR ALERT RECEIVED!")
        print(f"Total Sensors: {data['total_sensors']}")
        print(f"Active Alarms: {data['alarm_sensors']}")
        
        if data['readings']:
            print(f"\nSample Readings:")
            for reading in data['readings'][:3]:
                print(f"  Sensor #{reading['sensor_id']}:")
                print(f"    Temp: {reading['temperature']}°C")
                print(f"    Smoke: {reading['smoke_density']}%")
                print(f"    CO: {reading['co_level']} ppm")
                print(f"    Alarm: {reading['is_alarm']}")
        
        # Disconnect after receiving data
        await asyncio.sleep(1)
        await sio.disconnect()
    
    @sio.event
    async def disconnect():
        print("\n❌ Disconnected")
    
    try:
        await sio.connect('http://localhost:8000')
        await sio.wait()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing Enhanced Sensor System...")
    print("=" * 50)
    asyncio.run(test_sensor_system())
