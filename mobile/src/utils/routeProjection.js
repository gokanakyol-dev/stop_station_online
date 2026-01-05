/**
 * ROUTE PROJECTION - Mobile Version
 * Backend'deki routeProjection.js ile aynı algoritmalar
 * 
 * Mobil cihazda offline çalışır
 */

/**
 * İki GPS noktası arasındaki mesafeyi Haversine ile hesapla
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
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

function getSide(px, py, ax, ay, bx, by) {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  return cross > 0 ? 'LEFT' : 'RIGHT';
}

/**
 * Route skeleton'ı oluştur
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
 * BU FONKSİYON SİSTEMİN KALBİ
 */
export function projectToRoute(gpsPoint, skeleton) {
  if (!gpsPoint || !skeleton || skeleton.length < 2) {
    return null;
  }

  let minDistance = Infinity;
  let bestProjection = null;

  for (let i = 0; i < skeleton.length - 1; i++) {
    const a = skeleton[i];
    const b = skeleton[i + 1];

    const { t, projX, projY } = projectPointOnSegment(
      gpsPoint.lon,
      gpsPoint.lat,
      a.lon,
      a.lat,
      b.lon,
      b.lat
    );

    const distance = haversineDistance(gpsPoint.lat, gpsPoint.lon, projY, projX);

    if (distance < minDistance) {
      minDistance = distance;
      
      const segmentLength = b.route_s - a.route_s;
      const route_s = a.route_s + t * segmentLength;
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
 * Route_s'den GPS noktası hesapla
 */
export function getPointAtRouteS(route_s, skeleton) {
  if (!skeleton || skeleton.length < 2) {
    return null;
  }

  for (let i = 0; i < skeleton.length - 1; i++) {
    const a = skeleton[i];
    const b = skeleton[i + 1];

    if (route_s >= a.route_s && route_s <= b.route_s) {
      const t = (route_s - a.route_s) / (b.route_s - a.route_s);
      const lat = a.lat + t * (b.lat - a.lat);
      const lon = a.lon + t * (b.lon - a.lon);
      
      return { lat, lon };
    }
  }

  if (route_s < skeleton[0].route_s) {
    return { lat: skeleton[0].lat, lon: skeleton[0].lon };
  }
  
  const last = skeleton[skeleton.length - 1];
  return { lat: last.lat, lon: last.lon };
}

/**
 * İleride durak var mı?
 */
export function getUpcomingStop(currentRouteS, stops, lookAheadDistance = 100) {
  if (!stops || stops.length === 0) {
    return null;
  }

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

/**
 * Proximity uyarıları
 */
export function evaluateProximity(projection, thresholds = {}) {
  const {
    maxLateralOffset = 15,
    warningSide = null
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
