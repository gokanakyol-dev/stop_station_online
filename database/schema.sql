-- STOP STATION DATABASE SCHEMA
-- Bu dosyayı Supabase SQL Editor'de çalıştırın

-- 1. ROUTES TABLOSU
-- Hat bilgilerini ve güzergah verilerini tutar
CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  route_number VARCHAR(10) NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  directions JSONB, -- {gidis: {polyline, skeleton, total_length}, donus: {...}}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STOPS TABLOSU
-- Durak bilgilerini tutar (hem mevcut hem sahadan eklenen)
CREATE TABLE IF NOT EXISTS stops (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT REFERENCES routes(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL, -- 'gidis' veya 'donus'
  name VARCHAR(255) NOT NULL,
  sequence_number INTEGER,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  route_s DOUBLE PRECISION, -- Route boyunca mesafe (metre)
  lateral_offset DOUBLE PRECISION, -- Route'a dik uzaklık (metre)
  side VARCHAR(10), -- 'LEFT' veya 'RIGHT'
  field_verified BOOLEAN DEFAULT FALSE, -- Sahada onaylandı mı?
  field_rejected BOOLEAN DEFAULT FALSE, -- Sahada reddedildi mi?
  field_added BOOLEAN DEFAULT FALSE, -- Sahadan mı eklendi?
  last_verified_at TIMESTAMPTZ,
  geom GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FIELD_ACTIONS TABLOSU
-- Sahadan yapılan tüm işlemlerin kaydı
CREATE TABLE IF NOT EXISTS field_actions (
  id BIGSERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL, -- 'APPROVE', 'REJECT', 'ADD'
  stop_id BIGINT REFERENCES stops(id) ON DELETE SET NULL,
  route_id BIGINT REFERENCES routes(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL,
  user_id VARCHAR(100), -- Saha personeli ID
  field_lat DOUBLE PRECISION NOT NULL, -- İşlem anındaki GPS konumu
  field_lon DOUBLE PRECISION NOT NULL,
  route_s DOUBLE PRECISION, -- İşlem anındaki route_s
  lateral_offset DOUBLE PRECISION,
  side VARCHAR(10),
  notes TEXT, -- Ret nedeni vs
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. JOBS TABLOSU (mevcut sistemden)
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DETECTED_STOPS TABLOSU (mevcut sistemden)
CREATE TABLE IF NOT EXISTS detected_stops (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  name VARCHAR(255),
  sequence_number INTEGER,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  distance_along_route DOUBLE PRECISION,
  distance_to_route DOUBLE PRECISION,
  geom GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. REAL_STOPS TABLOSU (mevcut sistemden)
CREATE TABLE IF NOT EXISTS real_stops (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İNDEKSLER
CREATE INDEX IF NOT EXISTS idx_stops_route_direction ON stops(route_id, direction);
CREATE INDEX IF NOT EXISTS idx_stops_field_verified ON stops(field_verified);
CREATE INDEX IF NOT EXISTS idx_field_actions_route ON field_actions(route_id, direction);
CREATE INDEX IF NOT EXISTS idx_field_actions_timestamp ON field_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_stops_geom ON stops USING GIST(geom);

-- ÖRNEK VERI EKLEME (Test için)
-- Gerçek verilerinizi eklemeden önce bu kısmı silebilirsiniz

INSERT INTO routes (route_number, route_name, directions) VALUES
  ('10', 'Konak - Bornova', '{"gidis": {"polyline": [], "skeleton": [], "total_length": 0}, "donus": {"polyline": [], "skeleton": [], "total_length": 0}}'),
  ('30', 'Konak - Karşıyaka', '{"gidis": {"polyline": [], "skeleton": [], "total_length": 0}, "donus": {"polyline": [], "skeleton": [], "total_length": 0}}')
ON CONFLICT DO NOTHING;

-- ROW LEVEL SECURITY (Opsiyonel - production için önerilir)
-- ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE field_actions ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICY (Herkes okuyabilir)
-- CREATE POLICY "Public routes are viewable by everyone"
--   ON routes FOR SELECT
--   USING (true);

-- CREATE POLICY "Public stops are viewable by everyone"
--   ON stops FOR SELECT
--   USING (true);

-- AUTHENTICATED WRITE POLICY (Sadece authenticated kullanıcılar yazabilir)
-- CREATE POLICY "Authenticated users can insert field actions"
--   ON field_actions FOR INSERT
--   TO authenticated
--   WITH CHECK (true);
