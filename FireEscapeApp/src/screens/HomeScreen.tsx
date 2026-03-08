import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  ActivityIndicator,
  Vibration,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSimulation } from '../hooks/useSimulation';
import { LocationService } from '../services/LocationService';

// Direction arrow mapping
const ARROWS: Record<string, string> = {
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  WAIT: '●', READY: '○', STOP: '✕', ESCAPED: '✓',
};

export const HomeScreen: React.FC = () => {
  const {
    snap, isReady,
    viewMode, toggleViewMode,
    triggerFire, restart,
  } = useSimulation();

  // Track initialization sequence
  const [initPhase, setInitPhase] = React.useState<'idle' | 'fire_detected' | 'calculating' | 'navigating'>('idle');
  const [showInitSequence, setShowInitSequence] = React.useState(false);

  // Initialize sequence when panic mode starts
  React.useEffect(() => {
    if (snap?.panicMode && !showInitSequence) {
      setShowInitSequence(true);
      setInitPhase('fire_detected');
      
      // Show "FIRE DETECTED" for 2 seconds
      setTimeout(() => {
        setInitPhase('calculating');
        
        // Show "CALCULATING BEST ROUTE" for 1.5 seconds
        setTimeout(() => {
          setInitPhase('navigating');
        }, 1500);
      }, 2000);
    }
  }, [snap?.panicMode]);

  // Reset init sequence when not in panic mode
  React.useEffect(() => {
    if (!snap?.panicMode) {
      setShowInitSequence(false);
      setInitPhase('idle');
    }
  }, [snap?.panicMode]);

  // Haptic feedback on direction change
  React.useEffect(() => {
    if (snap?.instruction && snap.instruction !== 'READY' && snap.instruction !== 'WAIT' && initPhase === 'navigating') {
      Vibration.vibrate(30);
    }
  }, [snap?.instruction, initPhase]);

  const handleSOS = () => {
    Alert.alert(
      'EMERGENCY ALERT',
      'Sending location to emergency services and building security.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'SEND SOS',
          style: 'destructive',
          onPress: async () => {
            Vibration.vibrate([100, 50, 100, 50, 100]);
            
            // Get GPS location
            const locationString = await LocationService.getLocationString();
            
            // Show confirmation notification
            setTimeout(() => {
              Alert.alert(
                '🆘 SOS SENT',
                `STAY RIGHT IN YOUR PLACE\n\nHelp is on the way.\n\n📍 Your Location:\n${locationString}\n\nEmergency services have been notified with your GPS coordinates.`,
                [
                  { 
                    text: 'OK',
                    onPress: () => {
                      Vibration.vibrate(50);
                    }
                  }
                ],
                { cancelable: false }
              );
            }, 500);
          }
        }
      ]
    );
  };

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>INITIALIZING IGNISGUARD</Text>
      </View>
    );
  }

  const instruction = snap?.instruction ?? 'READY';
  const distToTurn = snap?.distToTurn ?? 0;
  const nextAction = snap?.nextAction ?? '';
  const nextDirection = snap?.nextDirection ?? '';
  const nextDist = snap?.nextDist ?? 0;
  const distToExit = snap?.distToExit ?? 0;
  const steps = snap?.steps ?? 0;
  const panicMode = snap?.panicMode ?? false;
  const escaped = snap?.escaped ?? false;
  const trapped = snap?.trapped ?? false;

  // Determine what to show based on initialization phase
  const getDisplayInstruction = () => {
    if (escaped) return 'EVACUATED';
    if (trapped) return 'NO EXIT';
    if (initPhase === 'fire_detected') return '🔥 FIRE DETECTED';
    if (initPhase === 'calculating') return '⚙️ CALCULATING BEST ROUTE';
    if (instruction === 'READY') return 'STANDBY';
    if (instruction === 'WAIT') return 'HOLD';
    return instruction;
  };

  const getDisplayArrow = () => {
    if (escaped) return '✓';
    if (trapped) return '✕';
    if (initPhase === 'fire_detected') return '🔥';
    if (initPhase === 'calculating') return '⚙️';
    return ARROWS[instruction] ?? '?';
  };

  const getNextArrow = () => {
    if (!nextDirection) return '';
    return ARROWS[nextDirection] ?? '';
  };

  const hasNextDirection = initPhase === 'navigating' && !escaped && !trapped && nextDirection && nextAction !== 'Arrive' && nextAction !== 'Done';

  const arrow = getDisplayArrow();
  const displayInstruction = getDisplayInstruction();
  const isWarning = trapped || instruction === 'STOP';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>IGNISGUARD</Text>
          <Text style={styles.subBrand}>Emergency Evacuation System</Text>
        </View>
        <View style={[styles.statusIndicator, panicMode ? styles.statusAlert : styles.statusNormal]} />
      </View>

      {/* Navigation Display */}
      <View style={styles.navDisplay}>
        <View style={[styles.directionCard, isWarning && styles.warningCard]}>
          {/* Current Direction Section */}
          <Text style={styles.currentLabel}>CURRENT</Text>
          <Text style={[styles.arrow, isWarning && styles.warningArrow]}>
            {arrow}
          </Text>
          <Text style={[styles.directionText, isWarning && styles.warningText]}>
            {displayInstruction}
          </Text>
          {initPhase === 'navigating' && !escaped && !trapped && (
            <Text style={styles.currentDistance}>
              {Math.round(distToTurn)}m straight
            </Text>
          )}

          {/* Divider + Next Direction Section */}
          {hasNextDirection && (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.nextLabel}>NEXT UP</Text>
              <Text style={styles.nextArrow}>
                {getNextArrow()}
              </Text>
              <Text style={styles.nextDirectionText}>
                {nextDirection}
              </Text>
              <Text style={styles.nextDistance}>
                {nextDist}m straight
              </Text>
            </>
          )}

          {/* Show "ARRIVING" when no next direction */}
          {initPhase === 'navigating' && !escaped && !trapped && !hasNextDirection && (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.arrivingText}>ARRIVING AT EXIT</Text>
            </>
          )}
        </View>

        {/* Distance to exit */}
        {initPhase === 'navigating' && !escaped && !trapped && (
          <View style={styles.exitDistanceRow}>
            <Text style={styles.exitDistanceValue}>{Math.round(distToExit)}</Text>
            <Text style={styles.exitDistanceLabel}>METERS TO EXIT</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.fireButton]}
            onPress={() => triggerFire()}
            disabled={escaped}
          >
            <Text style={styles.actionIcon}>⚠</Text>
            <Text style={styles.actionLabel}>SIMULATE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={restart}
          >
            <Text style={styles.actionIcon}>↻</Text>
            <Text style={styles.actionLabel}>RESET</Text>
          </TouchableOpacity>
        </View>

        {/* Panic Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleSOS}
        >
          <Text style={styles.sosIcon}>🆘</Text>
          <Text style={styles.sosLabel}>PANIC — ALERT AUTHORITIES</Text>
          <Text style={styles.sosSub}>Send location & fire alert</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loading: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#d32f2f',
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d32f2f',
    letterSpacing: 3,
  },
  subBrand: {
    fontSize: 9,
    color: '#666',
    letterSpacing: 1,
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusNormal: {
    backgroundColor: '#4CAF50',
  },
  statusAlert: {
    backgroundColor: '#ff4444',
  },
  navDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  directionCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  warningCard: {
    borderColor: '#d32f2f',
    backgroundColor: '#2a1a1a',
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 3,
    marginBottom: 8,
  },
  arrow: {
    fontSize: 80,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 8,
  },
  warningArrow: {
    color: '#ff4444',
  },
  directionText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
    textAlign: 'center',
  },
  warningText: {
    color: '#ff4444',
  },
  currentDistance: {
    fontSize: 13,
    color: '#888',
    letterSpacing: 1,
    marginTop: 6,
  },
  sectionDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 16,
  },
  nextLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFC107',
    letterSpacing: 3,
    marginBottom: 6,
  },
  nextArrow: {
    fontSize: 44,
    fontWeight: '300',
    color: '#FFC107',
    marginBottom: 4,
  },
  nextDirectionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFC107',
    letterSpacing: 2,
  },
  nextDistance: {
    fontSize: 11,
    color: '#998a00',
    letterSpacing: 1,
    marginTop: 4,
  },
  arrivingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 2,
    paddingVertical: 8,
  },
  exitDistanceRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  exitDistanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  exitDistanceLabel: {
    fontSize: 9,
    color: '#666',
    letterSpacing: 2,
    marginTop: 2,
  },
  emergencyBox: {
    backgroundColor: '#141414',
    borderRadius: 8,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  emergencyTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  riskHigh: {
    backgroundColor: '#d32f2f',
  },
  riskClear: {
    backgroundColor: '#4CAF50',
  },
  riskText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  emergencyContent: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  alertValue: {
    color: '#ff4444',
  },
  okValue: {
    color: '#4CAF50',
  },
  telemetryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  telemetryItem: {
    alignItems: 'center',
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  telemetryLabel: {
    fontSize: 8,
    color: '#666',
    letterSpacing: 1,
    marginTop: 3,
  },
  alertText: {
    color: '#ff4444',
  },
  okText: {
    color: '#4CAF50',
  },
  actions: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sosButton: {
    backgroundColor: '#b71c1c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  sosIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  sosLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  sosSub: {
    fontSize: 10,
    color: '#ff8a80',
    letterSpacing: 1,
    marginTop: 3,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  fireButton: {
    borderColor: '#ff6f00',
  },
  resetButton: {
    borderColor: '#555',
  },
  actionIcon: {
    fontSize: 18,
    color: '#888',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  footerText: {
    fontSize: 8,
    color: '#444',
    letterSpacing: 1,
  },
});
