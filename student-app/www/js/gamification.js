/* ============================================================
   gamification.js  —  نظام الحوافز: نجوم، XP، مستويات، فتح تدريجي
   ============================================================ */
'use strict';

const Gamification = (function() {
  let state = {
    stars: 0,
    xp: 0,
    streak: 0,
    lastLoginDate: null,
    unlockedChapters: [1],       // الفصل الأول مفتوح افتراضياً
    unlockedLessons: {},         // { chapterId: [lessonId1, lessonId2...] }
    completedLessons: [],        // [{ chapterId, lessonId, timestamp }]
    completedQuizzes: [],        // [{ chapterId, lessonId, score, timestamp }]
    starsByChapter: {},          // { chapterId: totalStars }
    currentLevelIdx: 0
  };

  let container = null;

  // ═══════════════════ التخزين ═══════════════════
  function load(userId) {
    const key = `gamification_${userId || 'guest'}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch (e) { console.warn('Failed to load gamification', e); }
    updateStreak();
    // ترقية البيانات القديمة (فتح الفصول المكتملة، تعويض النجوم)
    if (migrateExistingProgress()) save(userId);
    return state;
  }

  function save(userId) {
    const key = `gamification_${userId || 'guest'}`;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) { console.warn('Failed to save gamification', e); }
  }

  // ═══════════════════ الـ streak ═══════════════════
  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastLoginDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.lastLoginDate === yesterday) {
      state.streak++;
    } else if (state.lastLoginDate) {
      state.streak = 1;
    } else {
      state.streak = 1;
    }
    state.lastLoginDate = today;
  }

  // ═══════════════════ المستوى ═══════════════════
  function getCurrentLevel() {
    const levels = CONFIG.LEVELS;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (state.xp >= levels[i].minXP) {
        return { ...levels[i], idx: i };
      }
    }
    return { ...levels[0], idx: 0 };
  }

  function getNextLevel() {
    const cur = getCurrentLevel();
    if (cur.idx >= CONFIG.LEVELS.length - 1) return null;
    return { ...CONFIG.LEVELS[cur.idx + 1], idx: cur.idx + 1 };
  }

  function getLevelProgress() {
    const cur = getCurrentLevel();
    const next = getNextLevel();
    if (!next) return 100;
    const range = next.minXP - cur.minXP;
    const gained = state.xp - cur.minXP;
    return Math.min(100, Math.round((gained / range) * 100));
  }

  // ═══════════════════ إضافة النجوم والـ XP ═══════════════════
  function addStars(count, chapterId = null) {
    state.stars += count;
    if (chapterId) {
      state.starsByChapter[chapterId] = (state.starsByChapter[chapterId] || 0) + count;
    }
    checkChapterUnlock(chapterId);
  }

  function addXP(amount) {
    const beforeLevel = getCurrentLevel().idx;
    state.xp += amount;
    const afterLevel = getCurrentLevel().idx;

    if (afterLevel > beforeLevel) {
      const newLevel = getCurrentLevel();
      state.currentLevelIdx = afterLevel;
      setTimeout(() => {
        Character.levelUp(newLevel.name);
        showLevelUpModal(newLevel);
      }, 1500);
      return { leveledUp: true, newLevel };
    }
    return { leveledUp: false };
  }

  // ═══════════════════ الفتح التدريجي ═══════════════════
  function isChapterUnlocked(chapterId) {
    return state.unlockedChapters.includes(chapterId);
  }

  function isLessonUnlocked(chapterId, lessonId) {
    if (!isChapterUnlocked(chapterId)) return false;
    if (lessonId === 1) return true; // أول درس دائماً مفتوح
    const done = state.completedLessons.filter(l => l.chapterId === chapterId);
    // الدرس N مفتوح إذا الدرس N-1 مكتمل
    return done.some(l => l.lessonId === lessonId - 1);
  }

  function checkChapterUnlock(chapterId) {
    if (!chapterId) return;
    // ⚠️ الفصل التالي يُفتح فقط عند إكمال جميع دروس الفصل الحالي (بعلامة كاملة)
    const chapter = window.CHAPTERS?.find(c => c.id === chapterId);
    if (!chapter) return;
    const completedInChapter = state.completedLessons
      .filter(l => l.chapterId === chapterId).length;
    const allDone = completedInChapter >= chapter.lessons.length;
    if (allDone) {
      const nextChapter = chapterId + 1;
      if (!state.unlockedChapters.includes(nextChapter)) {
        state.unlockedChapters.push(nextChapter);
        setTimeout(() => {
          Character.chapterUnlock();
          showChapterUnlockAnimation(nextChapter);
        }, 2500);
      }
    }
  }

  // كم درس باقي لفتح الدرس التالي؟
  function lessonsUntilNext(chapterId, targetLessonId) {
    const done = state.completedLessons.filter(l => l.chapterId === chapterId);
    const doneIds = done.map(l => l.lessonId);
    let count = 0;
    for (let i = 1; i < targetLessonId; i++) {
      if (!doneIds.includes(i)) count++;
    }
    return count;
  }

  // ═══════════════════ إكمال درس ═══════════════════
  function markLessonComplete(chapterId, lessonId, quizScore = null) {
    const already = state.completedLessons.some(l =>
      l.chapterId === chapterId && l.lessonId === lessonId);
    if (already) return { alreadyDone: true };

    state.completedLessons.push({
      chapterId, lessonId, timestamp: Date.now()
    });

    if (quizScore !== null) {
      state.completedQuizzes.push({
        chapterId, lessonId, score: quizScore, timestamp: Date.now()
      });
    }

    // النجوم تُحسب ديناميكياً: كل درس يمنح ما يكفي لضمان فتح الفصل التالي
    // مثلاً: فصل بدرسين → 50 لكل درس. فصل بأربعة → 25 لكل درس.
    const chapter = (window.CHAPTERS || []).find(c => c.id === chapterId);
    const totalLessonsInChapter = chapter?.lessons.length || 1;
    const baseStars = Math.ceil(CONFIG.STARS_TO_UNLOCK_CHAPTER / totalLessonsInChapter);

    let starsEarned = baseStars;
    if (quizScore !== null && quizScore >= 90) {
      starsEarned += CONFIG.STARS_PER_QUIZ_PERFECT;
    }

    // حساب XP
    let xpEarned = CONFIG.XP_PER_LESSON;
    if (quizScore !== null) {
      xpEarned += Math.round(quizScore / 10) * CONFIG.XP_PER_CORRECT_ANSWER;
    }

    addStars(starsEarned, chapterId);
    const levelResult = addXP(xpEarned);

    // شبكة أمان: لو كل الدروس مكتملة في الفصل، افتح الفصل التالي حتى لو النجوم أقل
    ensureChapterUnlockedIfComplete(chapterId);

    return {
      alreadyDone: false,
      starsEarned,
      xpEarned,
      totalStars: state.stars,
      totalXP: state.xp,
      ...levelResult
    };
  }

  /**
   * ضمان أن الفصل التالي يُفتح عند إكمال جميع دروس الفصل الحالي
   * (شبكة أمان في حال ما وصلت النجوم للـ threshold)
   */
  function ensureChapterUnlockedIfComplete(chapterId) {
    const chapter = (window.CHAPTERS || []).find(c => c.id === chapterId);
    if (!chapter) return false;
    const completedCount = state.completedLessons.filter(l => l.chapterId === chapterId).length;
    if (completedCount < chapter.lessons.length) return false;

    const nextId = chapterId + 1;
    const nextExists = (window.CHAPTERS || []).some(c => c.id === nextId);
    if (nextExists && !state.unlockedChapters.includes(nextId)) {
      state.unlockedChapters.push(nextId);
      setTimeout(() => {
        Character.chapterUnlock();
        showChapterUnlockAnimation(nextId);
      }, 2500);
      return true;
    }
    return false;
  }

  /**
   * ترقية بيانات المستخدمين: قفل أي فصل فُتح خطأً + فتح كل فصل استحقّ الفتح
   * الفتح يعتمد فقط على إكمال جميع دروس الفصل السابق (لا على النجوم)
   */
  function migrateExistingProgress() {
    let changed = false;
    const chapters = window.CHAPTERS || [];

    // إعادة بناء قائمة الفصول المفتوحة من الصفر بناءً على منطق الإكمال
    const correctUnlocks = [1]; // الفصل الأول دائماً مفتوح
    for (const ch of chapters) {
      if (ch.id === 1) continue;
      const prev = chapters.find(c => c.id === ch.id - 1);
      if (!prev) continue;
      const prevDone = state.completedLessons
        .filter(l => l.chapterId === prev.id).length;
      const prevComplete = prevDone >= prev.lessons.length && prev.lessons.length > 0;
      if (prevComplete && !correctUnlocks.includes(ch.id)) {
        correctUnlocks.push(ch.id);
      }
    }

    // مقارنة مع الحالة الحاليّة — إن اختلفت، صحّحها
    const currentSorted = [...state.unlockedChapters].sort((a, b) => a - b);
    const correctSorted = [...correctUnlocks].sort((a, b) => a - b);
    if (JSON.stringify(currentSorted) !== JSON.stringify(correctSorted)) {
      state.unlockedChapters = correctUnlocks;
      changed = true;
    }
    return changed;
  }

  // ═══════════════════ صندوق المكافأة (Reward Box) ═══════════════════
  function showRewardBox(result) {
    if (result.alreadyDone) return;

    const overlay = document.createElement('div');
    overlay.className = 'reward-overlay';
    overlay.innerHTML = `
      <div class="reward-modal">
        <div class="reward-title">🎁 حصلت على صندوق مكافأة!</div>
        <div class="reward-scene">
          <div class="reward-box" id="reward-box">
            <div class="reward-box-lid">🎁</div>
            <div class="reward-star-emerge" id="reward-star">⭐</div>
            <div class="reward-sparkles">
              <span>✨</span><span>✨</span><span>✨</span>
              <span>✨</span><span>✨</span><span>✨</span>
            </div>
          </div>
        </div>
        <div class="reward-hint">اضغط الصندوق لتفتحه</div>
        <div class="reward-content hidden" id="reward-content">
          <div class="reward-stars">+${result.starsEarned} ⭐</div>
          <div class="reward-xp">+${result.xpEarned} XP</div>
          <button class="btn primary reward-close" onclick="Gamification.closeReward()">
            استلام المكافأة
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    container = overlay;

    const box = overlay.querySelector('#reward-box');
    box.addEventListener('click', openRewardBox, { once: true });
  }

  function openRewardBox() {
    if (!container) return;
    const box = container.querySelector('#reward-box');
    const content = container.querySelector('#reward-content');
    const hint = container.querySelector('.reward-hint');
    const star = container.querySelector('#reward-star');
    const sparkles = container.querySelector('.reward-sparkles');

    box.classList.add('opened');
    hint.classList.add('hidden');
    star?.classList.add('flying');
    sparkles?.classList.add('active');

    setTimeout(() => {
      content.classList.remove('hidden');
      content.classList.add('appear');
    }, 1000);
  }

  function closeReward() {
    if (!container) return;
    container.classList.add('closing');
    setTimeout(() => {
      container?.remove();
      container = null;
    }, 300);
  }

  // ═══════════════════ نافذة الترقّي ═══════════════════
  function showLevelUpModal(level) {
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-modal" style="border-color: ${level.color}">
        <div class="levelup-burst">${level.icon}</div>
        <div class="levelup-title">مستوى جديد!</div>
        <div class="levelup-name" style="color: ${level.color}">${level.name}</div>
        <div class="levelup-msg">استمرّ في التعلّم لتصل للأعلى!</div>
        <button class="btn primary" onclick="this.closest('.levelup-overlay').remove()">
          واصل الرحلة 🚀
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showChapterUnlockAnimation(chapterId) {
    const overlay = document.createElement('div');
    overlay.className = 'unlock-overlay';
    overlay.innerHTML = `
      <div class="unlock-modal">
        <div class="unlock-key">🗝️</div>
        <div class="unlock-title">فُتح فصل جديد!</div>
        <div class="unlock-chapter">الفصل ${chapterId}</div>
        <button class="btn primary" onclick="this.closest('.unlock-overlay').remove(); App.goHome();">
          استكشف الفصل الجديد ✨
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ═══════════════════ Toast (رسائل صغيرة) ═══════════════════
  function showToast(text, type = 'info', duration = 2500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ═══════════════════ الواجهة الخارجية ═══════════════════
  return {
    load, save,
    addStars, addXP,
    getCurrentLevel, getNextLevel, getLevelProgress,
    isChapterUnlocked, isLessonUnlocked, lessonsUntilNext,
    markLessonComplete, ensureChapterUnlockedIfComplete, migrateExistingProgress,
    showRewardBox, openRewardBox, closeReward,
    showLevelUpModal, showChapterUnlockAnimation, showToast,
    get state() { return state; },
    get stars() { return state.stars; },
    get xp() { return state.xp; },
    get streak() { return state.streak; }
  };
})();

window.Gamification = Gamification;
