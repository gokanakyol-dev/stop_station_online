/**
 * Dashboard JavaScript
 * Sahadan gelen field actions verilerini gösterir
 */

const API_URL = window.location.origin;

let allActions = [];
let routes = [];
let map = null;
let markersLayer = null;
let routeLayer = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadRoutes();
  await loadActions();
  
  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', loadActions);
  document.getElementById('routeFilter').addEventListener('change', onRouteFilterChange);
  document.getElementById('directionFilter').addEventListener('change', filterActions);
  document.getElementById('actionFilter').addEventListener('change', filterActions);
});

// Hatları yükle
async function loadRoutes() {
  try {
    const response = await fetch(`${API_URL}/api/routes`);
    const data = await response.json();
    routes = data.routes;
    
    const select = document.getElementById('routeFilter');
    routes.forEach(route => {
      const option = document.createElement('option');
      option.value = route.id;
      option.textContent = `${route.route_number} - ${route.route_name}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Routes load error:', error);
  }
}

// Aksiyonları yükle
async function loadActions() {
  try {
    document.getElementById('actionsList').innerHTML = '<div class="loading">Yükleniyor...</div>';
    
    const response = await fetch(`${API_URL}/api/field/actions`);
    const data = await response.json();
    allActions = data.actions || [];
    
    updateStats();
    displayActions(allActions);
  } catch (error) {
    console.error('Actions load error:', error);
    document.getElementById('actionsList').innerHTML = 
      '<div class="loading">❌ Veriler yüklenemedi</div>';
  }
}

// İstatistikleri güncelle
function updateStats() {
  const stats = {
    approve: allActions.filter(a => a.action_type === 'APPROVE').length,
    reject: allActions.filter(a => a.action_type === 'REJECT').length,
    add: allActions.filter(a => a.action_type === 'ADD').length,
    total: allActions.length
  };
  
  document.getElementById('statApprove').textContent = stats.approve;
  document.getElementById('statReject').textContent = stats.reject;
  document.getElementById('statAdd').textContent = stats.add;
  document.getElementById('statTotal').textContent = stats.total;
}

// Aksiyonları göster
function displayActions(actions) {
  const container = document.getElementById('actionsList');
  
  if (actions.length === 0) {
    container.innerHTML = '<div class="loading">Henüz işlem yok</div>';
    return;
  }
  
  container.innerHTML = actions.map(action => {
    const date = new Date(action.timestamp);
    const timeStr = date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const stopName = action.stops?.name || 'Bilinmeyen Durak';
    
    let typeEmoji = '';
    switch (action.action_type) {
      case 'APPROVE': typeEmoji = '✓'; break;
      case 'REJECT': typeEmoji = '✗'; break;
      case 'ADD': typeEmoji = '+'; break;
    }
    
    return `
      <div class="action-item action-${action.action_type}">
        <div class="action-header">
          <span class="action-type type-${action.action_type}">
            ${typeEmoji} ${action.action_type}
          </span>
          <span class="action-time">${timeStr}</span>
        </div>
        
        <div class="action-stop-name">${stopName}</div>
        
        <div class="action-details">
          <div><strong>Hat:</strong> ${action.route_id}</div>
          <div><strong>Yön:</strong> ${action.direction === 'gidis' ? 'Gidiş' : 'Dönüş'}</div>
          <div><strong>Route S:</strong> ${action.route_s?.toFixed(1) || 'N/A'} m</div>
          <div><strong>Uzaklık:</strong> ${action.lateral_offset?.toFixed(1) || 'N/A'} m</div>
          <div><strong>Taraf:</strong> ${action.side === 'LEFT' ? 'Sol' : 'Sağ'}</div>
          ${action.notes ? `<div><strong>Not:</strong> ${action.notes}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Filtreleme
function filterActions() {
  const routeId = document.getElementById('routeFilter').value;
  const direction = document.getElementById('directionFilter').value;
  const actionType = document.getElementById('actionFilter').value;
  
  let filtered = allActions;
  
  if (routeId) {
    filtered = filtered.filter(a => a.route_id == routeId);
  }
  
  if (direction) {
    filtered = filtered.filter(a => a.direction === direction);
  }
  
  if (actionType) {
    filtered = filtered.filter(a => a.action_type === actionType);
  }
  
  displayActions(filtered);
}

// Otomatik yenileme (30 saniyede bir)
setInterval(() => {
  loadActions();
}, 30000);

// Harita başlat
function initMap() {
  map = L.map('map').setView([41.0, 39.7], 12); // Trabzon merkez
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  markersLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

// Hat filtresi değiştiğinde
async function onRouteFilterChange() {
  const routeId = document.getElementById('routeFilter').value;
  const direction = document.getElementById('directionFilter').value || 'gidis';
  
  // Aksiyonları filtrele
  filterActions();
  
  // Haritada göster
  if (routeId) {
    await loadRouteOnMap(routeId, direction);
  } else {
    // Haritayı temizle
    markersLayer.clearLayers();
    routeLayer.clearLayers();
  }
}

// Rotayı haritada göster
async function loadRouteOnMap(routeId, direction) {
  try {
    // Haritayı temizle
    markersLayer.clearLayers();
    routeLayer.clearLayers();
    
    // Rota ve durak verilerini al
    const response = await fetch(`${API_URL}/api/routes/${routeId}/direction/${direction}`);
    const data = await response.json();
    
    // Polyline çiz
    if (data.route && data.route.polyline && data.route.polyline.length > 0) {
      const coordinates = data.route.polyline.map(p => [p.lat, p.lon]);
      const polyline = L.polyline(coordinates, {
        color: '#10B981',
        weight: 4,
        opacity: 0.8
      }).addTo(routeLayer);
      
      // Haritayı rota sınırlarına oturt
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
    
    // Durakları işaretle
    if (data.stops && data.stops.length > 0) {
      // Yeni eklenen durakların ID'lerini bul
      const addedStopIds = allActions
        .filter(a => a.action_type === 'ADD' && a.route_id == routeId && a.direction === direction)
        .map(a => a.stop_id);
      
      data.stops.forEach(stop => {
        const isNewStop = addedStopIds.includes(stop.id);
        const markerColor = isNewStop ? 'red' : 'blue';
        const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        
        const customIcon = L.icon({
          iconUrl: iconUrl,
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        
        const marker = L.marker([stop.lat, stop.lon], { icon: customIcon })
          .bindPopup(`
            <strong>${stop.name}</strong><br>
            ${isNewStop ? '<span style="color: red; font-weight: bold;">🆕 Yeni Eklenen</span><br>' : ''}
            Route S: ${stop.route_s?.toFixed(1) || 'N/A'} m<br>
            Onaylandı: ${stop.field_verified ? '✓ Evet' : '✗ Hayır'}<br>
            Reddedildi: ${stop.field_rejected ? '✓ Evet' : '✗ Hayır'}
          `)
          .addTo(markersLayer);
      });
    }
  } catch (error) {
    console.error('Route map load error:', error);
  }
}
