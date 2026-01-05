# 🚀 Stop Station - Hızlı Başlangıç

## APK Oluşturma & Güncelleme

### ✅ İLK KURULUM TAMAMLANDI

Proje EAS'e bağlandı:
- **Proje ID**: `a6fa4bf5-e6e8-437d-a857-a3f5a8d187e1`
- **Proje URL**: https://expo.dev/accounts/hugoo61/projects/stop-station-mobile
- **Android Keystore**: Oluşturuldu ve EAS'de saklanıyor

**Şu anki build**: https://expo.dev/accounts/hugoo61/projects/stop-station-mobile/builds/f2fac0f9-4575-4b69-a72a-5e386148622c

---

## 📱 APK İndirme

Build tamamlandığında (5-10 dakika):

1. **Yukarıdaki build linkine tıkla** VEYA
2. https://expo.dev/accounts/hugoo61/projects/stop-station-mobile/builds adresine git
3. Son build'i bul ve **"Download"** butonuna tıkla
4. APK'yı telefonuna yükle

---

## 🔄 Güncellemeler (APK yükledikten sonra)

### JavaScript değişiklikleri için (UI, business logic):

```bash
cd mobile
eas update --branch production --message "Yeni özellikler eklendi"
```

✅ **10 saniye sürer**  
✅ **Kullanıcılar uygulama açınca güncellemeyi alır**  
✅ **Yeni APK yüklemeye gerek yok**

### Native değişiklikler için (yeni paket, permission):

```bash
cd mobile
eas build --platform android --profile preview
```

⏰ **5-10 dakika sürer**  
📦 **Yeni APK gerekir**

---

## 🎯 En Sık Kullanacağın Komutlar

```bash
# Kod güncellemesi (her zaman kullan)
eas update --branch production --message "Açıklama"

# Build durumunu kontrol
eas build:list

# Yeni APK (nadiren gerekir)
eas build --platform android --profile preview

# Asset dosyalarını yeniden oluştur (ihtiyaç halinde)
npm run create-assets
```

---

## 📊 Build Durumu

**Aktif build**: https://expo.dev/accounts/hugoo61/projects/stop-station-mobile/builds/f2fac0f9-4575-4b69-a72a-5e386148622c

Tüm build'ler:
https://expo.dev/accounts/hugoo61/projects/stop-station-mobile/builds

---

## ⚡ Özet

1. ✅ **Build çalışıyor** (5-10 dakika)
2. 📥 **Build bitince yukarıdaki linkten APK'yı indir**
3. 📱 **Telefonuna yükle**
4. 🔄 **Sonraki güncellemeler için**: `eas update --branch production`

Artık her değişiklikten sonra sadece `eas update` komutunu çalıştırman yeterli! 🎉

