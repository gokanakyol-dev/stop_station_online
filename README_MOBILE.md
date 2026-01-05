# 🚌 STOP STATION - Mobil Durak Doğrulama Sistemi

Toplu taşıma hatlarındaki durakları **sahada gerçek zamanlı doğrulayan**, GPS tabanlı mobil uygulama ve yönetim sistemi.

## 🎯 SİSTEMİN AMACI

Bu sistem, toplu taşıma durak verilerini:
- **Sahada** doğrular
- **Gerçek kullanıma** göre günceller
- **İnsan + Algoritma** gücünü birleştirir
- **Offline çalışabilir**

## 🏗️ SİSTEM MİMARİSİ

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFLINE ANALİZ                           │
│  30 günlük GPS verisi → Route çıkarma → Durak adayları     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Supabase)                        │
│  • Route ve durak verileri                                  │
│  • Saha aksiyonlarını kaydet                                │
│  • API endpoints (CORS destekli)                            │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────────┐           ┌──────────────────────┐
│   MOBİL UYGULAMA     │           │   WEB DASHBOARD      │
│   (React Native)     │           │   (HTML/CSS/JS)      │
│                      │           │                      │
│  • Hat & yön seçimi  │           │  • Saha verileri     │
│  • GPS tracking      │           │  • İstatistikler     │
│  • Route projection  │           │  • Filtreler         │
│  • Durak onay/red    │           │  • Renk kodları      │
│  • Yeni durak ekle   │           │                      │
│  • Offline destek    │           │                      │
└──────────────────────┘           └──────────────────────┘
```

## 📁 PROJE YAPISI

```
stop_station/
├── mobile/                    # 📱 React Native Mobil Uygulama
│   ├── src/
│   │   ├── screens/
│   │   │   ├── RouteSelectionScreen.js    # Hat seçimi
│   │   │   └── FieldMapScreen.js          # Saha harita (ANA EKRAN)
│   │   ├── services/
│   │   │   └── api.js                     # Backend API client
│   │   └── utils/
│   │       └── routeProjection.js         # Route projection algoritması
│   ├── App.js
│   ├── package.json
│   └── app.json
│
├── server/                    # 🖥️ Backend API
│   ├── api/
│   │   ├── routes.js         # Route API endpoints
│   │   └── field.js          # Saha işlem endpoints
│   ├── index.js
│   └── supabaseClient.js
│
├── public/                    # 🌐 Web Dashboard
│   ├── dashboard.html
│   ├── css/
│   │   └── dashboard.css
│   ├── js/
│   │   └── dashboard.js
│   └── pipeline/
│       └── routeProjection.js    # Backend projection algoritması
│
└── database/
    └── schema.sql            # Supabase database şeması
```

## 🚀 KURULUM

### 1️⃣ Backend Kurulumu

```bash
# Dependencies yükle
npm install

# Environment variables (.env dosyası oluştur)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3000
```

**Supabase Database:**
1. [Supabase](https://supabase.com)'da yeni proje oluştur
2. SQL Editor'de `database/schema.sql` dosyasını çalıştır
3. API Keys'i kopyala

**Backend'i çalıştır:**
```bash
npm start
```

Backend şu adreste çalışacak: `http://localhost:3000`

### 2️⃣ Mobil Uygulama Kurulumu

```bash
cd mobile

# Dependencies yükle
npm install

# API URL'ini ayarla (src/services/api.js)
# Development: http://localhost:3000
# Production: https://your-app.onrender.com

# Expo ile çalıştır
npx expo start
```

**Cihazda test etmek için:**
- iOS: Expo Go uygulamasını App Store'dan indir
- Android: Expo Go uygulamasını Play Store'dan indir
- QR kodu tara

### 3️⃣ Dashboard

Browser'da aç: `http://localhost:3000/dashboard.html`

## 📱 MOBİL UYGULAMA KULLANIMI

### Adım 1: Hat ve Yön Seçimi
1. Uygulamayı aç
2. Listeden hattı seç (örn: **10 - Konak - Bornova**)
3. **GİDİŞ** veya **DÖNÜŞ** seç

### Adım 2: Sahaya Çık
1. Araca bin
2. GPS açık olsun
3. Harita ekranı açılır

### Adım 3: Saha Çalışması
Uygulama otomatik olarak:
- GPS konumunu route'a projektler
- İlerideki durakları gösterir
- Uyarıları verir

**Kullanıcı yapar:**
- Durak marker'ına dokun
- ✅ **ONAYLA** veya ❌ **REDDET**
- Yeni durak eklemek için: **+ DURAK EKLE**

### Uyarı Tipleri
- 📍 **38 m ileride durak var** → Bilgi
- ⚠ **Güzergaha 18 m uzak** → Uyarı
- ℹ️ **Durak güzergahın SOL tarafında** → Bilgi

> **ÖNEMLİ:** Hiçbir uyarı engelleyici değildir. Karar her zaman kullanıcıda.

## 🧠 ROUTE PROJECTION ALGORİTMASI

