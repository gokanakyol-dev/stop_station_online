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

  // Hat güncelle
  app.put('/api/routes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { route_number, route_name } = req.body;
      
      if (!route_number || !route_name) {
        return res.status(400).json({ error: 'route_number ve route_name gerekli' });
      }
      
      const { data, error } = await supabase
        .from('routes')
        .update({ route_number, route_name })
        .eq('id', id)
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

  // Durak güncelle
  app.put('/api/stops/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, lat, lon, sequence_number } = req.body;
      
      if (!name || lat === undefined || lon === undefined) {
        return res.status(400).json({ error: 'name, lat, lon gerekli' });
      }
      
      const updateData = {
        name,
        lat,
        lon,
        geom: `SRID=4326;POINT(${lon} ${lat})`
      };
      
      if (sequence_number !== undefined) {
        updateData.sequence_number = sequence_number;
      }
      
      const { data, error } = await supabase
        .from('stops')
        .update(updateData)
        .eq('id', id)
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

  // Pipeline sonucunu kaydet (rota + otomatik tespit edilen duraklar)
  app.post('/api/routes/:routeId/direction/:direction/save-pipeline', async (req, res) => {
    try {
      const { routeId, direction } = req.params;
      const { polyline, skeleton, total_length, stops } = req.body;
      
      console.log(`Saving pipeline result for route ${routeId}, direction ${direction}`);
      console.log(`Polyline: ${polyline?.length || 0} points, Skeleton: ${skeleton?.length || 0} points`);
      console.log(`Stops: ${stops?.length || 0} stops to save`);
      
      // 1. Route'un directions bilgisini güncelle
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('directions')
        .eq('id', routeId)
        .single();
      
      if (routeError) throw routeError;
      
      const directions = routeData.directions || {
        gidis: { polyline: [], skeleton: [], total_length: 0 },
        donus: { polyline: [], skeleton: [], total_length: 0 }
      };
      
      // Bu yönün verilerini güncelle
      directions[direction] = {
        polyline: polyline || [],
        skeleton: skeleton || [],
        total_length: total_length || 0
      };
      
      const { error: updateError } = await supabase
        .from('routes')
        .update({ directions })
        .eq('id', routeId);
      
      if (updateError) throw updateError;
      console.log('Route directions updated');
      
      // 2. Bu yön için mevcut durakları sil
      const { error: deleteError } = await supabase
        .from('stops')
        .delete()
        .eq('route_id', routeId)
        .eq('direction', direction);
      
      if (deleteError) throw deleteError;
      console.log('Old stops deleted');
      
      // 3. Yeni durakları ekle
      if (stops && stops.length > 0) {
        const stopsToInsert = stops.map((stop, index) => ({
          route_id: parseInt(routeId),
          direction: direction,
          name: stop.name || `Durak ${index + 1}`,
          lat: stop.lat,
          lon: stop.lon,
          route_s: stop.distanceAlongRoute || 0,
          sequence_number: stop.sequenceNumber || index + 1,
          geom: `SRID=4326;POINT(${stop.lon} ${stop.lat})`
        }));
        
        const { data: insertedStops, error: insertError } = await supabase
          .from('stops')
          .insert(stopsToInsert)
          .select();
        
        if (insertError) throw insertError;
        console.log(`${insertedStops.length} stops inserted`);
        
        res.json({ 
          status: 'ok', 
          message: `Rota ve ${insertedStops.length} durak kaydedildi`,
          stopsCount: insertedStops.length 
        });
      } else {
        res.json({ 
          status: 'ok', 
          message: 'Rota kaydedildi, durak bulunamadı',
          stopsCount: 0 
        });
      }
    } catch (err) {
      console.error('Save pipeline error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Tüm hatları ve durakları export et (JSON)
  app.get('/api/export/all', async (req, res) => {
    try {
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('*')
        .order('route_number');
      
      if (routesError) throw routesError;
      
      const { data: stops, error: stopsError } = await supabase
        .from('stops')
        .select('*')
        .order('route_id')
        .order('direction')
        .order('sequence_number');
      
      if (stopsError) throw stopsError;
      
      res.json({
        exportDate: new Date().toISOString(),
        routes: routes,
        stops: stops
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toplu import (JSON)
  app.post('/api/import/all', async (req, res) => {
    try {
      const { routes, stops, overwrite } = req.body;
      
      if (!routes || !Array.isArray(routes)) {
        return res.status(400).json({ error: 'routes array gerekli' });
      }
      
      let importedRoutes = 0;
      let importedStops = 0;
      
      // Overwrite mode: önce tüm verileri sil
      if (overwrite) {
        await supabase.from('stops').delete().neq('id', 0);
        await supabase.from('routes').delete().neq('id', 0);
      }
      
      // Hatları import et
      for (const route of routes) {
        const { data, error } = await supabase
          .from('routes')
          .upsert({
            route_number: route.route_number,
            route_name: route.route_name,
            directions: route.directions
          }, { onConflict: 'route_number' })
          .select();
        
        if (!error && data) {
          importedRoutes++;
        }
      }
      
      // Durakları import et
      if (stops && Array.isArray(stops)) {
        for (const stop of stops) {
          // Route number'dan route ID bul
          const { data: routeData } = await supabase
            .from('routes')
            .select('id')
            .eq('route_number', stop.route_number || routes.find(r => r.id === stop.route_id)?.route_number)
            .single();
          
          if (routeData) {
            const { error } = await supabase
              .from('stops')
              .insert({
                route_id: routeData.id,
                direction: stop.direction,
                name: stop.name,
                lat: stop.lat,
                lon: stop.lon,
                sequence_number: stop.sequence_number,
                route_s: stop.route_s,
                geom: `SRID=4326;POINT(${stop.lon} ${stop.lat})`
              });
            
            if (!error) importedStops++;
          }
        }
      }
      
      res.json({ 
        status: 'ok',
        importedRoutes,
        importedStops
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics: Hat istatistikleri
  app.get('/api/analytics/routes', async (req, res) => {
    try {
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('id, route_number, route_name, directions');
      
      if (routesError) throw routesError;
      
      const { data: stops, error: stopsError } = await supabase
        .from('stops')
        .select('route_id, direction');
      
      if (stopsError) throw stopsError;
      
      const stats = routes.map(route => {
        const routeStops = stops.filter(s => s.route_id === route.id);
        const gidisStops = routeStops.filter(s => s.direction === 'gidis').length;
        const donusStops = routeStops.filter(s => s.direction === 'donus').length;
        
        return {
          id: route.id,
          route_number: route.route_number,
          route_name: route.route_name,
          gidisStops,
          donusStops,
          totalStops: routeStops.length,
          gidisLength: route.directions?.gidis?.total_length || 0,
          donusLength: route.directions?.donus?.total_length || 0,
          hasPolyline: !!(route.directions?.gidis?.polyline?.length || route.directions?.donus?.polyline?.length)
        };
      });
      
      res.json({ stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics: Genel özet
  app.get('/api/analytics/summary', async (req, res) => {
    try {
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('id, directions');
      
      if (routesError) throw routesError;
      
      const { data: stops, error: stopsError } = await supabase
        .from('stops')
        .select('id');
      
      if (stopsError) throw stopsError;
      
      const routesWithPolyline = routes.filter(r => 
        r.directions?.gidis?.polyline?.length > 0 || 
        r.directions?.donus?.polyline?.length > 0
      ).length;
      
      res.json({
        totalRoutes: routes.length,
        totalStops: stops.length,
        routesWithPolyline,
        routesWithoutPolyline: routes.length - routesWithPolyline
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
