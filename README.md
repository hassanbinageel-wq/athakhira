# 📖 الذخيرة المشرفة - التطبيق التعليمي

تطبيقان متكاملان مبنيان على كتاب "الذخيرة المشرفة" للحبيب عمر بن محمد بن سالم بن حفيظ.

## 📦 محتويات المشروع

```
athakhira/
├── student-app/         ← تطبيق الطالب (Capacitor + Vanilla JS → APK)
│   ├── www/            ← كل الواجهات والمنطق
│   ├── .github/workflows/build-apk.yml
│   ├── capacitor.config.json
│   └── package.json
│
├── admin-dashboard/     ← لوحة إدارة الويب (يستضاف على Vercel/Netlify)
│   ├── index.html
│   ├── css/
│   └── js/
│
└── supabase/
    └── schema.sql       ← قاعدة البيانات
```

---

## 🚀 الخطوات كاملة من الصفر إلى النشر

### الخطوة ١: إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وسجل دخول
2. اضغط **New Project**
3. اختر اسماً للمشروع مثل `athakhira`
4. اختر كلمة مرور قوية للقاعدة (احفظها)
5. اختر المنطقة الأقرب لك (Frankfurt أو Bahrain)
6. اضغط **Create new project** وانتظر دقيقتين

### الخطوة ٢: تشغيل قاعدة البيانات

1. من داخل المشروع، اضغط **SQL Editor** من القائمة الجانبية
2. اضغط **New Query**
3. افتح ملف `supabase/schema.sql` وانسخ محتواه كاملاً
4. الصقه في SQL Editor
5. اضغط **Run** (سيقول Success بعد ثوانٍ)

### الخطوة ٣: احصل على مفاتيح Supabase

1. اذهب إلى **Project Settings** → **API**
2. انسخ:
   - **Project URL** (يبدأ بـ `https://xxx.supabase.co`)
   - **anon public key** (سلسلة طويلة تبدأ بـ `eyJ...`)

### الخطوة ٤: إعداد تطبيق الطالب

افتح `student-app/www/js/config.js` وعدّل:

```js
SUPABASE_URL: 'https://xxx.supabase.co',   // ← الصق Project URL
SUPABASE_ANON_KEY: 'eyJhbGc...',           // ← الصق anon key
```

### الخطوة ٥: رفع تطبيق الطالب إلى GitHub

```bash
cd student-app
git init
git add .
git commit -m "أول إصدار من تطبيق الذخيرة المشرفة"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/athakhira-student.git
git push -u origin main
```

بمجرد الرفع، سيبدأ GitHub Actions تلقائياً في بناء APK. بعد ٥-١٠ دقائق:

1. اذهب إلى تبويب **Actions** في مستودعك
2. اضغط على آخر build
3. حمّل الـ APK من قسم **Artifacts**

### الخطوة ٦: نشر لوحة الإدارة على Vercel

