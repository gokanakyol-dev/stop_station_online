/**
 * API Client - Backend ile iletişim
 * Offline-first: Network hatalarını yönetir
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend URL
// Expo Go'da (__DEV__ = true) telefondan LAN IP ile local backend'e erişim sık sık sorun çıkarır.
// Bu yüzden varsayılanı Render yapıyoruz. Local geliştirme gerekiyorsa EXPO_PUBLIC_API_BASE_URL ile override edin.
// Örn: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.29:3000`
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://stop-station.onrender.com';

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 saniye timeout (Render.com cold start için)
  headers: {
    'Content-Type': 'application/json',
    // Bazı Android/RN kombinasyonlarında sıkıştırılmış cevaplar "Network Error" gibi görünebiliyor.
    // Sunucudan sıkıştırmasız cevap istemek için:
    'Accept-Encoding': 'identity'
  }
});

/**
 * Retry mekanizması - başarısız istekleri tekrarlar
 */
const retryRequest = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
};

/**
 * Tüm hatları getir
 */
export const getRoutes = async () => {
  try {
    const routes = await retryRequest(async () => {
      const response = await api.get('/api/routes');
      return response.data?.routes || [];
    });
    
    // Başarılı ise cache'le
    if (routes.length > 0) {
      await AsyncStorage.setItem('cached_routes', JSON.stringify(routes));
    }
    
    return routes;
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Routes fetch error:', {
        message: error?.message,
        code: error?.code,
        url: error?.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error?.config?.url,
        status: error?.response?.status
      });
    }
    // Offline durumda cache'den getir
    const cached = await AsyncStorage.getItem('cached_routes');
    if (cached) {
      return JSON.parse(cached);
    }
    throw error;
  }
};

/**
 * Belirli hat + yön için route ve durak bilgisi
 */
export const getRouteWithDirection = async (routeId, direction) => {
  try {
    const data = await retryRequest(async () => {
      const response = await api.get(`/api/routes/${routeId}/direction/${direction}`);
      return response.data;
    });
    
    // Offline kullanım için cache'le
    await AsyncStorage.setItem(
      `route_${routeId}_${direction}`,
      JSON.stringify(data)
    );
    
    return data;
  } catch (error) {
    if (__DEV__) console.error('Route data fetch error:', error);
    // Offline durumda cache'den getir
    const cached = await AsyncStorage.getItem(`route_${routeId}_${direction}`);
    if (cached) {
      return JSON.parse(cached);
    }
    throw error;
  }
};

/**
 * Durağı onayla
 */
export const approveStop = async (stopId, routeId, direction, location, userId = 'field_user') => {
  const payload = {
    stop_id: stopId,
    route_id: routeId,
    direction,
    user_id: userId,
    location
  };
  
  try {
    console.log('[approveStop] Sending request to:', API_BASE_URL + '/api/field/stops/approve');
    console.log('[approveStop] Payload:', JSON.stringify(payload));
    const response = await api.post('/api/field/stops/approve', payload);
    console.log('[approveStop] Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[approveStop] Error details:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data
    });
    
    // Sadece network hatası ise offline kuyruğuna ekle
    // Sunucu hatası veya timeout değilse, hatayı fırlat
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
      console.log('[approveStop] Network error, queuing offline...');
      await queueOfflineAction('approve', payload);
      return { status: 'queued', offline: true };
    }
    
    // Sunucu yanıt verdi ama hata döndü
    throw new Error(error.response?.data?.error || error.message);
  }
};

/**
 * Durağı reddet
 */
export const rejectStop = async (stopId, routeId, direction, location, reason, userId = 'field_user') => {
  const payload = {
    stop_id: stopId,
    route_id: routeId,
    direction,
    user_id: userId,
    location,
    reason
  };
  
  try {
    console.log('[rejectStop] Sending request to:', API_BASE_URL + '/api/field/stops/reject');
    console.log('[rejectStop] Payload:', JSON.stringify(payload));
    const response = await api.post('/api/field/stops/reject', payload);
    console.log('[rejectStop] Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[rejectStop] Error details:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data
    });
    
    // Sadece network hatası ise offline kuyruğuna ekle
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
      console.log('[rejectStop] Network error, queuing offline...');
      await queueOfflineAction('reject', payload);
      return { status: 'queued', offline: true };
    }
    
    throw new Error(error.response?.data?.error || error.message);
  }
};

/**
 * Yeni durak ekle
 */
export const addStop = async (routeId, direction, location, name, userId = 'field_user') => {
  const payload = {
    route_id: routeId,
    direction,
    user_id: userId,
    location,
    name
  };
  
  try {
    console.log('[addStop] Sending request to:', API_BASE_URL + '/api/field/stops/add');
    console.log('[addStop] Payload:', JSON.stringify(payload));
    const response = await api.post('/api/field/stops/add', payload);
    console.log('[addStop] Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('[addStop] Error details:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data
    });
    
    // Sadece network hatası ise offline kuyruğuna ekle
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response) {
      console.log('[addStop] Network error, queuing offline...');
      await queueOfflineAction('add', payload);
      return { status: 'queued', offline: true };
    }
    
    throw new Error(error.response?.data?.error || error.message);
  }
};

