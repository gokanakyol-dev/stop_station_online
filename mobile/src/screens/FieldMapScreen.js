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

// Light, minimal harita stili
const mapStyle = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  }
];

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
    
    // Projeksiyon hesapla
    if (skeleton) {
      try {
        const projectionData = projectToRoute(skeleton, latitude, longitude);
        
        // Projeksiyon hesaplanamadıysa bile devam et
        if (!projectionData || projectionData.lateral_offset === null || projectionData.lateral_offset === undefined) {
          Alert.alert(
            'Projeksiyon Hesaplanamadı',
            'Bu nokta rota dışında. Yine de durak olarak eklemek ister misiniz?',
            [
              { text: 'İptal', style: 'cancel' },
              { 
                text: 'Ekle', 
                onPress: () => {
                  setSelectedLocation({ lat: latitude, lon: longitude });
                  setShowAddModal(true);
                }
              }
            ]
          );
          return;
        }
        
        // Rotaya 500m'den uzaksa onay iste
        if (projectionData.lateral_offset > 500) {
          Alert.alert(
            'Projeksiyon Alanı Dışında',
            `Seçilen nokta rotaya ${projectionData.lateral_offset.toFixed(0)}m uzakta. Yine de eklemek istiyor musunuz?`,
            [
              { text: 'İptal', style: 'cancel' },
              { 
                text: 'Ekle', 
                onPress: () => {
                  setSelectedLocation({ lat: latitude, lon: longitude });
                  setShowAddModal(true);
                }
              }
            ]
          );
          return;
        }
        
        // 500m içindeyse direkt ekle
        setSelectedLocation({ lat: latitude, lon: longitude });
        setShowAddModal(true);
      } catch (error) {
        Alert.alert('Hata', 'Projeksiyon hesaplama hatası. Lütfen tekrar deneyin.');
        if (__DEV__) console.error('Projeksiyon hatası:', error);
      }
    } else {
      Alert.alert('Hata', 'Rota bilgisi yüklenmedi. Lütfen bekleyin.');
    }
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
        customMapStyle={mapStyle}
      >
        {/* Route çizgisi */}
        {getPolylineCoords().length > 0 && (
          <>
            {/* Projeksiyon koridoru - 100m buffer zone (gölgeli alan) */}
            <Polyline
              coordinates={getPolylineCoords()}
              strokeColor="rgba(16, 185, 129, 0.15)"
              strokeWidth={220}
              lineCap="round"
              lineJoin="round"
            />
            {/* Ana rota çizgisi */}
            <Polyline
              coordinates={getPolylineCoords()}
              strokeColor="#10B981"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
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
          <>
            {/* Accuracy circle */}
            <Circle
              center={{ latitude: userLocation.lat, longitude: userLocation.lon }}
              radius={20}
              fillColor="rgba(59, 130, 246, 0.1)"
              strokeColor="rgba(59, 130, 246, 0.3)"
              strokeWidth={2}
            />
            {/* Location marker */}
            <Marker
              coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }}
              title="Konumunuz"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userLocationMarker}>
                <View style={styles.userLocationInner} />
              </View>
            </Marker>
          </>
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

      {/* Üst bilgi paneli - Minimal */}
      <View style={styles.topPanel}>
        <TouchableOpacity 
          style={styles.backButtonCircle}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.routeInfoCard}>
          <View style={{flex: 1}}>
            <Text style={styles.routeInfo}>
              {routeNumber} - {routeName}
            </Text>
            {projection && userLocation && (
              <Text style={styles.routeName}>
                📍 {projection.route_s.toFixed(0)}m • {projection.lateral_offset.toFixed(0)}m mesafe
              </Text>
            )}
          </View>
          <View style={styles.directionBadge}>
            <Text style={styles.directionBadgeText}>
              {direction === 'gidis' ? '→' : '←'}
            </Text>
          </View>
        </View>
      </View>

      {/* Durak detay modal - Bottom Sheet */}
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

      {/* Yeni durak ekle butonu - Floating */}
      {!activeStop && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      )}

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
    flex: 1,
    backgroundColor: '#F9FAFB'
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
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 100
  },
  mapToggleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  topPanel: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  backButtonText: {
    fontSize: 20,
    color: '#1F2937',
    fontWeight: '700'
  },
  routeInfoCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  routeInfo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: 0.3
  },
  routeName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500'
  },
  directionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center'
  },
  directionBadgeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  proximityCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  proximityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  proximityIcon: {
    fontSize: 20
  },
  proximityLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  proximityValue: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '800',
    marginTop: 2
  },
  proximityDivider: {
    width: 1,
    backgroundColor: 'rgba(75, 85, 99, 0.5)',
    marginHorizontal: 12
  },
  userLocationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 4,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  userLocationInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6'
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
    top: 200,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    padding: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.3)'
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
    color: '#D1D5DB'
  },
  stopPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16
  },
  stopName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: 0.3
  },
  stopInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20
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
    bottom: 40,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '800',
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
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    letterSpacing: 0.3
  },
  locationInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#1F2937'
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
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  }
});
