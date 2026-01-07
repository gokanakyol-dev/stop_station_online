// FieldMapScreen - Modern Design v2.1 UPDATED
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ToastAndroid,
  Platform
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  getRouteWithDirection,
  approveStop,
  rejectStop,
  addStop,
  getOfflineQueueSize,
  syncOfflineQueue
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
  const [selectedProjection, setSelectedProjection] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [stopToReject, setStopToReject] = useState(null);
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    console.log('[FieldMapScreen] 🚀 Component mounted - v1.2.2');
    initializeMap();
    checkQueue();
    const queueCheckInterval = setInterval(checkQueue, 5000); // Her 5 saniyede kontrol
    const syncInterval = setInterval(() => {
      console.log('[FieldMapScreen] ⏰ 30sn interval triggered');
      syncQueue();
    }, 30000); // Her 30 saniyede otomatik senkronizasyon
    
    return () => {
      console.log('[FieldMapScreen] 🛑 Component unmounting');
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      clearInterval(queueCheckInterval);
      clearInterval(syncInterval);
    };
  }, []);

  const checkQueue = async () => {
    const size = await getOfflineQueueSize();
    setQueueSize(size);
  };

  // Toast mesajı göster
  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      // iOS için Alert kullan
      Alert.alert('', message);
    }
  };

  const syncQueue = async () => {
    const size = await getOfflineQueueSize();
    if (size === 0) {
      console.log('[syncQueue] Queue boş');
      return;
    }

    // İnternet kontrolü
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.log('[syncQueue] İnternet yok, senkronizasyon ertelendi');
        return;
      }
    } catch (e) {
      console.log('[syncQueue] NetInfo hatası, devam ediliyor');
    }

    console.log('[syncQueue] 🔄 Otomatik senkronizasyon başlıyor...', size, 'öğe');
    showToast('🔄 Senkronize ediliyor...');
    
    try {
      const result = await syncOfflineQueue();
      
      if (result.synced > 0) {
        showToast(`✅ ${result.synced} işlem gönderildi`);
        
        // Queue size'ı güncelle
        await checkQueue();
        
        // Durakları yeniden yükle (güncel veri için)
        try {
          const data = await getRouteWithDirection(routeId, direction);
          setStops(data.stops || []);
        } catch (e) {
          console.log('[syncQueue] Durak yenileme hatası:', e);
        }
      } else if (result.failed > 0) {
        showToast(`⚠️ ${result.failed} işlem başarısız`);
      }
      
      console.log('[syncQueue] Sonuç:', result);
    } catch (error) {
      console.error('[syncQueue] Hata:', error);
    }
  };

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
    const { latitude, longitude, accuracy } = location.coords;
    setUserLocation({ lat: latitude, lon: longitude });
    setGpsAccuracy(accuracy);

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
    console.log('[handleApproveStop] Start', { stopId: stop?.id, userLocation });
    try {
      let currentLocation = userLocation;
      
      // Eğer userLocation yoksa, anlık konum almayı dene (zorunlu değil)
      if (!currentLocation) {
        console.log('[handleApproveStop] No userLocation, trying to get current position...');
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 5000
          });
          currentLocation = {
            lat: location.coords.latitude,
            lon: location.coords.longitude
          };
          console.log('[handleApproveStop] Got current position:', currentLocation);
        } catch (locError) {
          console.warn('[handleApproveStop] Location not available, continuing without GPS:', locError.message);
          // GPS olmadan devam et
        }
      }

      // Konum bilgisi varsa ekle, yoksa null gönder
      const locationData = currentLocation ? {
        lat: currentLocation.lat,
        lon: currentLocation.lon
      } : null;

      // Projeksiyon varsa ve locationData varsa ekle
      if (locationData && projection) {
        locationData.route_s = projection.route_s;
        locationData.lateral_offset = projection.lateral_offset;
        locationData.side = projection.side;
      }

      // ✅ Optimistic update - UI'yi HEMEN güncelle
      setStops(stops.map(s =>
        s.id === stop.id ? { ...s, field_verified: true, field_rejected: false } : s
      ));
      if (upcomingStop?.id === stop.id) {
        setUpcomingStop({ ...upcomingStop, field_verified: true, field_rejected: false });
      }
      setActiveStop(null);

      // API çağrısını arka planda yap (beklemeden)
      console.log('[handleApproveStop] API call başlatılıyor...');
      approveStop(stop.id, routeId, direction, locationData)
        .then(result => {
          console.log('[handleApproveStop] API result', result);
          if (result.offline) {
            showToast('⌛ Kuyrukta - offline');
          } else {
            showToast('✅ Onaylandı');
          }
          checkQueue();
        })
        .catch(err => {
          console.error('[handleApproveStop] Error', err);
          showToast('❌ Hata: ' + err.message);
        });
    } catch (error) {
      console.error('[handleApproveStop] Error', error);
      Alert.alert('Hata', error.message);
    }
  };

  const handleRejectStop = async (stop, reason) => {
    console.log('[handleRejectStop] Start', { stopId: stop?.id, reason });
    try {
      let currentLocation = userLocation;
      
      // Eğer userLocation yoksa, anlık konum almayı dene (zorunlu değil)
      if (!currentLocation) {
        console.log('[handleRejectStop] No userLocation, trying to get current position...');
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 5000
          });
          currentLocation = {
            lat: location.coords.latitude,
            lon: location.coords.longitude
          };
          console.log('[handleRejectStop] Got current position:', currentLocation);
        } catch (locError) {
          console.warn('[handleRejectStop] Location not available, continuing without GPS:', locError.message);
          // GPS olmadan devam et
        }
      }

      // Konum bilgisi varsa ekle, yoksa null gönder
      const locationData = currentLocation ? {
        lat: currentLocation.lat,
        lon: currentLocation.lon
      } : null;

      // Projeksiyon varsa ve locationData varsa ekle
      if (locationData && projection) {
        locationData.route_s = projection.route_s;
        locationData.lateral_offset = projection.lateral_offset;
        locationData.side = projection.side;
      }

      // ✅ Optimistic update - UI'yi HEMEN güncelle
      setStops(stops.map(s =>
        s.id === stop.id ? { ...s, field_rejected: true, field_verified: false } : s
      ));
      if (upcomingStop?.id === stop.id) {
        setUpcomingStop({ ...upcomingStop, field_rejected: true, field_verified: false });
      }
      setActiveStop(null);
      setShowRejectModal(false);
      setRejectReason('');
      setStopToReject(null);

      // API çağrısını arka planda yap (beklemeden)
      console.log('[handleRejectStop] API call başlatılıyor...');
      rejectStop(stop.id, routeId, direction, locationData, reason || 'Sebep belirtilmedi')
        .then(result => {
          console.log('[handleRejectStop] API result', result);
          if (result.offline) {
            showToast('⌛ Kuyrukta - offline');
          } else {
            showToast('❌ Reddedildi');
          }
          checkQueue();
        })
        .catch(err => {
          console.error('[handleRejectStop] Error', err);
          showToast('❌ Hata: ' + err.message);
        });
    } catch (error) {
      console.error('[handleRejectStop] Error', error);
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

    // Use selectedProjection or calculate new one
    let projectionData = selectedProjection || projection;
    if (!projectionData && skeleton && locationToUse) {
      projectionData = projectToRoute({ lat: locationToUse.lat, lon: locationToUse.lon }, skeleton);
    }

    // Projeksiyon yoksa veya geçersizse, null değerlerle ekle
    const stopData = {
      lat: locationToUse.lat,
      lon: locationToUse.lon,
      route_s: projectionData?.route_s ?? null,
      lateral_offset: projectionData?.lateral_offset ?? null,
      side: projectionData?.side ?? null
    };

    try {
      console.log('[handleAddStop] Sending API call', { routeId, direction, stopData, name: newStopName });
      const result = await addStop(
        routeId,
        direction,
        stopData,
        newStopName
      );
      console.log('[handleAddStop] API result', result);

      if (result.offline) {
        Alert.alert('⏳ Offline', 'Yeni durak kuyrukta. İnternet bağlantısında veritabanına eklenecek.');
      } else if (result.stop) {
        setStops([...stops, result.stop]);
        Alert.alert('✅', 'Yeni durak veritabanına eklendi');
      } else {
        Alert.alert('✅', 'Yeni durak eklendi');
      }

      setShowAddModal(false);
      setNewStopName('');
      setSelectedLocation(null);
      setSelectedProjection(null);
    } catch (error) {
      console.error('[handleAddStop] Error', error);
      Alert.alert('Hata', error.message);
    }
  };

  const handleMapPress = (e) => {
    try {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      
      console.log('handleMapPress called:', { latitude, longitude });
      console.log('skeleton exists:', !!skeleton, skeleton ? skeleton.length : 0);
      
      // Skeleton yoksa doğrudan modal aç
      if (!skeleton || skeleton.length < 2) {
        console.log('No skeleton, opening modal directly');
        setSelectedLocation({ lat: latitude, lon: longitude });
        setSelectedProjection(null);
        setShowAddModal(true);
        return;
      }
      
      // Projeksiyon hesapla
      let projectionData = null;
      try {
        projectionData = projectToRoute({ lat: latitude, lon: longitude }, skeleton);
        console.log('Projection result:', projectionData);
      } catch (projErr) {
        console.error('Projection calculation error:', projErr);
        // Projeksiyon hatası olsa bile devam et
      }
      
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
                setSelectedProjection(null);
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
                setSelectedProjection(projectionData);
                setShowAddModal(true);
              }
            }
          ]
        );
        return;
      }
      
      // 500m içindeyse direkt ekle
      setSelectedLocation({ lat: latitude, lon: longitude });
      setSelectedProjection(projectionData);
      setShowAddModal(true);
    } catch (error) {
      console.error('handleMapPress error:', error);
      Alert.alert('Hata', 'Bir hata oluştu. Lütfen tekrar deneyin.');
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
      {/* Basit Üst Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.topBarCenter}>
          <Text style={styles.routeNum}>{routeNumber}</Text>
          <Text style={styles.routeTitle}>{routeName}</Text>
        </View>
        
        <View style={styles.dirBadge}>
          <Text style={styles.dirText}>{direction === 'gidis' ? '→' : '←'}</Text>
        </View>
      </View>

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
              stop.field_verified ? '#34C759' :  // ✅ Yeşil - Onaylanmış
              stop.field_rejected ? '#9CA3AF' :  // ⚫ Gri - Reddedilmiş (pasif)
              '#FFD60A'                          // 🟡 Sarı - Bekliyor
            }
            opacity={stop.field_rejected ? 0.5 : 1.0} // Reddedilenler %50 şeffaf
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

      {/* Yakın Durak Kartı - Alt kısım */}
      {upcomingStop && !activeStop && (
        <View style={styles.nearbyStopCard}>
          <View style={styles.stopCardHeader}>
            <Text style={styles.stopCardLabel}>YAKIN DURAK</Text>
            {upcomingStop.distance && (
              <Text style={styles.stopDistance}>{upcomingStop.distance.toFixed(0)}m</Text>
            )}
          </View>
          
          <Text style={styles.stopCardName} numberOfLines={2}>{upcomingStop.name || 'İsimsiz Durak'}</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleApproveStop(upcomingStop)}
            >
              <Text style={styles.approveBtnText}>✓ ONAYLA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => {
                setStopToReject(upcomingStop);
                setShowRejectModal(true);
              }}
            >
              <Text style={styles.rejectBtnText}>✗ REDDET</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Durak Detay Modal */}
      {activeStop && (
        <View style={styles.nearbyStopCard}>
          <View style={styles.stopCardHeader}>
            <Text style={styles.stopCardLabel}>DURAK DETAY</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setActiveStop(null)}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.stopCardName} numberOfLines={2}>{activeStop.name || 'İsimsiz Durak'}</Text>
          <View style={styles.stopInfoRow}>
            {activeStop.route_s != null && (
              <Text style={styles.stopCardInfo}>Route S: {activeStop.route_s?.toFixed(0)}m</Text>
            )}
            {activeStop.id != null && (
              <Text style={styles.stopIdBadge}>#{activeStop.id}</Text>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleApproveStop(activeStop)}
            >
              <Text style={styles.approveBtnText}>✓ ONAYLA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => {
                setStopToReject(activeStop);
                setShowRejectModal(true);
              }}
            >
              <Text style={styles.rejectBtnText}>✗ REDDET</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Yeni durak ekle butonu - Floating */}
      {!activeStop && (
        <>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
          
          {/* Senkronizasyon butonu */}
          {queueSize > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={syncQueue}
            >
              <Text style={styles.syncButtonText}>⟳ {queueSize}</Text>
            </TouchableOpacity>
          )}
        </>
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
            
            {projection && projection.route_s != null && (
              <View style={styles.locationInfo}>
                <Text style={{fontWeight: 'bold', marginBottom: 4}}>📊 Rota Bilgisi:</Text>
                <Text>Route S: {projection.route_s?.toFixed(1) || '?'} m</Text>
                <Text>Uzaklık: {projection.lateral_offset?.toFixed(1) || '?'} m</Text>
                <Text>Taraf: {projection.side === 'LEFT' ? 'SOL' : projection.side === 'RIGHT' ? 'SAĞ' : '?'}</Text>
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

      {/* Durak Reddet Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Durak Reddet</Text>
            
            {stopToReject && (
              <View style={styles.locationInfo}>
                <Text style={{fontWeight: 'bold', marginBottom: 4}}>📍 {stopToReject.name || 'İsimsiz Durak'}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Red nedeni yazın..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setStopToReject(null);
                }}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#EF4444' }]}
                onPress={() => handleRejectStop(stopToReject, rejectReason)}
              >
                <Text style={styles.modalButtonText}>Reddet</Text>
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
  topBar: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    zIndex: 100,
    borderBottomWidth: 2,
    borderBottomColor: '#10B981'
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  backText: {
    fontSize: 24,
    color: '#10B981',
    fontWeight: '700'
  },
  topBarCenter: {
    flex: 1
  },
  routeNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  dirBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  dirText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  modernHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.3)'
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8
  },
  routeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center'
  },
  routeBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  directionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  gidisBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  donusBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  directionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  nearbyStopCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(31, 41, 55, 0.98)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 2,
    borderColor: '#10B981'
  },
  stopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  stopCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1
  },
  stopDistance: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981'
  },
  stopCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 26
  },
  stopInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  stopCardInfo: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  stopIdBadge: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8
  },
  approveBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8
  },
  rejectBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  closeBtnText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '700'
  },
  backButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)'
  },
  backButtonText: {
    fontSize: 20,
    color: '#1F2937',
    fontWeight: '700'
  },
  routeInfoCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)'
  },
  routeInfo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.2
  },
  routeName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.1
  },
  directionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
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
    top: 220,
    left: 16,
    right: 16,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center'
  },
  warningPanel: {
    position: 'absolute',
    top: 310,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.4)'
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
    bottom: 240,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  addButtonText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  syncButton: {
    position: 'absolute',
    bottom: 320,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  syncButtonText: {
    fontSize: 24,
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
  },
  statusBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(75, 85, 99, 0.5)'
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  statusLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700'
  },
  statusGood: {
    color: '#10B981'
  },
  statusWarn: {
    color: '#F59E0B'
  },
  statusQueue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B'
  }
});
