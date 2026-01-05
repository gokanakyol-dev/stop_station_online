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
