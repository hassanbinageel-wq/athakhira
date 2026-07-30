// ═══════════════════════════════════════════════════════════════════
// المساعد الذكي "حبيب"
// مهم: لا يستخدم الإنترنت — يبحث فقط في محتوى الكتاب
// ═══════════════════════════════════════════════════════════════════

const assistant = {
  greetings: [
    'أهلاً بك! كيف يمكنني مساعدتك في تعلم الكتاب؟',
    'مرحباً! اسألني عن أي درس تحبه',
    'حياك الله! أنا حبيب، دليلك في الكتاب',
  ],

  answer(question) {
    const q = this.normalize(question);

    // ─── تحيات ──
    if (/سلام|مرحب|هلا|صباح|مساء/.test(q)) {
      return 'وعليكم السلام ورحمة الله وبركاته! كيف يمكنني مساعدتك؟';
    }

    // ─── شكر ──
    if (/شكر|جزاك|بارك/.test(q)) {
      return 'وإياك! أسأل الله أن ينفعك بما تعلمت 🌟';
    }

    // ─── سؤال عن كلمة ──
    const wordMatch = q.match(/ما\s*معنى\s*(.+)|معنى\s*(.+)|شرح\s*(.+)/);
    if (wordMatch) {
      const searchTerm = (wordMatch[1] || wordMatch[2] || wordMatch[3] || '').trim();
      const wordDef = this.findWord(searchTerm);
      if (wordDef) {
        return `📝 ${wordDef.word}\n\nالمعنى: ${wordDef.meaning}\n\nمثال: ${wordDef.example}`;
      }
    }

    // ─── سؤال عن درس ──
    const lessonMatch = this.findLesson(q);
    if (lessonMatch) {
      return `📖 درس "${lessonMatch.title}"\n\nالفكرة الرئيسية: ${lessonMatch.mainIdea}\n\nالشرح: ${lessonMatch.simpleExplanation}`;
    }

    // ─── بحث عام في نصوص الكتاب ──
    const matches = this.searchBook(q);
    if (matches.length > 0) {
      const m = matches[0];
      return `وجدت ما يخص سؤالك في درس "${m.title}":\n\n${m.simpleExplanation}\n\nهل تريد أن أشرح لك درساً كاملاً؟`;
    }

    // ─── لا يوجد جواب في الكتاب ──
    return 'أنا آسف، لم أجد إجابة لسؤالك في الكتاب. أنا مصمم للإجابة فقط بناءً على محتوى كتاب الذخيرة المشرفة. جرب أن تسألني عن:\n\n• درس معين\n• معنى كلمة صعبة\n• عدد فروض أو شروط عبادة';
  },

  normalize(text) {
    return text.toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ىي]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\?\.\!،؛:]/g, '')
      .trim();
  },

  findWord(term) {
    const t = this.normalize(term);
    for (const ch of BOOK_DATA.chapters) {
      for (const lesson of ch.lessons) {
        if (!lesson.hardWords) continue;
        for (const hw of lesson.hardWords) {
          if (this.normalize(hw.word).includes(t) || t.includes(this.normalize(hw.word))) {
            return hw;
          }
        }
      }
    }
    return null;
  },

  findLesson(query) {
    const q = this.normalize(query);
    for (const ch of BOOK_DATA.chapters) {
      for (const lesson of ch.lessons) {
        if (this.normalize(lesson.title).includes(q) ||
            q.includes(this.normalize(lesson.title))) {
          return lesson;
        }
      }
    }
    return null;
  },

  searchBook(query) {
    const q = this.normalize(query);
    const keywords = q.split(/\s+/).filter(w => w.length > 2);
    const results = [];

    for (const ch of BOOK_DATA.chapters) {
      for (const lesson of ch.lessons) {
        const searchable = this.normalize(
          lesson.title + ' ' + lesson.originalText + ' ' + lesson.simpleExplanation + ' ' + lesson.summary
        );
        const matchCount = keywords.filter(k => searchable.includes(k)).length;
        if (matchCount > 0) {
          results.push({ ...lesson, score: matchCount });
        }
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }
};

window.assistant = assistant;
