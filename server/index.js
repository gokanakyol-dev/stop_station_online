import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { routeRoutes } from './api/routes.js';
import { fieldRoutes } from './api/field.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS için mobil uygulamayı destekle
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// In-memory job status (örnek, ileride Supabase'e taşınacak)
let lastJob = { status: 'idle', result: null, error: null };
let stopsStore = [];

// Pipeline fonksiyonunu import et
import { supabase } from './supabaseClient.js';
import('../public/pipeline/index.js').then(({ runStep1Pipeline }) => {
  
  // Mobil API route'larını ekle
  routeRoutes(app);
  fieldRoutes(app);
  
  // ANALYZE endpoint: GPS ve durak verisi alır, pipeline çalıştırır
  app.post('/analyze', async (req, res) => {
    try {
      const { gpsRecords, stops, options } = req.body;
      if (!Array.isArray(gpsRecords) || gpsRecords.length === 0) {
        return res.status(400).json({ error: 'gpsRecords eksik veya boş' });
      }
      lastJob.status = 'running';
      lastJob.result = null;
      lastJob.error = null;
      // Job kaydını Supabase'e ekle
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert([{ status: 'running', started_at: new Date() }])
        .select();
      if (jobError) throw new Error('Job kaydı eklenemedi: ' + jobError.message);
      const jobId = jobData[0].id;
      // Pipeline'ı çalıştır
      const result = await runStep1Pipeline(gpsRecords, options || { stops });
      // Hesaplanan durakları detected_stops tablosuna ekle
      if (result.stops && result.stops.detectedStops) {
        const detectedRows = result.stops.detectedStops.map(s => ({
          job_id: jobId,
          name: s.name || s.id,
          sequence_number: s.sequenceNumber,
          lat: s.lat,
          lon: s.lon,
          distance_along_route: s.distanceAlongRoute,
          distance_to_route: s.distanceToRoute,
          geom: `SRID=4326;POINT(${s.lon} ${s.lat})`
        }));
        if (detectedRows.length > 0) {
          const { error: detErr } = await supabase
            .from('detected_stops')
            .insert(detectedRows);
          if (detErr) throw new Error('Detected stops eklenemedi: ' + detErr.message);
        }
      }
      // Job'u tamamlandı olarak güncelle
      await supabase
        .from('jobs')
        .update({ status: 'done', finished_at: new Date() })
        .eq('id', jobId);
      lastJob.status = 'done';
      lastJob.result = result;
      res.json({ status: 'ok', result, jobId });
    } catch (err) {
      lastJob.status = 'error';
      lastJob.error = err.message;
      res.status(500).json({ error: err.message });
    }
  });

  // Job status endpoint
  app.get('/status', (req, res) => {
    res.json({ status: lastJob.status, error: lastJob.error });
  });

  // Supabase: Gerçek durakları getir
  app.get('/stops', async (req, res) => {
    const { data, error } = await supabase
      .from('real_stops')
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ stops: data });
  });

  // Supabase: Yeni gerçek durak ekle
  app.post('/stops', async (req, res) => {
    const stop = req.body;
    if (!stop || !stop.lat || !stop.lon || !stop.name) {
      return res.status(400).json({ error: 'Eksik durak verisi' });
    }
    // Geom alanı için WKT oluştur
    const geom = `SRID=4326;POINT(${stop.lon} ${stop.lat})`;
    const { data, error } = await supabase
      .from('real_stops')
      .insert([{ ...stop, geom }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'ok', stop: data[0] });
  });

  // Ana sayfa
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`✅ Stop Station API aktif: http://localhost:${PORT}`);
  });
});
