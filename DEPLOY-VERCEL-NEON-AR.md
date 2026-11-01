# النشر على Vercel + Neon (نسخة 3.9)

الموقع هنا بيشتغل كدالة واحدة على Vercel (`api/index.mjs`) والبيانات والصور كلها في Neon (Postgres). مفيش قرص ولا SQLite.

## 1) جهّز قاعدة Neon
1. في Neon: **Connect** ← اختار **Connection pooling** شغّال ← انسخ الـ connection string (لازم فيه `-pooler`).
2. لو الباسورد اتعرض قبل كده في أي شات/صورة: **Reset password** الأول وخد الرابط الجديد.
3. الجداول القديمة الفاضية (`audit_log`, `products`, `settings`) احذفها من **SQL Editor** عشان الأنواع تتطابق:
   `DROP TABLE IF EXISTS audit_log, products, settings CASCADE;`

## 2) أنشئ الجداول وحساب الإدارة (من جهازك، مرة واحدة)
محتاج Node 22.9+ على جهازك. من فولدر المشروع:
```sh
npm install
cp .env.example .env        # وحط DATABASE_URL الحقيقي جوه .env
npm run db:setup
npm run admin:create -- --email=بريدك-الخاص@example.com
```
ملف `.env` مش بيترفع على GitHub (موجود في `.gitignore`). بعد `npm install` اعمل commit لـ `package-lock.json` الجديد.

## 3) ارفع على GitHub
انسخ محتويات الفولدر فوق الـ repo (الأفضل يبقى **Private**) واعمل commit + push.

## 4) Vercel
1. **Add New → Project** ← اختار الـ repo. سيب الإعدادات الافتراضية (`vercel.json` بيظبط كل حاجة).
2. **Environment Variables**:
   - `DATABASE_URL` = رابط Neon (الـ pooler).
   - `APP_ORIGIN` = عنوان الموقع بالظبط، مثل `https://cash-tech.vercel.app` (أو دومينك لما تربطه). لو سبته فاضي بيستخدم دومين المشروع الأساسي.
3. **Deploy**. افتح `https://عنوانك/healthz` لازم يرجع `{"ok":true}`، وبعدها `/admin`.

## ملاحظات
- أول طلب بعد فترة خمول ممكن ياخد ثواني (Neon المجاني بينام). عادي.
- أكبر حجم رفع على Vercel حوالي 4.5 ميجا؛ الموقع بيصغّر الصور في المتصفح قبل الرفع فمش مشكلة غالبًا.
- ربط دومين: Vercel ← Settings ← Domains، وبعدها غيّر `APP_ORIGIN` للدومين الجديد وأعد النشر.
- نسخ احتياطي: `npm run backup` من جهازك بيسحب المنتجات والإعدادات والصور لفولدر `backups/`. وNeon كمان بيحتفظ بسجل للاستعادة.
- فك قفل الدخول: `npm run admin:unlock` من جهازك.
- شروط Vercel: الخطة المجانية (Hobby) للاستخدام غير التجاري حسب علمي؛ راجع شروطهم قبل ما تشغّل المحل فعليًا.
- التشغيل المحلي للتجربة: `npm run build && npm start` (بيستخدم نفس قاعدة Neon، فيفضل تعمل Branch للتجارب).
- الاختبارات القديمة (SQLite) اتنقلت لـ `tests/legacy-sqlite/` ومش بتشتغل مع Postgres. `npm test` بيشغّل اختبارات الدومين وطبقة الـ SQL.
