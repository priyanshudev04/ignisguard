import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
}

class LocationServiceClass {
  private static instance: LocationServiceClass;
  
  private constructor() {}
  
  static getInstance(): LocationServiceClass {
    if (!LocationServiceClass.instance) {
      LocationServiceClass.instance = new LocationServiceClass();
    }
    return LocationServiceClass.instance;
  }

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      // Check permission first
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        alert('Location permission required for emergency navigation');
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 0,
        altitude: location.coords.altitude ?? undefined,
        heading: location.coords.heading ?? undefined,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  async getLocationString(): Promise<string> {
    const location = await this.getCurrentLocation();
    if (!location) {
      return 'Location unavailable';
    }

    // Convert coordinates to readable format
    const lat = location.latitude.toFixed(6);
    const lng = location.longitude.toFixed(6);
    
    return `${lat}, ${lng}`;
  }

  async getMapUrl(): Promise<string> {
    const location = await this.getCurrentLocation();
    if (!location) {
      return '';
    }

    // Google Maps URL
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }
}

export const LocationService = LocationServiceClass.getInstance();
