# راهنمای انتشار و Release

این سند هر آنچه برای انتشار نسخه جدید، آپلود روی گیت‌هاب و داکر هاب، و مدیریت ورژن‌ها لازم است را توضیح می‌دهد.

## جدول محتوا

1. [شماره‌گذاری نسخه](#شماره‌گذاری-نسخه)
2. [پیش‌نیازها](#پیش‌نیازها)
3. [انتشار با یک فرمان](#انتشار-با-یک-فرمان)
4. [انتشار دستی گام‌به‌گام](#انتشار-دستی-گامبهگام)
5. [محیط لوکال با Docker](#محیط-لوکال-با-docker)
6. [CI روی گیت‌هاب](#ci-روی-گیتهاب)
7. [نکات مهم](#نکات-مهم)

---

## شماره‌گذاری نسخه

از **Semantic Versioning** استفاده می‌کنیم: `MAJOR.MINOR.PATCH`

- **MAJOR**: تغییرات ناسازگار یا بازطراحی بزرگ.
- **MINOR**: قابلیت جدید به‌صورت سازگار با قبل.
- **PATCH**: رفع باگ و اصلاحات جزئی.

شماره نسخه در **یک منبع واحد** نگهداری می‌شود:

- `frontend/src/lib/version.ts` → `APP_VERSION` (نمایش در صفحه «درباره برنامه» و تاریخچه)
- تگ گیت: `v1.7.0`
- تگ داکر هاب: `meysam8498/hr-kpi-platform:backend-v1.7.0` و `...:frontend-v1.7.0`
- تگ `-latest` همیشه به آخرین نسخه اشاره می‌کند.

> **قانون طلایی:** قبل از هر Release، `APP_VERSION` در `version.ts` را با تگ گیت هماهنگ کنید و یک آیتم به `CHANGELOG` اضافه کنید؛ در غیر این صورت `release.sh` خطا می‌دهد.

---

## پیش‌نیازها

```bash
# ۱) ورود به داکر هاب
docker login -u meysam8498

# ۲) احراز هویت گیت‌هاب (برای push و ساخت Release)
gh auth login        # یا یک Personal Access Token با scope های repo و workflow
```

اطلاعات حساب‌ها:

| سرویس | حساب | آدرس |
|---|---|---|
| گیت‌هاب | `meysam8498` | https://github.com/meysam8498/hr-kpi-platform |
| داکر هاب | `meysam8498` | https://hub.docker.com/u/meysam8498 |
| لینکدین | Meysam Ijadi | https://linkedin.com/in/meysam-ijadi-920817127/ |

---

## انتشار با یک فرمان

```bash
# نسخه را خودکار از آخرین تگ + ۱ می‌سازد
bash release.sh

# یا با نسخه مشخص
bash release.sh v1.8.0
```

این اسکریپت این مراحل را انجام می‌دهد:

1. چک تمیز بودن گیت (در صورت وجود تغییرات، خودکار commit می‌کند).
2. `git commit + push` با تگ نسخه.
3. ساخت ایمیج‌های Docker.
4. `tag + push` به داکر هاب (نسخه‌دار + `-latest`).
5. حذف ایمیج‌های قدیمی از محیط لوکال.
6. اجرای مجدد stack با نسخه جدید و بررسی سلامت.

---

## انتشار دستی گام‌به‌گام

### گام ۱ — هماهنگ‌سازی نسخه

در `frontend/src/lib/version.ts`:

```ts
export const APP_VERSION = '1.8.0'
```

و یک آیتم جدید در ابتدای `CHANGELOG` اضافه کنید.

### گام ۲ — commit و push

```bash
git add -A
git commit -m "Release v1.8.0"
git tag v1.8.0
git push origin main
git push origin v1.8.0
```

### گام ۳ — ساخت و push ایمیج‌های داکر

```bash
docker compose build
docker tag kpi-calc-backend:latest  meysam8498/hr-kpi-platform:backend-v1.8.0
docker tag kpi-calc-frontend:latest meysam8498/hr-kpi-platform:frontend-v1.8.0
docker tag kpi-calc-backend:latest  meysam8498/hr-kpi-platform:backend-latest
docker tag kpi-calc-frontend:latest meysam8498/hr-kpi-platform:frontend-latest

docker push meysam8498/hr-kpi-platform:backend-v1.8.0
docker push meysam8498/hr-kpi-platform:frontend-v1.8.0
docker push meysam8498/hr-kpi-platform:backend-latest
docker push meysam8498/hr-kpi-platform:frontend-latest
```

### گام ۴ — پاک‌سازی ایمیج‌های قدیمی لوکال

```bash
docker images --format "{{.Repository}}:{{.Tag}}" \
  | grep -E "^meysam8498/hr-kpi-platform:(backend|frontend)-v" \
  | grep -v "v1.8.0" \
  | xargs -r docker rmi
```

### گام ۵ — اجرای stack جدید

```bash
docker compose up -d
docker compose ps        # هر دو باید healthy باشند
```

### گام ۶ — ساخت Release در گیت‌هاب

```bash
gh release create v1.8.0 \
  --title "v1.8.0 — <عنوان>" \
  --notes-file RELEASE_NOTES.md
```

قالب یادداشت Release در `RELEASE_NOTES.md` موجود است.

---

## محیط لوکال با Docker

```bash
docker compose up -d --build
# فرانت‌اند: http://localhost:3000
# بک‌اند:    http://localhost:8000/docs
```

حساب‌های پیش‌فرض:

| نقش | نام کاربری | رمز | توضیح |
|---|---|---|---|
| مدیر سیستم | `admin` | `admin123` | دسترسی کامل |
| منابع انسانی | `hr` | `hr123` | همه‌چیز به‌جز مدیریت کاربر |

> در اولین ورود، سیستم شما را به تغییر رمز هدایت می‌کند.

---

## CI روی گیت‌هاب

فایل `.github/workflows/ci.yml` در هر push:

- تست‌های بک‌اند (`pytest`)
- تایپ‌چک و build فرانت‌اند (`tsc --noEmit` و `next build`)

برای فعال‌سازی، توکن گیت‌هاب باید scope ی `workflow` را داشته باشد.

---

## نکات مهم

- **منبع واحد نسخه:** `version.ts` و تگ گیت و تگ داکر همیشه هماهنگ باشند.
- **پاک‌سازی لوکال:** بعد از هر Release، ایمیج‌های قدیمی از محیط لوکال حذف می‌شوند.
- **هیچ راز/توکنی** در ریپو یا اسکریپت ذخیره نمی‌شود؛ از credential manager یا `gh` استفاده کنید.
- **لایسنس:** MIT — فایل `LICENSE` را ببینید.
