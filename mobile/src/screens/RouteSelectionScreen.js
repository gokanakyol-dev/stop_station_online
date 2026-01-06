import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { getRoutes } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getCachedData = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export default function RouteSelectionScreen({ navigation }) {
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setFilteredRoutes(routes);
      } else {
        const q = searchQuery.toLowerCase();
        const filtered = routes.filter(r => 
          r.route_number.toLowerCase().includes(q) ||
          r.route_name.toLowerCase().includes(q)
        );
        setFilteredRoutes(filtered);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, routes]);

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setIsOffline(false);
      
      // Önce cache'den hızlı yükleme
      const cachedData = await getCachedData('routes');
      if (cachedData) {
        setRoutes(cachedData);
        setFilteredRoutes(cachedData);
        setLoading(false); // Hemen loading'i kapat
      }
      
      // Arka planda güncel veriyi çek
      const data = await getRoutes();
      setRoutes(data);
      setFilteredRoutes(data);
    } catch (error) {
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.error;
      const fallbackMsg = error?.message;

      let message = 'Hatlar yüklenemedi.';
      let isNetworkError = false;
      
      if (status === 404) {
        message = 'Sunucu bulunamadı. Lütfen internet bağlantınızı kontrol edin.';
        isNetworkError = true;
      } else if (status >= 500) {
        message = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
      } else if (error.code === 'ECONNABORTED') {
        message = 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.';
        isNetworkError = true;
      } else if (error.code === 'ERR_NETWORK') {
        message = 'İnternet bağlantınızı kontrol edin.';
        isNetworkError = true;
      } else if (serverMsg) {
        message = `${serverMsg}${status ? ` (HTTP ${status})` : ''}`;
      } else if (fallbackMsg) {
        message = fallbackMsg;
      }

      setIsOffline(isNetworkError);

      // Eğer cache'den veri gelmediyse hata göster
      if (routes.length === 0) {
        Alert.alert('Bağlantı Hatası', message, [
          { text: 'Tekrar Dene', onPress: loadRoutes },
          { text: 'Tamam', style: 'cancel' }
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const selectDirection = useCallback((route, direction) => {
    navigation.navigate('FieldMap', {
      routeId: route.id,
      routeNumber: route.route_number,
      routeName: route.route_name,
      direction: direction
    });
  }, [navigation]);

  const renderRouteItem = ({ item }) => (
    <View style={styles.routeCard}>
      <TouchableOpacity
        style={styles.routeHeader}
        onPress={() => {
          if (selectedRoute?.id === item.id) {
            setSelectedRoute(null);
          } else {
            setSelectedRoute(item);
          }
        }}
      >
        <View style={styles.routeNumber}>
          <Text style={styles.routeNumberText}>{item.route_number}</Text>
        </View>
        <Text style={styles.routeName}>{item.route_name}</Text>
      </TouchableOpacity>

      {selectedRoute?.id === item.id && (
        <View style={styles.directionButtons}>
          {item.directions?.gidis && (
            <TouchableOpacity
              style={[styles.directionButton, styles.gidisButton]}
              onPress={() => selectDirection(item, 'gidis')}
            >
              <Text style={styles.directionButtonText}>→ GİDİŞ</Text>
            </TouchableOpacity>
          )}
          {item.directions?.donus && (
            <TouchableOpacity
              style={[styles.directionButton, styles.donusButton]}
              onPress={() => selectDirection(item, 'donus')}
            >
              <Text style={styles.directionButtonText}>← DÖNÜŞ</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Hatlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DURAK DOĞRULAMA</Text>
        <Text style={styles.subtitle}>Hat ve yön seçin</Text>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            ⚠️ Çevrimdışı mod - Önbelleğe alınan veriler gösteriliyor
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Hat ara... (numara veya isim)"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredRoutes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRouteItem}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadRoutes}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Sonuç bulunamadı' : 'Hat bulunamadı'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 15,
    color: '#FFFFFF',
    opacity: 0.85,
    fontWeight: '400'
  },
  offlineBanner: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FF8C00'
  },
  offlineBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  clearButton: {
    marginLeft: 10,
    padding: 8
  },
  clearButtonText: {
    fontSize: 18,
    color: '#999'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  listContent: {
    padding: 16
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  routeNumber: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  routeNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  routeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: 0.2
  },
  directionButtons: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 12
  },
  directionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  gidisButton: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  donusButton: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  directionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8
  }
});
