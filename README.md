# Randevu Sistemi — Site Oluşturucu

Basit bir dashboard ile firma bilgilerinizi girin; sistem bu bilgilerle özelleştirilmiş bir randevu web sitesi üretir.

## Yapı

```
appointment_system/
├── backend/          # Express + TypeScript API
├── dashboard/        # Yönetim paneli (HTML/CSS/JS)
└── site-template/    # Müşteri sitesi şablonu (HTML/CSS)
```

## Kurulum

```bash
cd backend
npm install
npm run dev
```

Tarayıcıda: **http://localhost:3000/dashboard**

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
