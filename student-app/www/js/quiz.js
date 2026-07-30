// ═══════════════════════════════════════════════════════════════════
// محرك الاختبارات — يولد أسئلة من محتوى الدرس
// ═══════════════════════════════════════════════════════════════════

const quiz = {
  generate(lesson, count = 5) {
    const questions = [];

    // ١- سؤال عن الفكرة الرئيسية
    questions.push({
      type: 'mcq',
      question: 'ما الفكرة الرئيسية في هذا الدرس؟',
      correct: lesson.mainIdea,
      options: this.shuffle([
        lesson.mainIdea,
        this.pickDistractor(lesson.id, 'mainIdea', 0),
        this.pickDistractor(lesson.id, 'mainIdea', 1),
        this.pickDistractor(lesson.id, 'mainIdea', 2),
      ])
    });

    // ٢- أسئلة عن الكلمات الصعبة
    if (lesson.hardWords?.length > 0) {
      lesson.hardWords.slice(0, 2).forEach(hw => {
        const distractors = this.getWordDistractors(hw.word);
        questions.push({
          type: 'mcq',
          question: `ما معنى كلمة: "${hw.word}"؟`,
          correct: hw.meaning,
          options: this.shuffle([hw.meaning, ...distractors].slice(0, 4))
        });
      });
    }

    // ٣- سؤال صح أو خطأ
    questions.push({
      type: 'tf',
      question: lesson.summary,
      correct: 'صح',
      options: ['صح', 'خطأ']
    });

    // ٤- إكمال الفراغ من نص الحفظ
    if (lesson.memorize && lesson.memorize.length > 20) {
      const words = lesson.memorize.split(' ');
      if (words.length > 3) {
        const idx = Math.floor(words.length / 3);
        const blank = words[idx];
        words[idx] = '________';
        questions.push({
          type: 'mcq',
          question: `أكمل: ${words.join(' ')}`,
          correct: blank,
          options: this.shuffle([blank, ...this.getWordDistractors(blank)].slice(0, 4))
        });
      }
    }

    // ترتيب وقصر إلى العدد المطلوب
    return this.shuffle(questions).slice(0, count);
  },

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  pickDistractor(currentId, field, seed) {
    // يختار فكرة رئيسية من درس آخر
    const allLessons = BOOK_DATA.chapters.flatMap(c => c.lessons).filter(l => l.id !== currentId);
    const idx = (seed * 7) % allLessons.length;
    return allLessons[idx][field] || 'إجابة أخرى';
  },

  getWordDistractors(word) {
    // مجموعة عامة من التعريفات للاختيار كمشتتات
    const pool = [
      'الطاعة الكاملة لله',
      'ذكر الله بالقلب',
      'قراءة القرآن',
      'الصلاة في وقتها',
      'أداء الصدقة',
      'حسن معاملة الوالدين',
      'الجلوس في المسجد',
      'الصيام في رمضان',
      'التوجه للقبلة',
      'رفع اليدين للدعاء',
    ];
    return this.shuffle(pool).slice(0, 3);
  }
};

window.quiz = quiz;
