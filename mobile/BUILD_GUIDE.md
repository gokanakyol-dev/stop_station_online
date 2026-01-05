# Stop Station Mobile - APK Build & Güncelleme Kılavuzu

## 📱 APK Oluşturma (İlk Kurulum)

### Seçenek 1: EAS Build (Önerilen - Bulutta Build)

1. **EAS'e giriş yap:**
```bash
cd mobile
eas login
```

2. **Proje yapılandır:**
```bash
eas build:configure
```

3. **Preview APK oluştur (Test için):**
```bash
eas build --platform android --profile preview
```

4. **Production APK oluştur:**
```bash
eas build --platform android --profile production
```

Build tamamlandığında linkten APK'yı indirebilirsin.

---

### Seçenek 2: Yerel Build (Bilgisayarında)

**Gereksinimler:**
- Android Studio kurulu olmalı
- Java JDK 17 kurulu olmalı

```bash
cd mobile
npx expo run:android --variant release
```

APK şurada olacak: `mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 🔄 Uygulama Güncellemeleri

### Yöntem 1: EAS Update (OTA - Over The Air)

**Avantajlar:**
- Yeni APK yüklemeden güncelleme
- Anında güncelleme
- JavaScript/React kodları için

**Kullanımı:**

1. **app.json'da EAS Update'i aktifleştir:**

```json
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/[PROJECT_ID]"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "extra": {
      "eas": {
        "projectId": "[PROJECT_ID]"
      }
    }
  }
}
```

2. **Güncelleme yayınla:**

```bash
cd mobile
eas update --branch production --message "Durak arama özelliği eklendi"
```

3. **Kullanıcılar uygulamayı açtığında güncelleme otomatik inecek!**

---

### Yöntem 2: Expo Publish (Klasik - Ücretsiz)

**Kullanımı:**

```bash
cd mobile
npx expo publish
```

Uygulamayı açan kullanıcılar güncellemeleri otomatik alacak.

---

## 🚀 Hızlı Başlangıç

### İlk Kez APK Oluşturma:

```bash
# 1. EAS CLI kur (zaten kurulu)
npm install -g eas-cli

# 2. Giriş yap
cd mobile
eas login

# 3. Build başlat
eas build --platform android --profile preview

# 4. QR kod ile build'i takip et
# Build tamamlanınca linke tıklayıp APK'yı indir
```

### Güncellemeler için (APK yükledikten sonra):

**Kod değişikliği yaptın:**
```bash
cd mobile
eas update --branch production --message "Yeni özellikler eklendi"
```

**Native kod değişikliği (package, plugin ekleme):**
```bash
eas build --platform android --profile preview
# Yeni APK gerekli
```

---

## 📋 Build Profilleri

### eas.json dosyası:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

- **preview**: Test APK (dahili dağıtım)
- **production**: Yayın APK (Google Play)

---

## 🔧 Sık Yapılan İşlemler

### 1. Kod güncelleme (UI, business logic):
```bash
eas update --branch production --message "Açıklama"
```

### 2. Paket ekleme/çıkarma:
```bash
npm install yeni-paket
eas build --platform android --profile preview
```

### 3. Versiyon güncellemesi:
```json
// app.json
{
  "expo": {
    "version": "1.0.1"
  }
}
```
```bash
eas build --platform android --profile production
```

---

## ⚡ En Kolay Yöntem (Senin için)

### İlk Kurulum:
```bash
cd mobile
eas login
# Email/şifre ile giriş yap

eas build --platform android --profile preview
# Build başlar, 5-10 dakika sürer
# Link gelince APK'yı indir ve telefonuna yükle
```

### Her Güncelleme Sonrası:
```bash
cd mobile
eas update --branch production --message "Güncelleme açıklaması"
# 10 saniye sürer, kullanıcılar uygulama açınca güncellemeyi alır
```

---

## 📞 Önemli Notlar

1. **JavaScript değişiklikleri** → `eas update` yeterli
2. **Native değişiklikler** (yeni plugin, permission) → Yeni `eas build` gerekli
3. **İlk build** 5-15 dakika sürer (bulutta)
4. **Güncellemeler** 10 saniye sürer
5. **Ücretsiz plan**: Ayda 30 build hakkı

---

## 🎯 Şu Anda Yapman Gerekenler

1. **Expo hesabı aç** (henüz yoksa): https://expo.dev
2. **Giriş yap**: `eas login`
3. **İlk build'i başlat**: `eas build --platform android --profile preview`
4. **APK'yı indir ve telefonuna yükle**

Artık her güncelleme için sadece şunu yapacaksın:
```bash
eas update --branch production --message "Yeni özellikler"
```

Telefonundaki uygulama bir sonraki açılışta güncel olacak! 🚀
