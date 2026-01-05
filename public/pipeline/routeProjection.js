/**
 * ROUTE PROJECTION CORE
 * 
 * Bu modül GPS noktasını route üzerindeki en yakın noktaya projektler.
 * Hem mobil uygulamada hem backend'de kullanılır.
 * 
 * Çıktı:
 * - route_s: Route boyunca mesafe (metre)
 * - lateral_offset: Route'a dik uzaklık (metre)
 * - side: LEFT veya RIGHT
 * - nearest_point: Route üzerindeki en yakın nokta {lat, lon}
 */

/**
 * İki GPS noktası arasındaki mesafeyi Haversine ile hesapla
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Dünya yarıçapı metre cinsinden
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Bir noktanın bir segment üzerindeki projeksiyon oranını hesapla (0-1 arası)
 */
function projectPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    return { t: 0, projX: ax, projY: ay };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return { t, projX, projY };
}

/**
 * Noktanın segment'in hangi tarafında olduğunu hesapla
 * Cross product kullanarak LEFT veya RIGHT döner
 */
function getSide(px, py, ax, ay, bx, by) {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  return cross > 0 ? 'LEFT' : 'RIGHT';
}

/**
 * Route skeleton'ı oluştur
 * Skeleton: Her noktada route boyunca kümülatif mesafe
 * 
 * @param {Array} polyline - [{lat, lon}, ...] formatında route noktaları
 * @returns {Array} [{lat, lon, route_s}, ...] formatında skeleton
 */
export function buildRouteSkeleton(polyline) {
  if (!polyline || polyline.length < 2) {
    return [];
  }

  const skeleton = [];
  let cumulativeDistance = 0;

  skeleton.push({
    lat: polyline[0].lat,
    lon: polyline[0].lon,
    route_s: 0
  });

  for (let i = 1; i < polyline.length; i++) {
    const prev = polyline[i - 1];
    const curr = polyline[i];
    const segmentDistance = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    cumulativeDistance += segmentDistance;

    skeleton.push({
      lat: curr.lat,
      lon: curr.lon,
      route_s: cumulativeDistance
    });
  }

  return skeleton;
}

/**
 * GPS noktasını route'a projektler
 * 
 * @param {Object} gpsPoint - {lat, lon} GPS noktası
 * @param {Array} skeleton - [{lat, lon, route_s}, ...] route skeleton
 * @returns {Object} Projeksiyon sonucu
 */
export function projectToRoute(gpsPoint, skeleton) {
  if (!gpsPoint || !skeleton || skeleton.length < 2) {
    return null;
  }

  let minDistance = Infinity;
  let bestProjection = null;

  // Her segment için projeksiyon hesapla
  for (let i = 0; i < skeleton.length - 1; i++) {
    const a = skeleton[i];
    const b = skeleton[i + 1];

    // Noktayı segment üzerine projektlet
    const { t, projX, projY } = projectPointOnSegment(
      gpsPoint.lon,
      gpsPoint.lat,
      a.lon,
      a.lat,
      b.lon,
      b.lat
    );

    // Projeksiyon noktasından GPS noktasına mesafe
    const distance = haversineDistance(gpsPoint.lat, gpsPoint.lon, projY, projX);

    if (distance < minDistance) {
      minDistance = distance;
      
      // Segment boyunca route_s hesapla
      const segmentLength = b.route_s - a.route_s;
      const route_s = a.route_s + t * segmentLength;

      // Hangi tarafta?
      const side = getSide(gpsPoint.lon, gpsPoint.lat, a.lon, a.lat, b.lon, b.lat);

      bestProjection = {
        route_s: route_s,
        lateral_offset: distance,
        side: side,
        nearest_point: {
          lat: projY,
          lon: projX
        },
        segment_index: i
      };
    }
  }

  return bestProjection;
}

/**
 * Route üzerinde belirli bir route_s değerine karşılık gelen GPS noktasını bul
 * (Ters işlem - durakları haritada göstermek için)
 * 
 * @param {Number} route_s - Route boyunca mesafe
 * @param {Array} skeleton - Route skeleton
 * @returns {Object} {lat, lon} GPS noktası
 */
export function getPointAtRouteS(route_s, skeleton) {
  if (!skeleton || skeleton.length < 2) {
    return null;
  }

  // route_s hangi segmente düşüyor bul
  for (let i = 0; i < skeleton.length - 1; i++) {
    const a = skeleton[i];
    const b = skeleton[i + 1];

    if (route_s >= a.route_s && route_s <= b.route_s) {
      // Segment içinde interpolasyon yap
      const t = (route_s - a.route_s) / (b.route_s - a.route_s);
      const lat = a.lat + t * (b.lat - a.lat);
      const lon = a.lon + t * (b.lon - a.lon);
      
      return { lat, lon };
    }
  }

  // Sınır dışı: en yakın uç noktayı döndür
  if (route_s < skeleton[0].route_s) {
    return { lat: skeleton[0].lat, lon: skeleton[0].lon };
  }
  
  const last = skeleton[skeleton.length - 1];
  return { lat: last.lat, lon: last.lon };
}

/**
 * İki route_s noktası arasındaki mesafeyi hesapla
 */
export function getDistanceBetweenRouteS(route_s1, route_s2) {
  return Math.abs(route_s2 - route_s1);
}

/**
 * GPS noktasının route'a yakınlık durumunu değerlendir
 * Mobil uygulamada uyarı vermek için kullanılır
 * 
 * @param {Object} projection - projectToRoute sonucu
 * @param {Object} thresholds - {maxLateralOffset, warningSide}
 * @returns {Object} Durum değerlendirmesi
 */
export function evaluateProximity(projection, thresholds = {}) {
  const {
    maxLateralOffset = 15, // metre
    warningSide = null // 'LEFT' veya 'RIGHT' ise uyar
  } = thresholds;

  const warnings = [];

  if (projection.lateral_offset > maxLateralOffset) {
    warnings.push({
      type: 'TOO_FAR',
      message: `Güzergaha ${projection.lateral_offset.toFixed(1)} m uzak (önerilen ≤ ${maxLateralOffset} m)`,
      severity: 'warning'
    });
  }

  if (warningSide && projection.side !== warningSide) {
    warnings.push({
      type: 'WRONG_SIDE',
      message: `Durak güzergahın ${projection.side === 'LEFT' ? 'SOL' : 'SAĞ'} tarafında`,
      severity: 'info'
    });
  }

  return {
    isValid: warnings.length === 0,
    warnings: warnings,
    projection: projection
  };
}

/**
 * İleride durak var mı kontrol et
 * 
 * @param {Number} currentRouteS - Mevcut route_s pozisyonu
 * @param {Array} stops - Durak listesi [{route_s, ...}, ...]
 * @param {Number} lookAheadDistance - İleriyi kontrol mesafesi (metre)
 * @returns {Object|null} İlerideki en yakın durak veya null
 */
export function getUpcomingStop(currentRouteS, stops, lookAheadDistance = 100) {
  if (!stops || stops.length === 0) {
    return null;
  }

  // İleride olan durakları filtrele
  const upcomingStops = stops
    .filter(stop => stop.route_s > currentRouteS && stop.route_s <= currentRouteS + lookAheadDistance)
    .sort((a, b) => a.route_s - b.route_s);

  if (upcomingStops.length === 0) {
    return null;
  }

  const nextStop = upcomingStops[0];
  const distance = nextStop.route_s - currentRouteS;

  return {
    stop: nextStop,
    distance: distance,
    message: `${distance.toFixed(0)} m ileride durak var`
  };
}
