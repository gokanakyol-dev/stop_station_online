// Sahadan gelen durak işlemlerini kaydet
import { supabase } from '../supabaseClient.js';

export const fieldRoutes = (app) => {
  // Sahadan durak onaylama
  app.post('/api/field/stops/approve', async (req, res) => {
    try {
      const { stop_id, route_id, direction, user_id, location } = req.body;
      
      console.log('[approve] Received:', { stop_id, route_id, direction, user_id, location });
      
      const { data, error } = await supabase
        .from('field_actions')
        .insert([{
          action_type: 'APPROVE',
          stop_id,
          route_id,
          direction,
          user_id,
          field_lat: location?.lat ?? null,
          field_lon: location?.lon ?? null,
          route_s: location?.route_s ?? null,
          lateral_offset: location?.lateral_offset ?? null,
          side: location?.side ?? null,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (error) {
        console.error('[approve] Supabase error:', error);
        throw error;
      }

      // Durağı onaylandı olarak işaretle
      await supabase
        .from('stops')
        .update({ field_verified: true, last_verified_at: new Date().toISOString() })
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
      
      const { data, error } = await supabase
        .from('field_actions')
        .insert([{
          action_type: 'REJECT',
          stop_id,
          route_id,
          direction,
          user_id,
          field_lat: location?.lat ?? null,
          field_lon: location?.lon ?? null,
          route_s: location?.route_s ?? null,
          lateral_offset: location?.lateral_offset ?? null,
          side: location?.side ?? null,
          notes: reason,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (error) {
        console.error('[reject] Supabase error:', error);
        throw error;
      }

      // Durağı reddedildi olarak işaretle
      await supabase
        .from('stops')
        .update({ field_verified: false, field_rejected: true })
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
      
      // Önce yeni durağı ekle
      const geom = `SRID=4326;POINT(${location.lon} ${location.lat})`;
      const { data: stopData, error: stopError } = await supabase
        .from('stops')
        .insert([{
          route_id,
          direction,
          name: name || 'Yeni Durak',
          lat: location.lat,
          lon: location.lon,
          route_s: location.route_s,
          lateral_offset: location.lateral_offset,
          side: location.side,
          field_added: true,
          field_verified: true,
          geom
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
          lateral_offset: location.lateral_offset,
          side: location.side,
          timestamp: new Date().toISOString()
        }])
        .select();
      
      if (actionError) throw actionError;

      res.json({ status: 'ok', stop: stopData[0], action: actionData[0] });
    } catch (err) {
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
