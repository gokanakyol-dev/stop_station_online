-- ✅ KRİTİK VERİ BOZULMASI DÜZELTMELERİ
-- Supabase SQL Editor'de çalıştırın

-- 1️⃣ direction Validation
ALTER TABLE stops 
DROP CONSTRAINT IF EXISTS stops_direction_check,
ADD CONSTRAINT stops_direction_check CHECK (direction IN ('gidis', 'donus'));

ALTER TABLE field_actions
DROP CONSTRAINT IF EXISTS field_actions_direction_check,
ADD CONSTRAINT field_actions_direction_check CHECK (direction IN ('gidis', 'donus'));

ALTER TABLE field_actions
DROP CONSTRAINT IF EXISTS field_actions_action_type_check,
ADD CONSTRAINT field_actions_action_type_check CHECK (action_type IN ('APPROVE', 'REJECT', 'ADD'));

-- 2️⃣ field_verified + field_rejected Çelişki Önleme
ALTER TABLE stops
DROP CONSTRAINT IF EXISTS chk_verified_rejected,
ADD CONSTRAINT chk_verified_rejected CHECK (NOT (field_verified = true AND field_rejected = true));

-- 3️⃣ field_lat ve field_lon NULL olabilir (GPS kapalıysa)
ALTER TABLE field_actions
ALTER COLUMN field_lat DROP NOT NULL,
ALTER COLUMN field_lon DROP NOT NULL;

-- 4️⃣ geom Otomatik Doldurma Trigger
CREATE OR REPLACE FUNCTION populate_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_populate_geom ON stops;
CREATE TRIGGER trigger_populate_geom
  BEFORE INSERT OR UPDATE ON stops
  FOR EACH ROW
  EXECUTE FUNCTION populate_geom();

-- 5️⃣ Mevcut stops için geom doldurma
UPDATE stops
SET geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
WHERE geom IS NULL AND lat IS NOT NULL AND lon IS NOT NULL;

-- 6️⃣ geom Güncelleme RPC Function
CREATE OR REPLACE FUNCTION update_stop_geom(p_stop_id BIGINT, p_lon DOUBLE PRECISION, p_lat DOUBLE PRECISION)
RETURNS void AS $$
BEGIN
  UPDATE stops
  SET geom = ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      updated_at = NOW()
  WHERE id = p_stop_id;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ Mevcut çelişkili verileri temizle
UPDATE stops
SET field_rejected = false
WHERE field_verified = true AND field_rejected = true;

-- 8️⃣ İndeks kontrolü
CREATE INDEX IF NOT EXISTS idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_stops_route_s ON stops(route_id, direction, route_s);

-- TAMAMLANDI ✅
-- Artık:
-- - geom otomatik dolacak
-- - direction sadece gidis/donus kabul edilecek
-- - verified+rejected çelişkisi önlenecek
-- - GPS kapalıysa field_lat/lon NULL olabilecek
