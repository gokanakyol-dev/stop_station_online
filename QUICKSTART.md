# HIZLI BAŞLANGIÇ - Stop Station Mobil

## 🚀 5 Dakikada Başla

### 1. Backend'i Çalıştır
```bash
# Ana klasörde
npm install
npm start
```

Backend: `http://localhost:3000` ✅

### 2. Supabase'i Kur
1. https://supabase.com → Yeni proje
2. SQL Editor'de `database/schema.sql` çalıştır
3. `.env` dosyası oluştur:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
```

### 3. Mobil'i Çalıştır
```bash
cd mobile
npm install
npx expo start
```

Telefonda Expo Go ile QR kodu tara ✅

## 📝 İlk Test

### Test Verisi Ekle
Supabase SQL Editor:
```sql
INSERT INTO routes (route_number, route_name, directions) VALUES
('TEST', 'Test Hattı', '{
  "gidis": {
    "polyline": [
      {"lat": 38.4235, "lon": 27.1425},
      {"lat": 38.4240, "lon": 27.1430},
      {"lat": 38.4245, "lon": 27.1435}
    ],
    "skeleton": [
      {"lat": 38.4235, "lon": 27.1425, "route_s": 0},
      {"lat": 38.4240, "lon": 27.1430, "route_s": 50},
      {"lat": 38.4245, "lon": 27.1435, "route_s": 100}
    ]
  }
}');

INSERT INTO stops (route_id, direction, name, lat, lon, route_s)
SELECT id, 'gidis', 'Test Durağı', 38.4240, 27.1430, 50
FROM routes WHERE route_number = 'TEST';
```

### Mobil App'te Test Et
1. App'i aç
2. "TEST" hattını seç
3. "GİDİŞ" seç
4. Harita görünmeli ✅

## ⚙️ Yapılandırma

### API URL (mobile/src/services/api.js)
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'      // Geliştirme
  : 'https://xxx.onrender.com';  // Production
```

### Android Network (Test için)
Eğer localhost'a erişemiyorsanız:
```javascript
const API_BASE_URL = 'http://10.0.2.2:3000'; // Android Emulator
```

## 🐛 Sorunlar?

**Backend çalışmıyor:**
```bash
# Port kullanımda mı kontrol et
netstat -ano | findstr :3000
```

**Mobil GPS çalışmıyor:**
- Cihaz ayarlarından Location izni ver
- iOS: Settings → Privacy → Location Services

**CORS hatası:**
Backend'de `cors` package yüklü mü?
```bash
npm install cors
```

## 📱 Fiziksel Cihazda Test

### Aynı WiFi'ye Bağlan
1. Bilgisayar ve telefon aynı WiFi'de
2. Bilgisayar IP'sini bul:
```bash
ipconfig  # Windows
ifconfig  # Mac/Linux
```

3. API URL'i güncelle:
```javascript
const API_BASE_URL = 'http://192.168.1.100:3000';
```

## ✅ Her Şey Hazır!

Artık sahaya çıkabilirsiniz:
1. Hat seç
2. Yön seç
3. Durakları doğrula
4. Dashboard'dan izle

**Başarılar! 🚀**
