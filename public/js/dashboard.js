/**
 * Dashboard JavaScript
 * Sahadan gelen field actions verilerini gösterir
 */

const API_URL = window.location.origin;

let allActions = [];
let routes = [];

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
  await loadRoutes();
  await loadActions();
  
  // Event listeners
  document.getElementById('refreshBtn').addEventListener('click', loadActions);
  document.getElementById('routeFilter').addEventListener('change', filterActions);
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
