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

Tarayıcıda: **http://localhost:3000/dashboard**

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
| GET | `/api/sites` | Tüm siteler |
| POST | `/api/sites` | Site oluştur / güncelle |
| GET | `/site/:slug` | Özelleştirilmiş HTML site |

Veriler `backend/data/sites.json` dosyasında saklanır.
# Appointment_System
