// Sahadan gelen durak işlemlerini kaydet
import { supabase } from '../supabaseClient.js';

export const fieldRoutes = (app) => {
  // Sahadan durak onaylama
  app.post('/api/field/stops/approve', async (req, res) => {
    try {
      const { stop_id, route_id, direction, user_id, location } = req.body;
      
      console.log('[approve] Received:', { stop_id, route_id, direction, user_id, location });
      
      // Önce stop bilgisini çek - route_s için stop koordinatlarından projeksiyon alacağız
      const { data: stop, error: stopFetchError } = await supabase
        .from('stops')
        .select('lat, lon')
        .eq('id', stop_id)
        .single();
      
      if (stopFetchError) throw stopFetchError;
      
      // route_s her zaman stop koordinatlarından gelsin (userLocation değil!)
      const finalLocation = location || {};
      const fieldLat = finalLocation.lat ?? stop.lat;
      const fieldLon = finalLocation.lon ?? stop.lon;
      
      const { data, error } = await supabase
        .from('field_actions')
        .insert([{
          action_type: 'APPROVE',
          stop_id,
          route_id,
          direction,
          user_id,
          field_lat: fieldLat,
          field_lon: fieldLon,
          route_s: finalLocation.route_s ?? null,
          lateral_offset: finalLocation.lateral_offset ?? null,
          side: finalLocation.side ?? null,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (error) {
        console.error('[approve] Supabase error:', error);
        throw error;
      }

      // ✅ KRİTİK: Durağı onaylandı olarak işaretle + reject=false
      // geom otomatik trigger ile güncellenecek
      await supabase
        .from('stops')
        .update({ 
          field_verified: true,
          field_rejected: false, // ✅ Çelişki önleme
          last_verified_at: new Date().toISOString()
        })
        .eq('id', stop_id);

      console.log('[approve] Success:', data[0]);
      res.json({ status: 'ok', action: data[0] });
    } catch (err) {
      console.error('[approve] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Sahadan durak reddetme
  app.post('/api/field/stops/reject', async (req, res) => {
    try {
      const { stop_id, route_id, direction, user_id, location, reason } = req.body;
      
      console.log('[reject] Received:', { stop_id, route_id, direction, user_id, location, reason });
      
      // Önce stop bilgisini çek - route_s için stop koordinatlarından projeksiyon
      const { data: stop, error: stopFetchError } = await supabase
        .from('stops')
        .select('lat, lon')
        .eq('id', stop_id)
        .single();
      
      if (stopFetchError) throw stopFetchError;
      
      const finalLocation = location || {};
      const fieldLat = finalLocation.lat ?? stop.lat;
      const fieldLon = finalLocation.lon ?? stop.lon;
      
      const { data, error } = await supabase
        .from('field_actions')
        .insert([{
          action_type: 'REJECT',
          stop_id,
          route_id,
          direction,
          user_id,
          field_lat: fieldLat,
          field_lon: fieldLon,
          route_s: finalLocation.route_s ?? null,
          lateral_offset: finalLocation.lateral_offset ?? null,
          side: finalLocation.side ?? null,
          notes: reason,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (error) {
        console.error('[reject] Supabase error:', error);
        throw error;
      }

      // ✅ KRİTİK: Durağı reddedildi olarak işaretle + verify=false
      await supabase
        .from('stops')
        .update({ 
          field_verified: false, // ✅ Çelişki önleme
          field_rejected: true 
        })
        .eq('id', stop_id);

      console.log('[reject] Success:', data[0]);
      res.json({ status: 'ok', action: data[0] });
    } catch (err) {
      console.error('[reject] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Sahadan yeni durak ekleme
  app.post('/api/field/stops/add', async (req, res) => {
    try {
      const { route_id, direction, user_id, location, name } = req.body;
      
      // ✅ KRİTİK: Zorunlu alanları kontrol et
      if (!location || !location.lat || !location.lon) {
        return res.status(400).json({ error: 'location.lat ve location.lon zorunlu' });
      }
      
      if (!location.route_s && location.route_s !== 0) {
        return res.status(400).json({ error: 'route_s zorunlu (harita tıklamasından projeksiyon gerekli)' });
      }
      
      if (!direction || !['gidis', 'donus'].includes(direction)) {
        return res.status(400).json({ error: 'direction sadece gidis veya donus olabilir' });
      }
      
      // ✅ KRİTİK: Yeni durağı ekle - geom trigger ile otomatik dolacak
      const { data: stopData, error: stopError } = await supabase
        .from('stops')
        .insert([{
          route_id,
          direction,
          name: name || 'Yeni Durak',
          lat: location.lat,
          lon: location.lon,
          route_s: location.route_s,
          lateral_offset: location.lateral_offset ?? null,
          side: location.side ?? null,
          sequence_number: null, // ✅ Şimdilik NULL, batch job ile doldurulacak
          field_added: true,
          field_verified: true,
          field_rejected: false
        }])
        .select();
      
      if (stopError) throw stopError;

      // Sonra field action kaydı ekle
      const { data: actionData, error: actionError } = await supabase
        .from('field_actions')
        .insert([{
          action_type: 'ADD',
          stop_id: stopData[0].id,
          route_id,
          direction,
          user_id,
          field_lat: location.lat,
          field_lon: location.lon,
          route_s: location.route_s,
          lateral_offset: location.lateral_offset ?? null,
          side: location.side ?? null,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (actionError) throw actionError;

      res.json({ status: 'ok', stop: stopData[0], action: actionData[0] });
    } catch (err) {
      console.error('[add] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Saha aksiyonlarını getir (dashboard için)
  app.get('/api/field/actions', async (req, res) => {
    try {
      const { route_id, direction, user_id } = req.query;
      
      let query = supabase
        .from('field_actions')
        .select('*, stops(name, lat, lon)')
        .order('timestamp', { ascending: false });
      
      if (route_id) query = query.eq('route_id', route_id);
      if (direction) query = query.eq('direction', direction);
      if (user_id) query = query.eq('user_id', user_id);
      
      const { data, error } = await query;
      if (error) throw error;

      res.json({ actions: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
