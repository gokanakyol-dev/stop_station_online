/**
 * Eğitim Verisi klasöründeki JSON dosyalarını Supabase'e yükler
 * Her JSON dosyası bir hat ve durak bilgilerini içerir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase bağlantısı
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase env eksik!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// EPSG:3857 (Web Mercator) -> EPSG:4326 (WGS84) dönüşümü
function mercatorToWGS84(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lon };
}

// Eğitim Verisi klasöründeki tüm JSON dosyalarını bul
const dataDir = path.join(__dirname, '..', 'Eğitim Verisi');

async function importAllStops() {
  console.log('📂 Eğitim Verisi klasörü taranıyor...\n');
  
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  console.log(`📋 ${files.length} JSON dosyası bulundu:\n`, files.join(', '));
  
  // Önce mevcut örnek verileri temizle
  console.log('\n🗑️ Mevcut örnek veriler temizleniyor...');
  await supabase.from('stops').delete().neq('id', 0);
  await supabase.from('routes').delete().neq('id', 0);
  
  let totalStops = 0;
  let totalRoutes = 0;
  
  for (const file of files) {
    const routeNumber = file.replace('.json', '');
    const filePath = path.join(dataDir, file);
    
    console.log(`\n🚌 Hat ${routeNumber} işleniyor...`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const geojson = JSON.parse(content);
      
      if (!geojson.features || !Array.isArray(geojson.features)) {
        console.log(`  ⚠️ Geçersiz GeoJSON formatı, atlanıyor`);
        continue;
      }
      
      // Durakları gidis/donus olarak grupla
      const gidisStops = [];
      const donusStops = [];
      let routeName = '';
      
      for (const feature of geojson.features) {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        // EPSG:3857 -> WGS84 dönüşümü
        const { lat, lon } = mercatorToWGS84(coords[0], coords[1]);
        
        const stop = {
          name: props.ad || `Durak ${props.durak_id}`,
          sequence_number: props.sira,
          lat,
          lon,
          durak_id: props.durak_id,
          durak_kod: props.durak_kod
        };
        
        // Yön belirleme: yon=1 veya yon_str="G" -> gidiş, yon=2 veya yon_str="D" -> dönüş
        if (props.yon === 1 || props.yon_str === 'G') {
          gidisStops.push(stop);
        } else {
          donusStops.push(stop);
        }
        
        // Hat adını al
        if (!routeName && props.hat_guzergah_ad) {
          routeName = props.hat_guzergah_ad;
        }
      }
      
      // Sıraya göre sırala
      gidisStops.sort((a, b) => a.sequence_number - b.sequence_number);
      donusStops.sort((a, b) => a.sequence_number - b.sequence_number);
      
      console.log(`  📍 Gidiş: ${gidisStops.length} durak, Dönüş: ${donusStops.length} durak`);
      
      // Route'u ekle (insert)
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .insert([{
          route_number: routeNumber,
          route_name: routeName || `Hat ${routeNumber}`,
          directions: {
            gidis: { 
              polyline: gidisStops.map(s => [s.lat, s.lon]),
              skeleton: [],
              total_length: 0
            },
            donus: {
              polyline: donusStops.map(s => [s.lat, s.lon]),
              skeleton: [],
              total_length: 0
            }
          }
        }])
        .select();
      
      if (routeError) {
        console.error(`  ❌ Route eklenemedi:`, routeError.message);
        continue;
      }
      
      const routeId = routeData[0].id;
      totalRoutes++;
      
      // Durakları ekle
      const allStops = [
        ...gidisStops.map(s => ({
          route_id: routeId,
          direction: 'gidis',
          name: s.name,
          sequence_number: s.sequence_number,
          lat: s.lat,
          lon: s.lon,
          geom: `SRID=4326;POINT(${s.lon} ${s.lat})`
        })),
        ...donusStops.map(s => ({
          route_id: routeId,
          direction: 'donus',
          name: s.name,
          sequence_number: s.sequence_number,
          lat: s.lat,
          lon: s.lon,
          geom: `SRID=4326;POINT(${s.lon} ${s.lat})`
        }))
      ];
      
      if (allStops.length > 0) {
        const { error: stopsError } = await supabase
          .from('stops')
          .insert(allStops);
        
        if (stopsError) {
          console.error(`  ❌ Duraklar eklenemedi:`, stopsError.message);
        } else {
          totalStops += allStops.length;
          console.log(`  ✅ ${allStops.length} durak eklendi`);
        }
      }
      
    } catch (err) {
      console.error(`  ❌ Dosya işlenemedi:`, err.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tamamlandı!`);
  console.log(`   📊 ${totalRoutes} hat, ${totalStops} durak yüklendi`);
  console.log('='.repeat(50));
}

importAllStops().catch(console.error);
