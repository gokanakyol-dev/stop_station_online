# 🚀 DEPLOYMENT GUIDE

## Backend Deployment (Render.com)

### 1. GitHub'a Push
```bash
git add .
git commit -m "Mobile system ready"
git push origin main
```

### 2. Render.com Setup
1. https://render.com → Sign up/Login
2. **New** → **Web Service**
3. GitHub repository'yi bağla
4. Ayarlar:
   - **Name**: `stop-station-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Environment Variables
Settings → Environment → Add:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
PORT=3000
```

### 4. Deploy
- **Manual Deploy** butonuna tıkla
- Deploy loglarını izle
- URL: `https://stop-station-api.onrender.com` ✅

### 5. Test Et
```bash
curl https://stop-station-api.onrender.com/api/routes
```

## Mobil App Deployment

### Option 1: Expo Go (Development)
Kullanıcılar Expo Go ile kullanabilir:
```bash
cd mobile
npx expo publish
```

QR kod paylaş → Kullanıcılar Expo Go ile tara

### Option 2: Standalone Build (Production)

#### Android APK
```bash
cd mobile
npx expo build:android
```

Build tamamlanınca:
1. APK indir
2. Google Play Store'a yükle
3. Veya direkt APK dağıt

#### iOS IPA
```bash
cd mobile
npx expo build:ios
```

Build için Apple Developer account gerekli ($99/yıl)

### Option 3: EAS Build (Önerilen)
```bash
npm install -g eas-cli
eas login
eas build --platform android
```

Daha hızlı ve güvenilir build sistemi.

## Production Checklist

### Backend
- [ ] Environment variables set edildi
- [ ] CORS ayarları doğru
- [ ] Database indexes oluşturuldu
- [ ] Error logging eklendi
- [ ] Rate limiting (opsiyonel)

### Mobil
- [ ] API URL production'a güncellendi
- [ ] Icons/Splash screens eklendi
- [ ] App store açıklamaları hazırlandı
- [ ] Privacy policy (GPS kullanımı için gerekli)
- [ ] Test data temizlendi

### Supabase
- [ ] Row Level Security aktif
- [ ] Backup ayarlandı
- [ ] API usage limits kontrol edildi

## Supabase RLS (Row Level Security)

Production'da SQL'i çalıştır:

```sql
-- Routes: Herkes okuyabilir
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public routes" ON routes FOR SELECT USING (true);

-- Stops: Herkes okuyabilir, authenticated yazabilir
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public stops read" ON stops FOR SELECT USING (true);
CREATE POLICY "Auth stops write" ON stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth stops update" ON stops FOR UPDATE TO authenticated USING (true);

-- Field Actions: Sadece authenticated yazabilir
ALTER TABLE field_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth actions" ON field_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public actions read" ON field_actions FOR SELECT USING (true);
```

## Monitoring

### Render.com
- Dashboard → Logs
- Metrics: CPU, Memory, Response time
- Email alerts ayarla

### Supabase
- Dashboard → Database → Tables
- API → Logs
- Usage stats

### Expo
- expo.dev → Projects
- Analytics
- Crash reports

## Güncelleme Prosedürü

### Backend Güncellemesi
```bash
git add .
git commit -m "Update feature"
git push origin main
```
Render otomatik deploy eder.

### Mobil Güncelleme (OTA - Over The Air)
```bash
cd mobile
npx expo publish
```
Kullanıcılar uygulamayı yeniden açtığında güncelleme indirilir.

**Not:** Native kod değişirse (package.json dependencies) yeni build gerekir.

## Backup Stratejisi

### Supabase Backup
1. Dashboard → Database → Backups
2. Daily automatic backups (Pro plan)
3. Manuel export:
```bash
supabase db dump > backup.sql
```

### Code Backup
- GitHub (zaten yapılıyor)
- Git tags kullan:
```bash
git tag -a v1.0.0 -m "Production release"
git push --tags
```

## Rollback

### Backend
Render Dashboard → Deploy → Previous version

### Mobil
```bash
npx expo publish --release-channel previous
```

### Database
Supabase → Backups → Restore

## Costs (Tahmini)

### Free Tier
- **Render**: Free plan (sleep after inactivity)
- **Supabase**: 500MB database, 2GB bandwidth
- **Expo**: Unlimited development builds
- **Total**: $0/month

### Production Tier
- **Render Pro**: $7/month (always-on)
- **Supabase Pro**: $25/month (8GB database)
- **Apple Developer**: $99/year (iOS için)
- **Google Play**: $25 (one-time, Android için)
- **Total**: ~$50/month + stores

## Domain Setup (Opsiyonel)

### Custom Domain
1. Domain satın al (Namecheap, GoDaddy)
2. Render → Settings → Custom Domain
3. DNS records ekle:
```
A record: 216.24.57.1
CNAME: stop-station-api.onrender.com
```

API URL: `https://api.stopstation.com`

## SSL/HTTPS
Render otomatik Let's Encrypt SSL sağlar ✅

## Support & Updates

### Documentation
- README_MOBILE.md
- QUICKSTART.md
- Bu deployment guide

### User Support
- In-app feedback formu ekle
- Email: support@stopstation.com
- GitHub Issues

---

**🎉 Production'a hoş geldiniz!**
