import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [mapSize, setMapSize] = useState('full'); // 'full' or 'minimized'
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    initializeMap();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const initializeMap = async () => {
    try {
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

      // Şimdi konum izni iste
      const { status } = await Location.requestForegroundPermissionsAsync();
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
      } catch (locErr) {
        setLocationError('Konum takibi başlatılamadı: ' + locErr.message);
      }
    } catch (error) {
      Alert.alert('Hata', error.message);
      setLoading(false);
    }
  };

  const handleLocationUpdate = useCallback((location) => {
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
  }, [skeleton, stops]);

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

    // Use selected location or user location
    const locationToUse = selectedLocation || userLocation;
    if (!locationToUse) {
      Alert.alert('Hata', 'Konum bilgisi bulunamadı');
      return;
    }

    // Calculate projection if not available
    let projectionData = projection;
    if (!projectionData && skeleton && locationToUse) {
      projectionData = projectToRoute(skeleton, locationToUse.lat, locationToUse.lon);
    }

    if (!projectionData || projectionData.route_s === null || projectionData.route_s === undefined) {
      Alert.alert('Hata', 'Rota üzerinde projeksiyon hesaplanamadı. Lütfen rotaya daha yakın olun.');
      return;
    }

    try {
      const result = await addStop(
        routeId,
        direction,
        {
          lat: locationToUse.lat,
          lon: locationToUse.lon,
          route_s: projectionData.route_s,
          lateral_offset: projectionData.lateral_offset,
          side: projectionData.side
        },
        newStopName
      );

      if (result.stop) {
        setStops([...stops, result.stop]);
      }

      setShowAddModal(false);
      setNewStopName('');
      setSelectedLocation(null);
      Alert.alert('✅', 'Yeni durak eklendi');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ lat: latitude, lon: longitude });
    setShowAddModal(true);
  };

  const toggleMapSize = () => {
    setMapSize(prev => prev === 'full' ? 'minimized' : 'full');
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
        style={mapSize === 'full' ? styles.map : styles.mapMinimized}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={false}
        onPress={handleMapPress}
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

        {/* Kullanıcı konumu - Büyük mavi marker */}
        {userLocation && (
          <Marker
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }}
            title="Konumunuz"
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationInner} />
            </View>
          </Marker>
        )}

        {/* Seçilen konum - Yeni durak eklenecek yer */}
        {selectedLocation && (
          <Marker
            coordinate={{ latitude: selectedLocation.lat, longitude: selectedLocation.lon }}
            pinColor="#2563EB"
            title="Yeni Durak"
          />
        )}
      </MapView>

      {/* Harita büyüt/küçült butonu */}
      <TouchableOpacity style={styles.mapToggleButton} onPress={toggleMapSize}>
        <Text style={styles.mapToggleText}>
          {mapSize === 'full' ? '▼ Küçült' : '▲ Büyüt'}
        </Text>
      </TouchableOpacity>

      {/* Üst bilgi paneli */}
      <View style={styles.topPanel}>
        <Text style={styles.routeInfo}>
          {routeNumber} - {routeName}
        </Text>
        <Text style={styles.directionInfo}>
          {direction === 'gidis' ? '→ GİDİŞ' : '← DÖNÜŞ'}
        </Text>
        
        {/* Proximity indicator */}
        {projection && userLocation && (
          <View style={styles.proximityIndicator}>
            <Text style={styles.proximityText}>
              📍 Rotada: {projection.route_s.toFixed(0)}m | Mesafe: {projection.lateral_offset.toFixed(0)}m
            </Text>
          </View>
        )}
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
            
            {selectedLocation && (
              <View style={styles.locationInfo}>
                <Text style={{fontWeight: 'bold', marginBottom: 4}}>📍 Seçilen Konum:</Text>
                <Text>Enlem: {selectedLocation.lat.toFixed(6)}</Text>
                <Text>Boylam: {selectedLocation.lon.toFixed(6)}</Text>
              </View>
            )}
            
            {projection && (
              <View style={styles.locationInfo}>
                <Text style={{fontWeight: 'bold', marginBottom: 4}}>📊 Rota Bilgisi:</Text>
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
  mapMinimized: {
    height: 300
  },
  mapToggleButton: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 100
  },
  mapToggleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  topPanel: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  routeInfo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5
  },
  directionInfo: {
    fontSize: 16,
    color: '#2563EB',
    marginTop: 4,
    fontWeight: '600'
  },
  proximityIndicator: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  proximityText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  userLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    borderWidth: 3,
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userLocationInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB'
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
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    padding: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8
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
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  stopName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    letterSpacing: 0.3
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  approveButton: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6
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
    backgroundColor: '#2563EB',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8
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
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
    letterSpacing: 0.3
  },
  locationInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#1E293B'
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
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  }
});
