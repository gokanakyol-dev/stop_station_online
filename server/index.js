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

// Static dosyalar için NO CACHE - her seferinde yeni dosya çek
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// In-memory job status (örnek, ileride Supabase'e taşınacak)
let lastJob = { status: 'idle', result: null, error: null };
let stopsStore = [];

// Supabase client
import { supabase } from './supabaseClient.js';

// Mobil API route'larını her zaman ekle (Render'da 404 olmasın)
routeRoutes(app);
fieldRoutes(app);

// 🏓 Health check & keep-alive endpoint (Render free tier sleep prevention)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// ✅ Tüm durakları getir (Saha Kontrol Paneli için)
app.get('/api/stops', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('id, route_id, direction, name, lat, lon, field_verified, field_rejected, last_verified_at')
      .order('route_id', { ascending: true })
      .order('sequence_number', { ascending: true });
    
    if (error) throw error;
    
    res.json({ stops: data || [] });
  } catch (err) {
    console.error('[GET /api/stops] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Pipeline fonksiyonunu asenkron yükle
let runStep1Pipeline = null;
import('../public/pipeline/index.js')
  .then((mod) => {
    runStep1Pipeline = mod.runStep1Pipeline;
    console.log('✅ Pipeline yüklendi');
  })
  .catch((err) => {
    console.error('❌ Pipeline import hatası:', err);
    console.error('Stack:', err.stack);
  });

// Health check endpoint (Render.com için - hem /healthz hem /status)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Job status endpoint (aynı zamanda health check olarak kullanılıyor)
app.get('/status', (req, res) => {
  // Her zaman 200 OK dön (Render health check için)
  res.status(200).json({ 
    status: 'healthy',
    service: 'stop-station',
    timestamp: new Date().toISOString(),
    jobStatus: lastJob.status,
    jobError: lastJob.error 
  });
});

// ANALYZE endpoint: GPS ve durak verisi alır, pipeline çalıştırır
app.post('/analyze', async (req, res) => {
  try {
    if (!runStep1Pipeline) {
      return res.status(503).json({ error: 'Pipeline not ready' });
    }

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
      const detectedRows = result.stops.detectedStops.map((s) => ({
        job_id: jobId,
        name: s.name || s.id,
        sequence_number: s.sequenceNumber,
        lat: s.lat,
        lon: s.lon,
        distance_along_route: s.distanceAlongRoute,
        distance_to_route: s.distanceToRoute,
        geom: `SRID=4326;POINT(${s.lon} ${s.lat})`,
      }));
      if (detectedRows.length > 0) {
        const { error: detErr } = await supabase.from('detected_stops').insert(detectedRows);
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
    lastJob.error = err?.message || String(err);
    res.status(500).json({ error: lastJob.error });
  }
});

// Supabase: Gerçek durakları getir
app.get('/stops', async (req, res) => {
  const { data, error } = await supabase.from('real_stops').select('*');
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
}).on('error', (err) => {
  console.error('❌ Sunucu hatası:', err);
  process.exit(1);
});

// Yakalanmamış hataları logla
process.on('uncaughtException', (err) => {
  console.error('❌ Yakalanmamış hata:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Yakalanmamış promise reddi:', reason);
  process.exit(1);
});
