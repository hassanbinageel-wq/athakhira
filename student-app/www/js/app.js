// ═══════════════════════════════════════════════════════════════════
// وحدة تحكم التطبيق الرئيسية
// ═══════════════════════════════════════════════════════════════════

const app = {
  authMode: 'signup',
  currentChapter: null,
  currentLesson: null,
  quizQuestions: [],
  quizIndex: 0,
  quizScore: 0,
  quizWrong: [],
  quizSelected: null,
  chatMessages: [],

  async init() {
    db.init();
    this.loadDarkMode();

    // ─── محاولة استعادة الجلسة ──
    const session = await db.restoreSession();
    const localUser = localStorage.getItem('user_id');

    if (session || localUser) {
      await this.showHome();
    } else {
      this.showSplash();
    }
  },

  // ═══════════════════════════ التنقل بين الشاشات ═══════════════════════════
  switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  },

  showSplash() { this.switchScreen('splash-screen'); },

  showAuth(mode) {
    this.authMode = mode;
    this.switchScreen('auth-screen');
    this.updateAuthUI();
  },

  updateAuthUI() {
    const isSignup = this.authMode === 'signup';
    document.getElementById('auth-title').textContent = isSignup ? 'تسجيل جديد' : 'تسجيل الدخول';
    document.getElementById('auth-submit').textContent = isSignup ? 'إنشاء الحساب' : 'دخول';
    document.getElementById('age-group').style.display = isSignup ? 'block' : 'none';
    document.getElementById('auth-name').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('auth-toggle-text').textContent = isSignup ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    document.getElementById('auth-toggle-link').textContent = isSignup ? 'تسجيل الدخول' : 'تسجيل جديد';
    document.getElementById('auth-error').textContent = '';
  },

  toggleAuthMode() {
    this.authMode = this.authMode === 'signup' ? 'login' : 'signup';
    this.updateAuthUI();
  },

  async handleAuth() {
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const age = parseInt(document.getElementById('auth-age').value) || 10;
    const errEl = document.getElementById('auth-error');

    if (!email || !password || (this.authMode === 'signup' && !name)) {
      errEl.textContent = 'يرجى ملء جميع الحقول';
      return;
    }

    this.showLoading();
    try {
      if (this.authMode === 'signup') {
        await db.signUp(email, password, name, age);
      } else {
        await db.signIn(email, password);
      }
      this.hideLoading();
      await this.showHome();
    } catch (err) {
      this.hideLoading();
      errEl.textContent = err.message || 'حدث خطأ. حاول مرة أخرى.';
    }
  },

  async logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
      await db.signOut();
      this.showSplash();
    }
  },

  // ═══════════════════════════ الرئيسية ═══════════════════════════
  async showHome() {
    this.switchScreen('home-screen');
    const name = localStorage.getItem('user_name') || 'صديقنا';
    document.getElementById('home-username').textContent = name;
    document.getElementById('home-avatar').textContent = name.charAt(0);
    this.updateStatsDisplay();
    this.renderChapters();
    await gamification.updateStreak();
    this.updateStatsDisplay();
  },

  updateStatsDisplay() {
    const stats = db.getLocalStats();
    document.getElementById('stat-streak').textContent = stats.streak_days || 0;
    document.getElementById('stat-xp').textContent = stats.xp || 0;
    document.getElementById('stat-level').textContent = stats.level || 1;

    const progress = db.getLocalProgress();
    const completedCount = Object.values(progress).filter(p => p.status === 'completed').length;
    const total = BOOK_DATA.stats.totalLessons;
    document.getElementById('progress-text').textContent = `${completedCount} / ${total}`;
    document.getElementById('progress-fill').style.width = `${(completedCount / total) * 100}%`;
  },

  renderChapters() {
    const container = document.getElementById('chapters-list');
    const progress = db.getLocalProgress();
    container.innerHTML = BOOK_DATA.chapters.map(ch => {
      const done = ch.lessons.filter(l => progress[l.id]?.status === 'completed').length;
      const total = ch.lessons.length;
      const pct = (done / total) * 100;
      return `
        <div class="chapter-card" onclick="app.showChapter('${ch.id}')">
          <div class="chapter-icon">${ch.icon}</div>
          <div class="chapter-info">
            <div class="chapter-name">${ch.title}</div>
            <div class="chapter-meta">
              <span>${done}/${total} درس</span>
              <div class="chapter-progress-mini"><div style="width:${pct}%"></div></div>
            </div>
          </div>
          <div style="font-size:22px;color:var(--text-muted)">‹</div>
        </div>
      `;
    }).join('');
  },

  // ═══════════════════════════ الفصل ═══════════════════════════
  showChapter(chapterId) {
    this.currentChapter = BOOK_DATA.chapters.find(c => c.id === chapterId);
    if (!this.currentChapter) return;
    this.switchScreen('chapter-screen');
    document.getElementById('chapter-title').textContent = this.currentChapter.title;

    const progress = db.getLocalProgress();
    const container = document.getElementById('lessons-list');
    container.innerHTML = this.currentChapter.lessons.map((lesson, i) => {
      const isCompleted = progress[lesson.id]?.status === 'completed';
      return `
        <div class="lesson-card-mini ${isCompleted ? 'completed' : ''}" onclick="app.showLesson('${lesson.id}')">
          <div class="lesson-number">${i + 1}</div>
          <div class="lesson-info">
            <div class="lesson-name">${lesson.title}</div>
            <div class="lesson-meta">${isCompleted ? 'مكتمل ✓' : 'اضغط للبدء'}</div>
          </div>
          <div class="lesson-check">${isCompleted ? '✓' : ''}</div>
        </div>
      `;
    }).join('');
  },

  // ═══════════════════════════ الدرس ═══════════════════════════
  showLesson(lessonId) {
    // ابحث في كل الفصول
    for (const ch of BOOK_DATA.chapters) {
      const l = ch.lessons.find(x => x.id === lessonId);
      if (l) {
        this.currentLesson = l;
        this.currentChapter = ch;
        break;
      }
    }
    if (!this.currentLesson) return;

    this.switchScreen('lesson-screen');
    document.getElementById('lesson-title').textContent = this.currentLesson.title;
    document.getElementById('lesson-original').textContent = this.currentLesson.originalText;
    document.getElementById('lesson-explanation').textContent = this.currentLesson.simpleExplanation;
    document.getElementById('lesson-example').textContent = this.currentLesson.reallifeExample;
    document.getElementById('lesson-summary').textContent = this.currentLesson.summary;
    document.getElementById('lesson-mainidea').textContent = this.currentLesson.mainIdea;
    document.getElementById('lesson-think').textContent = this.currentLesson.thinkQuestion;
    document.getElementById('lesson-memorize').textContent = this.currentLesson.memorize;

    const wordsContainer = document.getElementById('lesson-hardwords');
    wordsContainer.innerHTML = (this.currentLesson.hardWords || []).map(hw => `
      <div class="hardword-item">
        <div class="hw-word">${hw.word}</div>
        <div class="hw-meaning">${hw.meaning}</div>
        <div class="hw-example">مثال: ${hw.example}</div>
      </div>
    `).join('');

    const favBtn = document.getElementById('fav-btn');
    favBtn.textContent = db.isFavorite('lesson', this.currentLesson.id) ? '❤️' : '🤍';
  },

  goBackFromLesson() {
    if (this.currentChapter) this.showChapter(this.currentChapter.id);
    else this.showHome();
  },

  async markLessonComplete() {
    if (!this.currentLesson) return;
    this.showLoading();
    await db.saveProgress(this.currentChapter.id, this.currentLesson.id, 'completed');
    const result = await gamification.addXP(CONFIG.XP_PER_LESSON);

    // فتح إنجاز أول درس
    const progress = db.getLocalProgress();
    if (Object.keys(progress).length === 1) {
      await db.unlockAchievement('first_lesson', 'أنهيت أول درس', '🌱');
    }
    await gamification.checkChapterCompletion(this.currentChapter.id);

    this.hideLoading();
    gamification.showToast(`+${CONFIG.XP_PER_LESSON} نقطة خبرة ✓`);
    setTimeout(() => this.showChapter(this.currentChapter.id), 1200);
  },

  async toggleFavorite() {
    if (!this.currentLesson) return;
    const added = await db.toggleFavorite('lesson', this.currentLesson.id, {
      title: this.currentLesson.title,
      chapter_id: this.currentChapter.id
    });
    document.getElementById('fav-btn').textContent = added ? '❤️' : '🤍';
    if (added) await db.unlockAchievement('favorite_first', 'أول مفضلة', '❤️');
  },

  // ═══════════════════════════ الاختبار ═══════════════════════════
  startQuiz() {
    if (!this.currentLesson) return;
    this.quizQuestions = quiz.generate(this.currentLesson, 5);
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizWrong = [];
    this.switchScreen('quiz-screen');
    this.renderQuizQuestion();
  },

  renderQuizQuestion() {
    const q = this.quizQuestions[this.quizIndex];
    document.getElementById('quiz-counter').textContent = `${this.quizIndex + 1}/${this.quizQuestions.length}`;
    document.getElementById('quiz-progress').style.width = `${((this.quizIndex) / this.quizQuestions.length) * 100}%`;
    document.getElementById('quiz-question').textContent = q.question;
    document.getElementById('quiz-feedback').className = 'quiz-feedback';
    document.getElementById('quiz-feedback').textContent = '';
    document.getElementById('quiz-next-btn').style.display = 'none';
    this.quizSelected = null;

    const optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = q.options.map((opt, i) => `
      <button class="quiz-option" onclick="app.selectQuizOption(${i})">${opt}</button>
    `).join('');
  },

  selectQuizOption(index) {
    if (this.quizSelected !== null) return;
    this.quizSelected = index;
    const q = this.quizQuestions[this.quizIndex];
    const selectedText = q.options[index];
    const isCorrect = selectedText === q.correct;

    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((btn, i) => {
      if (q.options[i] === q.correct) btn.classList.add('correct');
      else if (i === index) btn.classList.add('wrong');
      btn.disabled = true;
    });

    const feedback = document.getElementById('quiz-feedback');
    if (isCorrect) {
      this.quizScore++;
      feedback.classList.add('correct');
      feedback.textContent = '✓ إجابة صحيحة! أحسنت';
    } else {
      this.quizWrong.push({ question: q.question, correct: q.correct, chosen: selectedText });
      feedback.classList.add('wrong');
      feedback.textContent = `✗ الإجابة الصحيحة: ${q.correct}`;
    }

    document.getElementById('quiz-next-btn').style.display = 'block';
  },

  nextQuizQuestion() {
    this.quizIndex++;
    if (this.quizIndex >= this.quizQuestions.length) {
      this.finishQuiz();
    } else {
      this.renderQuizQuestion();
    }
  },

  async finishQuiz() {
    await db.saveQuizResult(this.currentLesson.id, this.quizScore, this.quizQuestions.length, this.quizWrong);

    const percentage = Math.round((this.quizScore / this.quizQuestions.length) * 100);
    const xpEarned = this.quizScore * CONFIG.XP_PER_QUIZ_CORRECT;
    const gemsEarned = Math.floor(xpEarned / 10);

    await gamification.addXP(xpEarned);

    if (percentage === 100) {
      await db.unlockAchievement('perfect_quiz', 'اختبار مثالي', '💯');
    }
    // إنجاز أول اختبار
    const results = db.getLocalQuizResults();
    if (results.length === 1) {
      await db.unlockAchievement('first_quiz', 'مبتدئ الاختبارات', '🎯');
    }

    this.switchScreen('quiz-result-screen');
    document.getElementById('result-icon').textContent = percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '💪';
    document.getElementById('result-title').textContent = percentage >= 80 ? 'ممتاز!' : percentage >= 50 ? 'أحسنت!' : 'لا بأس، حاول مرة أخرى';
    document.getElementById('result-score').textContent = `${this.quizScore}/${this.quizQuestions.length}`;
    document.getElementById('result-percent').textContent = `${percentage}%`;
    document.getElementById('result-xp').textContent = `+${xpEarned} XP`;
    document.getElementById('result-gems').textContent = `+${gemsEarned}`;
  },

  exitQuiz() {
    if (confirm('هل تريد الخروج من الاختبار؟')) {
      this.goBackFromLesson();
    }
  },

  retryQuiz() { this.startQuiz(); },

  // ═══════════════════════════ البحث ═══════════════════════════
  showSearch() {
    this.switchScreen('search-screen');
    document.getElementById('search-input').focus();
  },

  performSearch() {
    const query = document.getElementById('search-input').value.trim();
    const container = document.getElementById('search-results');
    if (!query) { container.innerHTML = ''; return; }

    const results = assistant.searchBook(query);
    if (results.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">لم يتم العثور على نتائج</p>';
      return;
    }

    container.innerHTML = results.slice(0, 20).map(r => `
      <div class="search-result-item" onclick="app.showLesson('${r.id}')">
        <h4>${r.title}</h4>
        <p>${r.simpleExplanation.substring(0, 100)}...</p>
      </div>
    `).join('');
  },

  // ═══════════════════════════ المساعد الذكي ═══════════════════════════
  showAssistant() {
    this.switchScreen('assistant-screen');
    setTimeout(() => document.getElementById('chat-input').focus(), 300);
  },

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const body = document.getElementById('chat-body');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `<p>${this.escapeHtml(text)}</p>`;
    body.appendChild(userMsg);

    input.value = '';
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      const answer = assistant.answer(text);
      const assistantMsg = document.createElement('div');
      assistantMsg.className = 'chat-msg assistant';
      assistantMsg.innerHTML = `<p>${this.escapeHtml(answer).replace(/\n/g, '<br>')}</p>`;
      body.appendChild(assistantMsg);
      body.scrollTop = body.scrollHeight;

      db.unlockAchievement('assistant_first', 'صديق حبيب', '🤖');
    }, 400);
  },

  escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  // ═══════════════════════════ الملف الشخصي ═══════════════════════════
  showProfile() {
    this.switchScreen('profile-screen');
    const name = localStorage.getItem('user_name') || 'الطالب';
    const stats = db.getLocalStats();
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-avatar').textContent = name.charAt(0);
    document.getElementById('profile-title').textContent = gamification.getTitle(stats.level || 1);

    const progress = db.getLocalProgress();
    document.getElementById('p-lessons').textContent =
      Object.values(progress).filter(p => p.status === 'completed').length;
    document.getElementById('p-quizzes').textContent = db.getLocalQuizResults().length;
    document.getElementById('p-badges').textContent = Object.keys(db.getLocalAchievements()).length;
  },

  // ═══════════════════════════ لوحة ولي الأمر ═══════════════════════════
  showParent() {
    this.switchScreen('parent-screen');
    const stats = db.getLocalStats();
    const progress = db.getLocalProgress();
    const results = db.getLocalQuizResults();

    document.getElementById('parent-days').textContent = stats.streak_days || 0;
    document.getElementById('parent-minutes').textContent = stats.total_study_minutes || 0;
    const avg = results.length > 0
      ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length)
      : 0;
    document.getElementById('parent-avg').textContent = `${avg}%`;

    const completedLessons = Object.values(progress).filter(p => p.status === 'completed');
    document.getElementById('parent-lessons-list').innerHTML = completedLessons.slice(0, 5).map(p => {
      const lesson = BOOK_DATA.chapters.flatMap(c => c.lessons).find(l => l.id === p.lesson_id);
      return `<div style="padding:8px 0;border-bottom:1px dashed var(--border)">✓ ${lesson?.title || p.lesson_id}</div>`;
    }).join('') || '<p style="color:var(--text-muted)">لم يتم إكمال أي درس بعد</p>';

    const weakLessons = results.filter(r => r.percentage < 60);
    document.getElementById('parent-weakness').innerHTML = weakLessons.slice(0, 5).map(r => {
      const lesson = BOOK_DATA.chapters.flatMap(c => c.lessons).find(l => l.id === r.lesson_id);
      return `<div style="padding:8px 0;border-bottom:1px dashed var(--border);color:var(--error)">△ ${lesson?.title || r.lesson_id} (${r.percentage}%)</div>`;
    }).join('') || '<p style="color:var(--success)">لا توجد نقاط ضعف حالياً 🎉</p>';
  },

  // ═══════════════════════════ الإنجازات ═══════════════════════════
  showAchievements() {
    this.switchScreen('achievements-screen');
    const unlocked = db.getLocalAchievements();
    document.getElementById('achievements-list').innerHTML = gamification.ACHIEVEMENTS.map(ach => {
      const isUnlocked = !!unlocked[ach.key];
      return `
        <div class="achievement-item ${isUnlocked ? '' : 'locked'}">
          <div class="ach-icon">${ach.icon}</div>
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
      `;
    }).join('');
  },

  // ═══════════════════════════ المفضلة ═══════════════════════════
  showFavorites() {
    this.switchScreen('favorites-screen');
    const favs = Object.values(db.getLocalFavorites());
    if (favs.length === 0) {
      document.getElementById('favorites-list').innerHTML =
        '<p style="text-align:center;color:var(--text-muted);padding:40px">لا توجد مفضلات بعد</p>';
      return;
    }
    document.getElementById('favorites-list').innerHTML = favs.map(f => `
      <div class="favorite-item" onclick="app.showLesson('${f.item_id}')">
        <div style="font-weight:700">${f.item_data?.title || 'مفضلة'}</div>
      </div>
    `).join('');
  },

  // ═══════════════════════════ الشهادة ═══════════════════════════
  showCertificate() {
    this.switchScreen('certificate-screen');
    const progress = db.getLocalProgress();
    const completed = Object.values(progress).filter(p => p.status === 'completed').length;
    const total = BOOK_DATA.stats.totalLessons;

    if (completed < total) {
      document.getElementById('certificate-body').innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:60px;margin-bottom:20px">🔒</div>
          <h3>الشهادة مقفلة</h3>
          <p style="color:var(--text-muted);margin-top:12px">أنهِ جميع الدروس لتحصل على شهادتك</p>
          <p style="margin-top:20px">التقدم: <strong>${completed}/${total}</strong></p>
        </div>
      `;
      return;
    }

    const name = localStorage.getItem('user_name') || 'الطالب';
    const date = new Date().toLocaleDateString('ar-SA');
    const code = 'ATH-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    document.getElementById('certificate-body').innerHTML = `
      <div class="certificate-card">
        <div style="font-size:60px">🏆</div>
        <h1>شهادة إتمام</h1>
        <h2>الذخيرة المشرفة</h2>
        <p>يشهد هذا التطبيق أن الطالب</p>
        <div class="certificate-name">${name}</div>
        <p>قد أنهى قراءة ومراجعة كتاب</p>
        <p style="font-weight:700">"الذخيرة المشرفة"</p>
        <p>تأليف: الحبيب عمر بن محمد بن سالم بن حفيظ</p>
        <p style="margin-top:20px;color:var(--text-muted)">تاريخ الإنجاز: ${date}</p>
        <p style="color:var(--text-muted);font-family:monospace">${code}</p>
        <div class="certificate-actions">
          <button class="btn btn-primary" onclick="window.print()">طباعة</button>
        </div>
      </div>
    `;
  },

  // ═══════════════════════════ الإعدادات ═══════════════════════════
  showSettings() { this.switchScreen('settings-screen'); },

  toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  },

  loadDarkMode() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = theme === 'dark';
  },

  // ═══════════════════════════ الإشعارات ═══════════════════════════
  showNotifications() {
    gamification.showToast('لا توجد إشعارات جديدة');
  },

  // ═══════════════════════════ الصوت (TTS) ═══════════════════════════
  speak(text) {
    if (!('speechSynthesis' in window)) {
      gamification.showToast('الصوت غير مدعوم على هذا الجهاز');
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = CONFIG.TTS_LANG;
    const rateSel = document.getElementById('speech-rate');
    utter.rate = rateSel ? parseFloat(rateSel.value) : CONFIG.TTS_RATE;
    speechSynthesis.speak(utter);
  },

  // ═══════════════════════════ Loading ═══════════════════════════
  showLoading() { document.getElementById('loading').style.display = 'flex'; },
  hideLoading() { document.getElementById('loading').style.display = 'none'; },
};

window.app = app;

// ─── تشغيل التطبيق عند تحميل الصفحة ──
document.addEventListener('DOMContentLoaded', () => app.init());
