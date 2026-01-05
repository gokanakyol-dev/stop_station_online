# ⚠️ ÖNEMLİ NOTLAR - MUTLAKA OKUYUN

## 🔴 KURULUM ÖNCESİ

### 1. Node.js Kurulumu
Sisteminizde Node.js yüklü olmalı (v16 veya üzeri):
```bash
node --version
```

Yoksa: https://nodejs.org/

### 2. Expo CLI Kurulumu
```bash
npm install -g expo-cli
```

### 3. Git Kurulumu (Deploy için)
```bash
git --version
```

## 🔴 İLK ADIMLAR

### Backend Paketlerini Yükle
```bash
# Ana klasörde
npm install
```

**ÖNEMLİ:** Eğer `cors` hatası alırsanız:
```bash
npm install cors
```

### .env Dosyası Oluştur
Ana klasörde `.env` dosyası oluşturun:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
PORT=3000
```

### Mobil Paketlerini Yükle
```bash
cd mobile
npm install
```

## 🔴 SUPABASE KURULUMU

### 1. Proje Oluştur
1. https://supabase.com → Sign up
2. "New Project" butonuna tıkla
3. Proje adı: `stop-station`
4. Database password: Güçlü bir şifre
5. Region: En yakın (Europe West)

### 2. Database Şemasını Yükle
1. Supabase Dashboard → SQL Editor
2. `database/schema.sql` dosyasını kopyala
3. Paste et ve "Run" tıkla
4. ✅ Tablolar oluşturuldu

### 3. API Keys
1. Settings → API
2. **URL** ve **service_role key** kopyala
3. `.env` dosyasına yapıştır

## 🔴 İLK TEST

### Backend Test
```bash
npm start
```

Browser'da: `http://localhost:3000/api/routes`

Sonuç: `{"routes": []}`  ✅ (Henüz route yok, normal)

### Mobil Test
```bash
cd mobile
npx expo start
```

QR kod görünmeli ✅

**Mobil test için:**
- iOS: App Store → "Expo Go" indir
- Android: Play Store → "Expo Go" indir
- QR kodu tara

## 🔴 VERİ EKLENMESİ

### Test Route Ekle
Supabase SQL Editor:

```sql
-- Test route ekle
INSERT INTO routes (route_number, route_name, directions)
VALUES (
  'TEST',
  'Test Hattı',
  '{
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
      ],
      "total_length": 100
    }
  }'::jsonb
);

-- Test durak ekle
INSERT INTO stops (route_id, direction, name, lat, lon, route_s, lateral_offset, side)
SELECT 
  id,
  'gidis',
  'Test Durağı',
  38.4240,
  27.1430,
  50,
  5,
  'RIGHT'
FROM routes WHERE route_number = 'TEST';
```

### Gerçek Verilerinizi Eklemek İçin

Eğer mevcut sisteminizde pipeline'dan çıkan route verileri varsa:

```javascript
// Örnek route verisi
const routeData = {
  route_number: '10',
  route_name: 'Konak - Bornova',
  directions: {
    gidis: {
      polyline: [...], // GPS noktaları
      skeleton: [...], // route_s ile
      total_length: 12500
    },
    donus: {
      polyline: [...],
      skeleton: [...],
      total_length: 12300
    }
  }
};

// Supabase'e ekle
await supabase.from('routes').insert([routeData]);
```

## 🔴 MOBIL APP AYARLARI

### API URL Ayarı

**Geliştirme (Localhost):**

`mobile/src/services/api.js`:
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'  // ✅ Bu ayar
  : 'https://your-app.onrender.com';
```

**Fiziksel Cihaz Test:**

Bilgisayarınızın IP'sini bulun:
```bash
ipconfig  # Windows
ifconfig  # Mac/Linux
```

Örnek: `192.168.1.100`

`mobile/src/services/api.js`:
```javascript
const API_BASE_URL = 'http://192.168.1.100:3000';
```

**Android Emulator:**
```javascript
const API_BASE_URL = 'http://10.0.2.2:3000';
```

## 🔴 SIKÇA KARŞILAŞILAN HATALAR

### "Cannot find module 'cors'"
```bash
npm install cors
```

### "Network request failed"
- Backend çalışıyor mu kontrol et
- API URL doğru mu?
- Aynı WiFi'ye bağlı mısınız?

### "Location permission denied"
- Cihaz ayarlarından izin ver
- iOS: Settings → Privacy → Location Services
- Android: Settings → Apps → Expo Go → Permissions

### "Routes yüklenemedi"
- Supabase bağlantısı doğru mu?
- `.env` dosyası var mı?
- Backend console'da hata var mı?

### Expo QR kod çalışmıyor
```bash
# Tunnel mode dene
npx expo start --tunnel
```

## 🔴 GELİŞTİRME İPUÇLARI

### 1. Console Logları
Backend'de:
```javascript
console.log('Route fetched:', routeData);
```

Mobil'de:
```javascript
console.log('Projection:', projection);
```

Expo'da: "Remote JS Debugging" aç

### 2. Database Kontrol
Supabase Dashboard → Table Editor

Her tabloyu görsel olarak kontrol edebilirsiniz.

### 3. API Test
Postman veya curl:
```bash
curl http://localhost:3000/api/routes
```

### 4. Hot Reload
Kod değişince otomatik yenilenir.
Eğer çalışmazsa: Expo'da "r" tuşuna bas (reload)

## 🔴 PRODUCTION HAZIRLIK

### Before Deploy Checklist
- [ ] Test data temizlendi
- [ ] Environment variables güvenli
- [ ] Icons/Splash screens eklendi
- [ ] Privacy policy hazırlandı
- [ ] Error handling eklendi
- [ ] Loading states düzgün
- [ ] Offline scenario test edildi

### Deployment
`DEPLOYMENT.md` dosyasını takip edin.

## 🔴 DESTEK

### Dökümantasyon
1. **SUMMARY.md** - Sistem özeti
2. **README_MOBILE.md** - Detaylı açıklama
3. **QUICKSTART.md** - Hızlı başlangıç
4. **DEPLOYMENT.md** - Production
5. Bu dosya - Önemli notlar

### Sorun mu yaşıyorsunuz?

1. Console'ları kontrol et (Backend + Mobil)
2. Network tab'ı kontrol et
3. Supabase logs kontrol et
4. Google'da ara
5. GitHub Issues oluştur

## 🎯 İLK ADIMLAR ÖZETİ

```bash
# 1. Backend
npm install
# .env dosyası oluştur
npm start

# 2. Supabase
# Web'de proje oluştur
# schema.sql çalıştır
# Test data ekle

# 3. Mobil
cd mobile
npm install
# API URL ayarla
npx expo start

# 4. Test
# Expo Go ile QR tara
# Hat seç → Test!
```

## 🚨 CRİTİCAL

### ASLA GitHub'a Pushlama:
- `.env` dosyası
- Supabase keys
- Production credentials

### .gitignore Kontrol:
```
.env
.env.local
mobile/.expo/
node_modules/
```

---

**✅ Artık hazırsınız!**

Herhangi bir sorun yaşarsanız, yukarıdaki adımları takip edin.

**Başarılar! 🚀**
