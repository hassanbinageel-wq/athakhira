// ═══════════════════════════════════════════════════════════════════
// إعدادات التطبيق
// ═══════════════════════════════════════════════════════════════════
// ⚠️ مهم: بعد إنشاء مشروع Supabase الخاص بك، ضع القيم هنا
// من: Supabase Dashboard > Project Settings > API

const CONFIG = {
  SUPABASE_URL: 'https://fitdahpueuqbrqygxkdl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bV2WwPzdPxcOp-K9v2UusQ_KCuMNn5c',

  APP_NAME: 'الذخيرة المشرفة',
  APP_VERSION: '1.0.0',
  XP_PER_LESSON: 20,
  XP_PER_QUIZ_CORRECT: 10,
  XP_PER_LEVEL: 100,
  MIN_MINUTES_FOR_STREAK: 5,
  TTS_LANG: 'ar-SA',
  TTS_RATE: 0.9,
};

window.CONFIG = CONFIG;