/**
 * Offline aksiyonları queue'ya ekle
 */
const queueOfflineAction = async (actionType, payload) => {
  try {
    const queueKey = 'offline_queue';
    const existing = await AsyncStorage.getItem(queueKey);
    const queue = existing ? JSON.parse(existing) : [];
    
    queue.push({
      actionType,
      payload,
      timestamp: new Date().toISOString()
    });
    
    await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
  } catch (error) {
    console.error('Queue error:', error);
  }
};

/**
 * Online olunca queue'daki aksiyonları gönder
 */
export const syncOfflineQueue = async () => {
  try {
    const queueKey = 'offline_queue';
    const existing = await AsyncStorage.getItem(queueKey);
    
    if (!existing) {
      console.log('[syncOfflineQueue] No items in queue');
      return { synced: 0, failed: 0, results: [] };
    }
    
    const queue = JSON.parse(existing);
    console.log('[syncOfflineQueue] Starting sync, items:', queue.length);
    
    const results = [];
    
    for (const item of queue) {
      try {
        console.log('[syncOfflineQueue] Syncing item:', item.actionType, item.payload?.stop_id || item.payload?.name);
        let response;
        switch (item.actionType) {
          case 'approve':
            response = await api.post('/api/field/stops/approve', item.payload);
            break;
          case 'reject':
            response = await api.post('/api/field/stops/reject', item.payload);
            break;
          case 'add':
            response = await api.post('/api/field/stops/add', item.payload);
            break;
        }
        console.log('[syncOfflineQueue] Item synced successfully:', response.data);
        results.push({ success: true, item });
      } catch (error) {
        console.error('[syncOfflineQueue] Item sync failed:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        results.push({ success: false, item, error: error.response?.data?.error || error.message });
      }
    }
    
    // Başarılıları queue'dan çıkar
    const remaining = queue.filter((item, index) => !results[index].success);
    await AsyncStorage.setItem(queueKey, JSON.stringify(remaining));
    
    const synced = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log('[syncOfflineQueue] Sync complete. Synced:', synced, 'Failed:', failed, 'Remaining:', remaining.length);
    
    return { synced, failed, remaining: remaining.length, results };
  } catch (error) {
    console.error('[syncOfflineQueue] Sync error:', error);
    return { synced: 0, failed: 0, error: error.message };
  }
};

/**
 * Analytics verilerini getir
 */
export const getAnalytics = async () => {
  try {
    const response = await retryRequest(async () => {
      return await api.get('/api/analytics');
    });
    
    // Cache'le
    await AsyncStorage.setItem('cached_analytics', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    if (__DEV__) console.error('Analytics fetch error:', error);
    const cached = await AsyncStorage.getItem('cached_analytics');
    if (cached) {
      return JSON.parse(cached);
    }
    throw error;
  }
};

/**
 * Field actions (saha aksiyonları) getir
 */
export const getFieldActions = async (limit = 50) => {
  try {
    const response = await retryRequest(async () => {
      return await api.get(`/api/field/actions?limit=${limit}`);
    });
    
    // Cache'le
    await AsyncStorage.setItem('cached_field_actions', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    if (__DEV__) console.error('Field actions fetch error:', error);
    const cached = await AsyncStorage.getItem('cached_field_actions');
    if (cached) {
      return JSON.parse(cached);
    }
    throw error;
  }
};

/**
 * System health durumunu getir
 */
export const getSystemHealth = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    return { status: 'offline', error: error.message };
  }
};

/**
 * Offline queue size'ı kontrol et
 */
export const getOfflineQueueSize = async () => {
  try {
    const queueKey = 'offline_queue';
    const existing = await AsyncStorage.getItem(queueKey);
    if (!existing) return 0;
    const queue = JSON.parse(existing);
    return queue.length;
  } catch (error) {
    return 0;
  }
};

/**
 * Offline queue'yu temizle
 */
export const clearOfflineQueue = async () => {
  try {
    await AsyncStorage.removeItem('offline_queue');
    console.log('[clearOfflineQueue] Queue cleared');
    return true;
  } catch (error) {
    console.error('[clearOfflineQueue] Error:', error);
    return false;
  }
};

/**
 * Offline queue içeriğini getir (debug için)
 */
export const getOfflineQueueItems = async () => {
  try {
    const queueKey = 'offline_queue';
    const existing = await AsyncStorage.getItem(queueKey);
    if (!existing) return [];
    return JSON.parse(existing);
  } catch (error) {
    return [];
  }
};

export default api;