1. اذهب إلى [vercel.com](https://vercel.com) وسجل الدخول بحساب GitHub
2. ارفع مجلد `admin-dashboard` كمستودع منفصل على GitHub
3. في Vercel اضغط **Add New Project**
4. اختر المستودع
5. اترك كل الإعدادات كما هي واضغط **Deploy**
6. بعد ٣٠ ثانية، ستحصل على رابط مثل `https://athakhira-admin.vercel.app`

بديل: تستطيع استخدام **Netlify** أو حتى **GitHub Pages** بنفس السهولة.

### الخطوة ٧: إعداد لوحة الإدارة

1. افتح الرابط الذي حصلت عليه من Vercel
2. ستحتاج أولاً تعديل `admin-dashboard/js/config.js` بنفس مفاتيح Supabase (أو استخدم صفحة الإعدادات داخل اللوحة)
3. لتسجيل الدخول، أنشئ حساب مشرف:

**كيف تصنع حساب Admin:**

في Supabase → SQL Editor، شغّل:

```sql
-- ١. سجل الحساب من التطبيق أو من لوحة Supabase Authentication
-- ٢. ثم حدّث دور المستخدم:
UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_ADMIN_EMAIL@example.com';
```

الآن تستطيع الدخول للوحة بذلك الحساب.

---

## 🔗 كيف يتصل التطبيقان؟

كلاهما يتصل بنفس مشروع Supabase:

- **تطبيق الطالب** يحفظ التقدم والاختبارات في جداول `lesson_progress`, `quiz_results`, `user_stats`...
- **لوحة الإدارة** تقرأ من نفس الجداول لعرض الإحصائيات والتقارير
- الإشعارات ترسل من اللوحة إلى الجدول `notifications` ويقرؤها الطالب

سياسات Row Level Security (RLS) تضمن:
- الطالب يرى بياناته فقط
- الأدمن يرى كل الطلاب

---

## 🧪 التجربة محلياً قبل النشر

### تطبيق الطالب:

```bash
cd student-app
npx http-server www -p 8080
```

افتح `http://localhost:8080` في المتصفح.

### لوحة الإدارة:

```bash
cd admin-dashboard
npx http-server -p 8081
```

افتح `http://localhost:8081` في المتصفح.

---

## 📱 توليد APK محلياً (اختياري)

لو تفضّل توليد APK على جهازك بدلاً من GitHub Actions:

```bash
cd student-app
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

الـ APK سيكون في: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🎯 المميزات المكتملة

### تطبيق الطالب:
- ✅ ٤٠ درساً كاملاً من الكتاب (النص الأصلي محفوظ حرفياً)
- ✅ لكل درس: النص الأصلي، الشرح المبسط، الكلمات الصعبة، مثال من الحياة، الملخص، الفكرة الرئيسية، سؤال تفكير، نص للحفظ
- ✅ نطق صوتي لكل درس (Text-to-Speech عربي)
- ✅ اختبارات تفاعلية تلقائية بعد كل درس
- ✅ نظام نقاط ومستويات (Gamification) - XP وأوسمة وسلسلة أيام
- ✅ ١٤ إنجاز قابل للفتح
- ✅ لوحة ولي الأمر داخل التطبيق
- ✅ المساعد الذكي "حبيب" (يبحث في الكتاب فقط، لا يستخدم الإنترنت)
- ✅ البحث الشامل في الدروس
- ✅ المفضلة
- ✅ شهادة عند إكمال الكتاب
- ✅ الوضع الليلي
- ✅ RTL كامل، عربية بالكامل، خطوط احترافية
- ✅ يعمل بدون إنترنت (Offline-first)
- ✅ يزامن البيانات مع Supabase عند توفر الاتصال

### لوحة الإدارة:
- ✅ تسجيل دخول آمن بدور Admin
- ✅ نظرة عامة بمؤشرات KPI + مخططات
- ✅ قائمة كاملة بالطلاب مع فلترة
- ✅ سجل الاختبارات مع نسب النجاح
- ✅ إرسال إشعارات لجميع الطلاب أو مجموعات
- ✅ تصدير التقارير كملفات CSV
- ✅ إعدادات قابلة للتعديل

---

## ⚠️ قواعد صارمة (لا يمكن مخالفتها)

هذه القواعد محفوظة في الكود:
- النص الأصلي من الكتاب (`originalText`) لا يعدل أبداً
- الشرح المبسط (`simpleExplanation`) لا يضيف أحكاماً شرعية جديدة
- المساعد الذكي يبحث فقط في `data.js` (الكتاب) — لا يستخدم الإنترنت
- كل الواجهة بالعربية، لا كلمة إنجليزية في UI

---

## 🐛 مشاكل شائعة

**المشكلة**: التطبيق لا يحفظ التقدم
**الحل**: تأكد من إعداد مفاتيح Supabase في `config.js`

**المشكلة**: GitHub Actions فشل في البناء
**الحل**: تحقق من ملف `.github/workflows/build-apk.yml` وأن Java و Node موجودان

**المشكلة**: لوحة الإدارة تعرض "ليس حساب مشرف"
**الحل**: شغّل `UPDATE profiles SET role='admin'` في SQL Editor لحسابك

---

## 📝 ملاحظات نهائية

- التطبيق مصمم لأطفال ١٠-١٢ سنة — الواجهة مبسطة والألوان مريحة
- الأصوات باستخدام Web Speech API (يعمل على كل الأجهزة الحديثة)
- بيانات الكتاب مضمنة في التطبيق لضمان الأصالة والعمل بدون إنترنت

بالتوفيق! 🌟