Sistemin kalbi `routeProjection.js` dosyasındaki algoritmadır:

```javascript
// GPS noktası
const gpsPoint = { lat: 38.4237, lon: 27.1428 };

// Route skeleton (önceden hesaplanmış)
const skeleton = [
  { lat: 38.4235, lon: 27.1425, route_s: 0 },
  { lat: 38.4240, lon: 27.1430, route_s: 50.3 },
  // ...
];

// Projeksiyon
const projection = projectToRoute(gpsPoint, skeleton);

// Sonuç:
{
  route_s: 3245.7,           // Route boyunca mesafe (m)
  lateral_offset: 8.2,       // Route'a dik uzaklık (m)
  side: "RIGHT",             // Hangi tarafta
  nearest_point: {           // Route üzerindeki en yakın nokta
    lat: 38.4238,
    lon: 27.1429
  }
}
```

### Algoritma Adımları:
1. Her segment için GPS noktasını projektlet
2. En küçük mesafeyi bul
3. Route_s hesapla (kümülatif mesafe)
4. Cross product ile LEFT/RIGHT belirle

## 🎨 DASHBOARD ÖZELLİKLERİ

### İstatistikler
- ✅ **Onaylanan** (Yeşil)
- ❌ **Reddedilen** (Kırmızı)
- ➕ **Eklenen** (Mavi)
- 📊 **Toplam İşlem** (Sarı)

### Filtreler
- Hat
- Yön (Gidiş/Dönüş)
- İşlem tipi

### İşlem Listesi
Her işlem için:
- Timestamp
- Durak adı
- Route S değeri
- Lateral offset
- Sol/Sağ bilgisi
- Ret nedeni (varsa)

## 🔌 API ENDPOINTS

### Routes
```http
GET /api/routes
# Tüm hatları listeler

GET /api/routes/:routeId/direction/:direction
# Belirli hat + yön için route ve duraklar
```

### Field Actions
```http
POST /api/field/stops/approve
# Durağı onayla

POST /api/field/stops/reject
# Durağı reddet

POST /api/field/stops/add
# Yeni durak ekle

GET /api/field/actions?route_id=&direction=&user_id=
# Saha aksiyonlarını getir
```

## 🗄️ DATABASE ŞEMASI

### Temel Tablolar

**routes** - Hat bilgileri
- id, route_number, route_name
- directions (JSONB) → polyline, skeleton

**stops** - Duraklar
- route_id, direction, name
- lat, lon, route_s, lateral_offset, side
- field_verified, field_rejected, field_added

**field_actions** - Saha işlemleri
- action_type (APPROVE/REJECT/ADD)
- stop_id, route_id, direction
- user_id, timestamp
- field_lat, field_lon, route_s

## 🌐 DEPLOYMENT

### Backend (Render.com)
1. GitHub'a push et
2. Render.com'da yeni Web Service oluştur
3. Environment variables ekle:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Deploy

### Mobil (Expo)
```bash
# Production build
cd mobile
npx expo build:android
npx expo build:ios

# Veya publish
npx expo publish
```

## 🔒 GÜVENLİK

### API Güvenliği
- CORS aktif (mobil app izinli)
- Supabase Row Level Security (RLS) kullan
- API key'leri environment variable'da sakla

### Offline Queue
Mobil uygulama offline çalışır:
- İşlemler AsyncStorage'da saklanır
- Online olunca otomatik sync olur

## 🐛 SORUN GİDERME

### "Routes yüklenemedi"
- Backend çalışıyor mu? (`http://localhost:3000/api/routes`)
- Supabase bağlantısı doğru mu?
- CORS ayarları aktif mi?

### GPS çalışmıyor
- Location permissions verildi mi?
- Cihaz GPS'i açık mı?
- iOS: Privacy - Location Always Usage açıklaması var mı?

### Projeksiyon yanlış
- Skeleton doğru mu?
- Polyline noktaları sıralı mı?
- GPS accuracy yeterli mi?

## 📊 VERİ AKIŞI

```
GPS Verileri (30 gün)
    ↓
[Pipeline] Route Construction
    ↓
Polyline + Skeleton
    ↓
[Supabase] routes tablosu
    ↓
[Mobil App] İndirir + Cache
    ↓
[GPS Tracking] Real-time projeksiyon
    ↓
[Saha Personeli] Onay/Red/Ekle
    ↓
[Supabase] field_actions + stops
    ↓
[Dashboard] Görüntüle + Filtrele
```

## 🎯 ÖZELLİKLER

✅ **Offline-first** - İnternet olmadan çalışır  
✅ **Real-time projection** - Anlık GPS projektleme  
✅ **Human-in-loop** - İnsan karar verir, sistem bilgi verir  
✅ **Fast & Simple** - Sade arayüz, hızlı işlem  
✅ **Production-ready** - Render + Supabase deployment  

## 📝 LİSANS

MIT License

## 👨‍💻 YAZAN

Stop Station Development Team

---

**🚀 Sahada başarılar!**
