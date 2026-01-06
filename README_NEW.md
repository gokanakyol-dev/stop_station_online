# 🚏 Stop Station

GPS tabanlı otomatik durak tespiti ve saha doğrulama sistemi.

## 🌟 Özellikler

### 📍 GPS Durak Tespiti
- GPS CSV verilerinden otomatik durak tespiti
- Clustering algoritması ile durakları gruplandırma
- Yön bazlı (gidiş/dönüş) analiz
- Interaktif harita görünümü
- Pipeline sonuçlarını önizleme ve düzenleme
- Tespit edilen durakları onaylama/reddetme

### 🚌 Hat ve Durak Yönetimi
- Hat ekleme, düzenleme, silme
- Durak ekleme, düzenleme, silme
- Hat ve durak listeleme
- Filtreleme ve arama

### 📊 Saha Kontrol Paneli
- Sahadan gelen doğrulama verilerini görüntüleme
- İstatistikler (Onaylanan, Reddedilen, Eklenen)
- Filtreleme (Hat, Yön, İşlem)
- Harita üzerinde görselleştirme

### 📊 Analitik
- Hat bazlı detaylı istatistikler
- Toplam durak sayısı
- GPS verili/verisiz hatlar
- Hat uzunlukları

### 💾 Import/Export
- Tüm verileri JSON olarak dışa aktarma
- Toplu veri içe aktarma
- Yedekleme ve geri yükleme

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- Supabase hesabı

### Yerel Kurulum

1. Depoyu klonlayın:
```bash
git clone <repo-url>
cd stop_station
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyası oluşturun:
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

4. Sunucuyu başlatın:
```bash
npm start
```

5. Tarayıcıda açın: http://localhost:3000

## 📁 Proje Yapısı

```
stop_station/
├── server/
│   ├── index.js              # Express server
│   ├── supabaseClient.js     # Supabase bağlantısı
│   └── api/
│       └── routes.js         # API endpoints
├── public/
│   ├── index.html            # Ana sayfa
│   ├── js/
│   │   └── app.js           # Frontend mantığı
│   ├── pipeline/
│   │   ├── index.js         # Pipeline orchestration
│   │   ├── cleanGPS.js      # GPS temizleme
│   │   ├── segmentation.js  # Trip segmentation
│   │   ├── directionFilter.js # Yön tespiti
│   │   └── routeConstruction.js # Rota oluşturma
│   └── css/
│       └── style.css
└── package.json
```

## 🗄️ Veritabanı

Supabase PostgreSQL + PostGIS kullanılmaktadır.

### Tablolar:
- `routes` - Hat bilgileri
- `stops` - Durak bilgileri  
- `field_actions` - Saha doğrulama verileri

## 🌐 Deploy

### Vercel'e Deploy (Önerilen)

1. **GitHub'a Push Edin:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/stop-station.git
git push -u origin main
```

2. **Vercel'e Deploy:**
- https://vercel.com adresine gidin
- "New Project" tıklayın
- GitHub repo'nuzu seçin
- Environment Variables ekleyin:
  - `SUPABASE_URL` = your_supabase_url
  - `SUPABASE_KEY` = your_supabase_anon_key
- "Deploy" butonuna tıklayın

3. **Mobil Uygulama Update (Opsiyonel):**
```bash
cd mobile
# .env dosyasına production URL'i ekleyin
API_URL=https://your-app.vercel.app
eas update --branch production
```

### Railway'e Deploy (Alternatif)

1. https://railway.app adresine gidin
2. "New Project" > "Deploy from GitHub repo"
3. Environment Variables ekleyin
4. Deploy edin

## 📱 Mobil Uygulama

React Native/Expo ile geliştirilmiş mobil uygulama `mobile/` klasöründe bulunmaktadır.

### Mobil Uygulamayı Çalıştırma:
```bash
cd mobile
npm install
npx expo start
```

## 🛠️ Teknolojiler

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Bootstrap 5, Leaflet
- **Veritabanı**: Supabase (PostgreSQL + PostGIS)
- **Mobil**: React Native, Expo
- **Deploy**: Vercel

## 📄 API Endpoints

- `GET /api/routes` - Tüm hatları listele
- `POST /api/routes` - Yeni hat ekle
- `PUT /api/routes/:id` - Hat güncelle
- `DELETE /api/routes/:id` - Hat sil
- `GET /api/stops/all` - Tüm durakları listele
- `POST /api/stops` - Yeni durak ekle
- `PUT /api/stops/:id` - Durak güncelle
- `DELETE /api/stops/:id` - Durak sil
- `GET /api/analytics/summary` - Genel istatistikler
- `GET /api/analytics/routes` - Hat bazlı istatistikler
- `GET /api/export/all` - Tüm verileri export
- `POST /api/import/all` - Toplu veri import

## 📝 Lisans

MIT

## 👥 Katkıda Bulunma

Pull request'ler memnuniyetle karşılanır!

## 📞 İletişim

Sorularınız için issue açabilirsiniz.
