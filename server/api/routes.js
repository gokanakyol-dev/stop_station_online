// Mobil uygulama için route API'leri
import { supabase } from '../supabaseClient.js';

export const routeRoutes = (app) => {
  // Tüm hatları listele (mobil için hat seçimi)
  app.get('/api/routes', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('id, route_number, route_name, directions')
        .order('route_number');
      
      if (error) throw error;
      res.json({ routes: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Yeni hat ekle
  app.post('/api/routes', async (req, res) => {
    try {
      const { route_number, route_name } = req.body;
      
      if (!route_number || !route_name) {
        return res.status(400).json({ error: 'route_number ve route_name gerekli' });
      }
      
      const { data, error } = await supabase
        .from('routes')
        .insert([{
          route_number,
          route_name,
          directions: {
            gidis: { polyline: [], skeleton: [], total_length: 0 },
            donus: { polyline: [], skeleton: [], total_length: 0 }
          }
        }])
        .select();
      
      if (error) throw error;
      res.json({ route: data[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Hat sil
  app.delete('/api/routes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Önce bu hattın duraklarını sil (cascade yapmıyorsa)
      await supabase.from('stops').delete().eq('route_id', id);
      
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tüm durakları listele (web yönetim paneli için)
  app.get('/api/stops/all', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('stops')
        .select('*')
        .order('route_id')
        .order('direction')
        .order('sequence_number');
      
      if (error) throw error;
      res.json({ stops: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Yeni durak ekle
  app.post('/api/stops', async (req, res) => {
    try {
      const { route_id, direction, name, lat, lon, sequence_number } = req.body;
      
      if (!route_id || !direction || !name || lat === undefined || lon === undefined) {
        return res.status(400).json({ error: 'route_id, direction, name, lat, lon gerekli' });
      }
      
      const { data, error } = await supabase
        .from('stops')
        .insert([{
          route_id,
          direction,
          name,
          lat,
          lon,
          sequence_number: sequence_number || 0,
          geom: `SRID=4326;POINT(${lon} ${lat})`
        }])
        .select();
      
      if (error) throw error;
      res.json({ stop: data[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Durak sil
  app.delete('/api/stops/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const { error } = await supabase
        .from('stops')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Belirli bir hat + yön için tüm bilgileri getir
  app.get('/api/routes/:routeId/direction/:direction', async (req, res) => {
    try {
      const { routeId, direction } = req.params;
      
      // Route bilgisini al
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;

      // Bu yön için polyline ve skeleton'ı al
      const directionData = routeData.directions?.[direction];
      if (!directionData) {
        return res.status(404).json({ error: 'Direction not found' });
      }

      // Bu yön için durakları al
      const { data: stops, error: stopsError } = await supabase
        .from('stops')
        .select('*')
        .eq('route_id', routeId)
        .eq('direction', direction)
        .order('sequence_number');
      
      if (stopsError) throw stopsError;

      res.json({
        route: {
          id: routeData.id,
          route_number: routeData.route_number,
          route_name: routeData.route_name,
          direction: direction,
          polyline: directionData.polyline,
          skeleton: directionData.skeleton,
          total_length: directionData.total_length
        },
        stops: stops
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
