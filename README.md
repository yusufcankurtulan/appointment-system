# Randevu Sistemi — Site Oluşturucu

Basit bir dashboard ile firma bilgilerinizi girin; sistem bu bilgilerle özelleştirilmiş bir randevu web sitesi üretir.

## Yapı

```
appointment_system/
├── backend/          # Express + TypeScript API
├── dashboard/        # Yönetim paneli (HTML/CSS/JS)
└── site-template/    # Müşteri sitesi şablonu (HTML/CSS)
```

## Kurulum (yerel)

```bash
cd backend
npm install
npm run dev
```

Tarayıcıda: **http://localhost:3000/dashboard** (giriş sayfasına yönlendirir)

### Dashboard girişi

| Ortam | Varsayılan (sadece yerel) |
|-------|---------------------------|
| Kullanıcı | `admin` |
| Şifre | `admin123` |

**Ayarlar** sekmesinden kullanıcı adı, şifre, dashboard başlığı ve yeni site varsayılanlarını değiştirebilirsiniz. Değişiklikler kalıcı olarak saklanır (`admin.json` / Netlify Blobs).

Üretimde `.env.example` dosyasındaki değişkenleri ayarlayın (ilk kurulum için):

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (güçlü şifre)
- `JWT_SECRET` (uzun rastgele metin)

Netlify: **Site settings → Environment variables** bölümüne ekleyin.

## Netlify’da yayınlama

1. GitHub reposunu Netlify’a bağlayın.
2. Build ayarları otomatik `netlify.toml` dosyasından okunur:
   - **Build command:** `npm run build:netlify`
   - **Publish directory:** `public`
3. Deploy sonrası ana sayfa: `https://siteniz.netlify.app/dashboard/`

API ve dinamik müşteri siteleri (`/api/*`, `/site/*`) Netlify Functions üzerinden çalışır. Veriler Netlify Blobs’ta saklanır.

## Kullanım

1. Dashboard’da firma adı, iletişim, hizmetler vb. alanları doldurun.
2. **Siteyi kaydet ve oluştur** ile kaydedin.
3. Oluşan site adresi: `http://localhost:3000/site/firma-slug`

Kayıtlı siteler sağ panelde listelenir; siteyi açabilir veya silebilirsiniz.

## API

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/auth/login` | Dashboard girişi |
| GET/PUT | `/api/settings` | Hesap ayarları (giriş gerekli) |
| GET | `/api/sites` | Tüm siteler (giriş gerekli) |
| POST | `/api/sites` | Site oluştur / güncelle (giriş gerekli) |
| GET | `/site/:slug` | Özelleştirilmiş HTML site (herkese açık) |
| POST | `/api/sites/:slug/appointments` | Müşteri randevusu (herkese açık) |

Veriler `backend/data/` ve Netlify Blobs’ta saklanır.
