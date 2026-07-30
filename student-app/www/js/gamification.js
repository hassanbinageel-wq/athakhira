// ═══════════════════════════════════════════════════════════════════
// نظام التحفيز — النقاط والمستويات والإنجازات
// ═══════════════════════════════════════════════════════════════════

const gamification = {
  ACHIEVEMENTS: [
    { key: 'first_lesson', name: 'أنهيت أول درس', icon: '🌱', desc: 'أنهيت أول درس بنجاح' },
    { key: 'first_quiz', name: 'مبتدئ الاختبارات', icon: '🎯', desc: 'اجتزت أول اختبار' },
    { key: 'chapter_1_done', name: 'أنهيت أول باب', icon: '📖', desc: 'أنهيت جميع دروس الباب الأول' },
    { key: 'half_book', name: 'نصف الطريق', icon: '🌗', desc: 'أنجزت نصف الكتاب' },
    { key: 'full_book', name: 'خاتم الكتاب', icon: '📚', desc: 'أنهيت الكتاب كاملاً' },
    { key: 'streak_7', name: '٧ أيام متتالية', icon: '🔥', desc: 'استمريت أسبوعاً كاملاً' },
    { key: 'streak_30', name: '٣٠ يوم متتالية', icon: '🏆', desc: 'استمريت شهراً كاملاً' },
    { key: 'streak_100', name: '١٠٠ يوم متتالية', icon: '👑', desc: 'مئة يوم من العلم' },
    { key: 'perfect_quiz', name: 'اختبار مثالي', icon: '💯', desc: 'حصلت على ١٠٠٪ في اختبار' },
    { key: 'level_5', name: 'طالب علم', icon: '⭐', desc: 'وصلت للمستوى ٥' },
    { key: 'level_10', name: 'حافظ', icon: '🌟', desc: 'وصلت للمستوى ١٠' },
    { key: 'level_20', name: 'خبير الذخيرة', icon: '💎', desc: 'وصلت للمستوى ٢٠' },
    { key: 'assistant_first', name: 'صديق حبيب', icon: '🤖', desc: 'أول محادثة مع حبيب' },
    { key: 'favorite_first', name: 'أول مفضلة', icon: '❤️', desc: 'أضفت أول درس للمفضلة' },
  ],

  TITLES: [
    { minLevel: 1, title: 'طالب مجتهد' },
    { minLevel: 5, title: 'طالب علم' },
    { minLevel: 10, title: 'حافظ' },
    { minLevel: 20, title: 'محترف الاختبارات' },
    { minLevel: 40, title: 'خبير الدروس' },
    { minLevel: 70, title: 'بطل التعلم' },
    { minLevel: 100, title: 'الذخيرة المشرفة' },
  ],

  getTitle(level) {
    let t = this.TITLES[0].title;
    for (const item of this.TITLES) if (level >= item.minLevel) t = item.title;
    return t;
  },

  calcLevel(xp) {
    return Math.max(1, Math.floor(xp / CONFIG.XP_PER_LEVEL) + 1);
  },

  async addXP(amount, reason = '') {
    const stats = db.getLocalStats();
    const prevLevel = this.calcLevel(stats.xp);
    stats.xp = (stats.xp || 0) + amount;
    const newLevel = this.calcLevel(stats.xp);
    stats.level = newLevel;
    stats.gems = (stats.gems || 0) + Math.floor(amount / 10);
    await db.updateStats(stats);
    if (newLevel > prevLevel) {
      this.showToast(`🎉 مبروك! وصلت للمستوى ${newLevel}`);
      if (newLevel === 5) await db.unlockAchievement('level_5', 'طالب علم', '⭐');
      if (newLevel === 10) await db.unlockAchievement('level_10', 'حافظ', '🌟');
      if (newLevel === 20) await db.unlockAchievement('level_20', 'خبير الذخيرة', '💎');
    }
    return { xp: stats.xp, level: newLevel, leveledUp: newLevel > prevLevel };
  },

  async updateStreak() {
    const stats = db.getLocalStats();
    const today = new Date().toISOString().split('T')[0];
    const last = stats.last_study_date;
    if (last === today) return stats.streak_days;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak;
    if (last === yesterday) newStreak = (stats.streak_days || 0) + 1;
    else newStreak = 1;

    stats.streak_days = newStreak;
    stats.last_study_date = today;
    await db.updateStats(stats);

    if (newStreak === 7) await db.unlockAchievement('streak_7', '٧ أيام متتالية', '🔥');
    if (newStreak === 30) await db.unlockAchievement('streak_30', '٣٠ يوم متتالية', '🏆');
    if (newStreak === 100) await db.unlockAchievement('streak_100', '١٠٠ يوم متتالية', '👑');

    return newStreak;
  },

  async checkChapterCompletion(chapterId) {
    const progress = db.getLocalProgress();
    const ch = BOOK_DATA.chapters.find(c => c.id === chapterId);
    if (!ch) return;
    const done = ch.lessons.every(l => progress[l.id]?.status === 'completed');
    if (done && chapterId === 'ch1') await db.unlockAchievement('chapter_1_done', 'أنهيت أول باب', '📖');

    const totalLessons = BOOK_DATA.stats.totalLessons;
    const doneCount = Object.values(progress).filter(p => p.status === 'completed').length;
    if (doneCount >= totalLessons / 2) await db.unlockAchievement('half_book', 'نصف الطريق', '🌗');
    if (doneCount >= totalLessons) await db.unlockAchievement('full_book', 'خاتم الكتاب', '📚');
  },

  showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
};

window.gamification = gamification;
