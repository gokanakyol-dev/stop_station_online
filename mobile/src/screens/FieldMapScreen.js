import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  getRouteWithDirection,
  approveStop,
  rejectStop,
  addStop
} from '../services/api';
import {
  buildRouteSkeleton,
  projectToRoute,
  getUpcomingStop,
  evaluateProximity,
  getPointAtRouteS
} from '../utils/routeProjection';

export default function FieldMapScreen({ route, navigation }) {
  const { routeId, routeNumber, routeName, direction } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [skeleton, setSkeleton] = useState(null);
  const [stops, setStops] = useState([]);
  
  const [userLocation, setUserLocation] = useState(null);
  const [projection, setProjection] = useState(null);
  const [upcomingStop, setUpcomingStop] = useState(null);
  const [warnings, setWarnings] = useState([]);
  
  const [activeStop, setActiveStop] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [locationError, setLocationError] = useState(null);
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    console.log('FieldMapScreen: useEffect başı');
    initializeMap();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const initializeMap = async () => {
    try {
      console.log('initializeMap: başlıyor', { routeId, direction });
      // Route verilerini önce yükle (konum izni olmasa da)
      const data = await getRouteWithDirection(routeId, direction);
      setRouteData(data.route);
      setStops(data.stops || []);

      // Skeleton oluştur
      if (data.route.polyline && data.route.polyline.length > 0) {
        const skel = buildRouteSkeleton(data.route.polyline);
        setSkeleton(skel);
      }

      setLoading(false);
      console.log('initializeMap: route yükleme tamam');

      // Şimdi konum izni iste
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('initializeMap: konum izni sonucu', status);
      if (status !== 'granted') {
        setLocationError('Konum izni verilmedi. Harita görüntülenebilir ama konum takibi yapılamaz.');
        return;
      }

      // GPS tracking başlat
      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 5
          },
          handleLocationUpdate
        );
        console.log('initializeMap: GPS tracking başlatıldı');
      } catch (locErr) {
        console.log('initializeMap: Location.watchPositionAsync HATASI', locErr);
        setLocationError('Konum takibi başlatılamadı: ' + locErr.message);
      }

      console.log('initializeMap: SONU');
    } catch (error) {
      console.log('initializeMap: HATA', error);
      Alert.alert('Hata', error.message);
      setLoading(false);
    }
  };

  const handleLocationUpdate = (location) => {
    const { latitude, longitude } = location.coords;
    setUserLocation({ lat: latitude, lon: longitude });

    if (!skeleton) return;

    // ADIM 2: ROUTE PROJECTION
    const proj = projectToRoute(
      { lat: latitude, lon: longitude },
      skeleton
    );

    if (proj) {
      setProjection(proj);

      // ADIM 3: SİSTEM BİLGİLENDİRİR
      // 3.1 İleride durak var mı?
      const upcoming = getUpcomingStop(proj.route_s, stops, 100);
      setUpcomingStop(upcoming);

      // 3.2 ve 3.3: Uyarıları değerlendir
      const evaluation = evaluateProximity(proj, {
        maxLateralOffset: 15,
        warningSide: null
      });
      setWarnings(evaluation.warnings);

      // Kamerayı takip et
      if (mapRef.current) {
        mapRef.current.animateCamera({
          center: { latitude, longitude },
          zoom: 17
        });
      }
    }
  };

  const handleApproveStop = async (stop) => {
    try {
      await approveStop(
        stop.id,
        routeId,
        direction,
        {
          lat: userLocation.lat,
          lon: userLocation.lon,
          route_s: projection.route_s,
          lateral_offset: projection.lateral_offset,
          side: projection.side
        }
      );

      // Durağı yeşil yap
      setStops(stops.map(s =>
        s.id === stop.id ? { ...s, field_verified: true } : s
      ));

      setActiveStop(null);
      Alert.alert('✅', 'Durak onaylandı');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  const handleRejectStop = async (stop, reason) => {
    try {
      await rejectStop(
        stop.id,
        routeId,
        direction,
        {
          lat: userLocation.lat,
          lon: userLocation.lon,
          route_s: projection.route_s,
          lateral_offset: projection.lateral_offset,
          side: projection.side
        },
        reason
      );

      // Durağı kırmızı yap
      setStops(stops.map(s =>
        s.id === stop.id ? { ...s, field_rejected: true } : s
      ));

      setActiveStop(null);
      Alert.alert('❌', 'Durak reddedildi');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  const handleAddStop = async () => {
    if (!newStopName.trim()) {
      Alert.alert('Uyarı', 'Durak adı giriniz');
      return;
    }

    try {
      const result = await addStop(
        routeId,
        direction,
        {
          lat: userLocation.lat,
          lon: userLocation.lon,
          route_s: projection.route_s,
          lateral_offset: projection.lateral_offset,
          side: projection.side
        },
        newStopName
      );

      if (result.stop) {
        setStops([...stops, result.stop]);
      }

      setShowAddModal(false);
      setNewStopName('');
      Alert.alert('✅', 'Yeni durak eklendi');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  if (loading || !routeData) {
    return (
      <View style={styles.centered}>
        <Text>Harita yükleniyor...</Text>
      </View>
    );
  }

  // İlk koordinatı bul (polyline veya durak)
  const getInitialRegion = () => {
    if (routeData.polyline && routeData.polyline.length > 0) {
      return {
        latitude: routeData.polyline[0].lat || routeData.polyline[0][0],
        longitude: routeData.polyline[0].lon || routeData.polyline[0][1],
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      };
    }
    if (stops.length > 0) {
      return {
        latitude: stops[0].lat,
        longitude: stops[0].lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      };
    }
    // Varsayılan (Trabzon)
    return {
      latitude: 41.0,
      longitude: 39.7,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05
    };
  };

  // Polyline koordinatlarını dönüştür
  const getPolylineCoords = () => {
    if (!routeData.polyline || routeData.polyline.length === 0) return [];
    return routeData.polyline.map(p => ({
      latitude: p.lat !== undefined ? p.lat : p[0],
      longitude: p.lon !== undefined ? p.lon : p[1]
    }));
  };

  return (
    <View style={styles.container}>
      {/* Konum hatası banner */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      {/* Harita */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
        followsUserLocation={!locationError}
      >
        {/* Route çizgisi */}
        {getPolylineCoords().length > 0 && (
          <Polyline
            coordinates={getPolylineCoords()}
            strokeColor="#007AFF"
            strokeWidth={4}
          />
        )}

        {/* Duraklar */}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat, longitude: stop.lon }}
            pinColor={
              stop.field_verified ? '#34C759' :
              stop.field_rejected ? '#FF3B30' :
              '#FFD60A'
            }
            onPress={() => setActiveStop(stop)}
          />
        ))}

        {/* Projeksiyon noktası */}
        {projection && (
          <Circle
            center={{
              latitude: projection.nearest_point.lat,
              longitude: projection.nearest_point.lon
            }}
            radius={5}
            fillColor="rgba(255, 0, 0, 0.5)"
            strokeColor="rgba(255, 0, 0, 0.8)"
          />
        )}
      </MapView>

      {/* Üst bilgi paneli */}
      <View style={styles.topPanel}>
        <Text style={styles.routeInfo}>
          {routeNumber} - {routeName}
        </Text>
        <Text style={styles.directionInfo}>
          {direction === 'gidis' ? '→ GİDİŞ' : '← DÖNÜŞ'}
        </Text>
      </View>

      {/* Uyarı paneli */}
      {(upcomingStop || warnings.length > 0) && (
        <View style={styles.warningPanel}>
          {upcomingStop && (
            <View style={styles.warningItem}>
              <Text style={styles.warningIcon}>📍</Text>
              <Text style={styles.warningText}>{upcomingStop.message}</Text>
            </View>
          )}
          {warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Text style={styles.warningIcon}>
                {warning.severity === 'warning' ? '⚠' : 'ℹ️'}
              </Text>
              <Text style={styles.warningText}>{warning.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Durak detay modal */}
      {activeStop && (
        <View style={styles.stopPanel}>
          <Text style={styles.stopName}>{activeStop.name}</Text>
          <Text style={styles.stopInfo}>
            Route S: {activeStop.route_s?.toFixed(1)} m
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApproveStop(activeStop)}
            >
              <Text style={styles.buttonText}>✓ ONAYLA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => {
                Alert.prompt(
                  'Durak Reddet',
                  'Neden?',
                  (reason) => handleRejectStop(activeStop, reason)
                );
              }}
            >
              <Text style={styles.buttonText}>✗ REDDET</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setActiveStop(null)}
          >
            <Text style={styles.closeButtonText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Yeni durak ekle butonu */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+ DURAK EKLE</Text>
      </TouchableOpacity>

      {/* Yeni durak modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Durak Ekle</Text>
            
            {projection && (
              <View style={styles.locationInfo}>
                <Text>Route S: {projection.route_s.toFixed(1)} m</Text>
                <Text>Uzaklık: {projection.lateral_offset.toFixed(1)} m</Text>
                <Text>Taraf: {projection.side === 'LEFT' ? 'SOL' : 'SAĞ'}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Durak adı..."
              value={newStopName}
              onChangeText={setNewStopName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewStopName('');
                }}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddStop}
              >
                <Text style={styles.modalButtonText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  map: {
    flex: 1
  },
  topPanel: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  routeInfo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  directionInfo: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 4
  },
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 12,
    zIndex: 100,
    elevation: 5
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center'
  },
  warningPanel: {
    position: 'absolute',
    top: 160,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    elevation: 4
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#333'
  },
  stopPanel: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  stopName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  stopInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  approveButton: {
    backgroundColor: '#34C759'
  },
  rejectButton: {
    backgroundColor: '#FF3B30'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF'
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 8
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16
  },
  locationInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: '#8E8E93'
  },
  confirmButton: {
    backgroundColor: '#007AFF'
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  }
});
