/* ============================================================
   smart-review.js  —  المراجعة الذكية للأسئلة المُخطأة
   ============================================================
   الفكرة: إذا أخطأ الطفل في سؤال، نحفظه.
   بعد كل ٣ دروس نُذكّره بمراجعة الأسئلة الخاطئة.
   الطفل ما ينسى الخطأ حتى يجيب الصح ٣ مرات متتالية.
   ============================================================ */
'use strict';

const SmartReview = (function() {
  let mistakes = {};  // { questionId: { count, lastWrong, topic, question, correctAnswer, timesReviewed } }
  let userId = 'guest';

  function load(uid) {
    userId = uid || 'guest';
    try {
      const saved = localStorage.getItem(`review_${userId}`);
      if (saved) mistakes = JSON.parse(saved);
    } catch (e) { console.warn('Failed to load review', e); }
  }

  function save() {
    try {
      localStorage.setItem(`review_${userId}`, JSON.stringify(mistakes));
    } catch (e) { console.warn('Failed to save review', e); }
  }

  /**
   * تسجيل خطأ في سؤال
   */
  function recordMistake(question) {
    const id = question.id || String(question.q).slice(0, 40);
    if (!mistakes[id]) {
      mistakes[id] = {
        id,
        count: 0,
        lastWrong: null,
        topic: question.topic || 'عام',
        question: question.q,
        correctAnswer: question.answer !== undefined ? question.answer : question.correct,
        options: question.options || null,
        type: question.type || 'mcq',
        chapterId: question.chapterId,
        lessonId: question.lessonId,
        timesReviewed: 0,
        streakCorrect: 0
      };
    }
    mistakes[id].count++;
    mistakes[id].lastWrong = Date.now();
    mistakes[id].streakCorrect = 0;
    save();
  }

  /**
   * تسجيل إجابة صحيحة في سؤال كان مُخطأ
   */
  function recordCorrect(questionId) {
    const id = String(questionId);
    if (!mistakes[id]) return;
    mistakes[id].streakCorrect++;
    mistakes[id].timesReviewed++;
    // بعد ٣ إجابات صحيحة متتالية، نحذف السؤال من قائمة المراجعة
    if (mistakes[id].streakCorrect >= 3) {
      delete mistakes[id];
    }
    save();
  }

  /**
   * هل حان وقت المراجعة؟
   */
  function shouldReview() {
    const items = Object.values(mistakes);
    if (items.length < CONFIG.REVIEW_MIN_MISTAKES) return false;

    // آخر مراجعة (نأخذها من أحدث timesReviewed)
    const lastReviewed = Math.max(...items.map(m => m.lastWrong || 0));
    const daysSince = (Date.now() - lastReviewed) / 86400000;
    return daysSince >= CONFIG.REVIEW_INTERVAL_DAYS;
  }

  /**
   * الأسئلة الأولى بالمراجعة (أعلى count أولاً)
   */
  function getReviewQuestions(limit = 5) {
    return Object.values(mistakes)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  function getMistakeCount() {
    return Object.keys(mistakes).length;
  }

  function getTopicsWithMistakes() {
    const topics = {};
    Object.values(mistakes).forEach(m => {
      topics[m.topic] = (topics[m.topic] || 0) + 1;
    });
    return topics;
  }

  return {
    load, save,
    recordMistake, recordCorrect,
    shouldReview, getReviewQuestions,
    getMistakeCount, getTopicsWithMistakes,
    get mistakes() { return { ...mistakes }; }
  };
})();

window.SmartReview = SmartReview;
