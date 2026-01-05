/**
 * API Client - Backend ile iletişim
 * Offline-first: Network hatalarını yönetir
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend URL - Render.com production veya local geliştirme için
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.252:3000'  // Geliştirme: Local IP
  : 'https://stop-station.onrender.com';  // Production: Render.com

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 saniye timeout (Render.com için)
  headers: {
    'Content-Type': 'application/json'
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
    if (__DEV__) console.error('Routes fetch error:', error);
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
    const response = await api.post('/api/field/stops/approve', payload);
    return response.data;
  } catch (error) {
    // Offline ise queue'ya ekle
    await queueOfflineAction('approve', payload);
    return { status: 'queued', offline: true };
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
    const response = await api.post('/api/field/stops/reject', payload);
    return response.data;
  } catch (error) {
    await queueOfflineAction('reject', payload);
    return { status: 'queued', offline: true };
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
    const response = await api.post('/api/field/stops/add', payload);
    return response.data;
  } catch (error) {
    await queueOfflineAction('add', payload);
    return { status: 'queued', offline: true };
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
    
    if (!existing) return;
    
    const queue = JSON.parse(existing);
    const results = [];
    
    for (const item of queue) {
      try {
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
        results.push({ success: true, item });
      } catch (error) {
        results.push({ success: false, item, error: error.message });
      }
    }
    
    // Başarılıları queue'dan çıkar
    const remaining = queue.filter((item, index) => !results[index].success);
    await AsyncStorage.setItem(queueKey, JSON.stringify(remaining));
    
    return results;
  } catch (error) {
    console.error('Sync error:', error);
    return [];
  }
};

export default api;
