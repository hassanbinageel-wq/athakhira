/* ============================================================
   config.js  —  إعدادات التطبيق (بدون قاعدة بيانات، كل شي محلي)
   ============================================================ */
'use strict';

const CONFIG = {
  APP_NAME: 'الذخيرة المشرفة',
  APP_VERSION: '2.0.0',

  // ═══════ التحفيز والتقدم ═══════
  STARS_PER_LESSON: 10,          // نجوم عند إكمال درس
  STARS_PER_QUIZ_PERFECT: 20,     // نجوم إضافية عند إتقان الاختبار
  STARS_TO_UNLOCK_CHAPTER: 100,   // نجوم لفتح الفصل التالي
  XP_PER_LESSON: 30,
  XP_PER_CORRECT_ANSWER: 5,

  // ═══════ المستويات ═══════
  LEVELS: [
    { name: 'مبتدئ',  icon: '🌱', minXP: 0,    color: '#4dbd8f' },
    { name: 'مستكشف', icon: '🔎', minXP: 200,  color: '#218965' },
    { name: 'متعلّم',  icon: '📚', minXP: 600,  color: '#124f3d' },
    { name: 'بطل',    icon: '🏆', minXP: 1200, color: '#c99629' },
    { name: 'خبير',   icon: '👑', minXP: 2000, color: '#a67c1b' }
  ],

  // ═══════ الكتاب ═══════
  // رابط Google Drive المشترك — يفتح في المتصفح للتحميل/العرض
  // الكتاب مضمَّن في التطبيق (لا رابط خارجي)
  BOOK_PDF_PATH: 'assets/book/book.pdf',
  BOOK_FILE_NAME: 'الذخيرة المشرفة.pdf',
  BOOK_SIZE: 13823176,   // بالبايت — لمعرفة إن كانت النسخة المحفوظة كاملة (حدّثه إن تغيّر الكتاب)

  // ═══════ المراجعة الذكية ═══════
  REVIEW_INTERVAL_DAYS: 3,
  REVIEW_MIN_MISTAKES: 3
};

window.CONFIG = CONFIG;
