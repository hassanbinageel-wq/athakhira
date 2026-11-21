/* ============================================================
   app.js  —  المنطق الرئيسي (نسخة مستقلّة بدون قاعدة بيانات)
   ============================================================ */
'use strict';

const App = (function() {
  let currentChapter = null;
  let currentLesson = null;
  let currentQuizIdx = 0;
  let quizAnswers = [];
  let quizStartTime = 0;
  let lessonQuizTaken = false;
  let recordingIdx = null;
  let currentViewName = 'loading'; // لتتبّع الشاشة الحالية للـ Back button

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ═══════════════════ التهيئة ═══════════════════
  function init() {
    setupBackButton();
    const profile = Profile.load();
    if (!profile) {
      currentViewName = 'onboarding';
      showOnboarding();
    } else {
      afterProfileReady();
    }
  }

  // ═══════════════════ زر الرجوع في أندرويد ═══════════════════
  function setupBackButton() {
    try {
      const CapApp = window.Capacitor?.Plugins?.App;
      if (!CapApp) return; // ليس في بيئة Capacitor (مثلاً معاينة على المتصفح)
      CapApp.addListener('backButton', handleBackButton);
    } catch (e) { /* تجاهل */ }
  }

  function handleBackButton() {
    switch (currentViewName) {
      case 'onboarding':
        // في أول شاشة، لا خروج تلقائي — يبقى في التطبيق
        return;
      case 'home':
        // في الرئيسية، أظهر تأكيد الخروج
        if (confirm('هل تريد الخروج من التطبيق؟')) {
          try { window.Capacitor?.Plugins?.App?.minimizeApp?.(); } catch (e) {}
        }
        return;
      case 'chapter':
      case 'settings':
      case 'recordings':
      case 'certificate':
        goHome();
        return;
      case 'lesson':
      case 'result':
        if (currentChapter && currentChapter.id > 0 && currentChapter.id < 99) {
          openChapter(currentChapter.id);
        } else {
          goHome();
        }
        return;
      case 'quiz':
        if (currentChapter && currentLesson && currentChapter.id > 0 && currentChapter.id < 99) {
          openLesson(currentChapter.id, currentLesson.id);
        } else {
          goHome();
        }
        return;
      default:
        goHome();
    }
  }

  function afterProfileReady() {
    Character.init(Profile.gender, Profile.name);
    Gamification.load(Profile.id);
    SmartReview.load(Profile.id);
    VoiceRecorder.setUser(Profile.id);
    setTimeout(() => Character.greet(), 800);
    showJourneyMap();
  }

  // ═══════════════════ شاشة الترحيب والإعداد ═══════════════════
  function showOnboarding() {
    $('#app').innerHTML = `
      <div class="auth-view">
        <div class="auth-card">
          <div class="auth-logo">📖</div>
          <h1 class="auth-title">${CONFIG.APP_NAME}</h1>
          <p class="auth-subtitle">مرحباً بك! لنبدأ بتعريف بسيط عنك</p>

          <div class="form-group">
            <label>ما اسمك؟</label>
            <input type="text" id="onb-name" placeholder="اكتب اسمك هنا" autofocus />
          </div>

          <div class="form-group">
            <label>كم عمرك؟</label>
            <input type="number" id="onb-age" placeholder="مثلاً: 11" min="6" max="15" value="10" />
          </div>

          <div class="form-group">
            <label>هل أنت:</label>
            <div class="gender-picker">
              <label class="gender-option">
                <input type="radio" name="gender" value="male" checked>
                <div class="gender-card">
                  <img src="assets/characters/boy.png" alt="طفل" />
                  <span>طفل</span>
                </div>
              </label>
              <label class="gender-option">
                <input type="radio" name="gender" value="female">
                <div class="gender-card">
                  <img src="assets/characters/girl.png" alt="طفلة" />
                  <span>طفلة</span>
                </div>
              </label>
            </div>
          </div>

          <button class="btn primary block" onclick="App.completeOnboarding()">
            ابدأ الرحلة 🚀
          </button>

          <div id="onb-error" class="auth-error hidden"></div>

          <div class="onboarding-import">
            <p>عندك نسخة احتياطية من جهاز آخر؟</p>
            <label class="btn secondary small" for="import-file">
              📥 استعادة من ملف
            </label>
            <input type="file" id="import-file" accept=".json" hidden
                   onchange="App.handleImport(event)" />
          </div>
        </div>
      </div>
    `;
  }

  function completeOnboarding() {
    const name = $('#onb-name').value.trim();
    const age = parseInt($('#onb-age').value);
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'male';
    const errBox = $('#onb-error');

    if (!name || name.length < 2) {
      errBox.textContent = 'اكتب اسمك أولاً (حرفين على الأقل)';
      errBox.classList.remove('hidden');
      return;
    }
    if (!age || age < 6 || age > 15) {
      errBox.textContent = 'العمر يجب أن يكون بين ٦ و ١٥';
      errBox.classList.remove('hidden');
      return;
    }

    Profile.create({ name, age, gender });
    afterProfileReady();
  }

  async function handleImport(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const text = await file.text();
    const ok = Profile.importBackup(text);
    if (ok) {
      Gamification.showToast('✅ تمّت استعادة النسخة بنجاح', 'success', 3000);
      setTimeout(() => { window.location.reload(); }, 1200);
    } else {
      const errBox = $('#onb-error');
      errBox.textContent = 'ملف النسخة الاحتياطية غير صالح';
      errBox.classList.remove('hidden');
    }
  }

  // ═══════════════════ خريطة الجبل ═══════════════════
  function showJourneyMap() {
    currentViewName = 'home';
    const level = Gamification.getCurrentLevel();
    const nextLevel = Gamification.getNextLevel();
    const levelProgress = Gamification.getLevelProgress();

    const reviewBadge = SmartReview.shouldReview()
      ? `<button class="review-badge" onclick="App.startReview()">
           🧠 حان وقت المراجعة (${SmartReview.getMistakeCount()} أسئلة)
         </button>` : '';

    // تحديد الفصل الحالي
    let currentChapterId = null;
    for (const ch of CHAPTERS) {
      if (!Gamification.isChapterUnlocked(ch.id)) break;
      const done = Gamification.state.completedLessons.filter(l => l.chapterId === ch.id).length;
      if (done < ch.lessons.length) { currentChapterId = ch.id; break; }
      currentChapterId = ch.id;
    }
    if (currentChapterId === null && CHAPTERS.length > 0) currentChapterId = CHAPTERS[0].id;

    const allDone = CHAPTERS.every(ch => {
      const d = Gamification.state.completedLessons.filter(l => l.chapterId === ch.id).length;
      return d === ch.lessons.length;
    });

    // ═══ الخريطة صورة جاهزة (assets/map/mountain.webp — 1228×2000) ═══
    // اللافتات والأيقونات والنصوص مرسومة في الصورة نفسها،
    // وهنا فقط مناطق ضغط شفّافة فوقها + حالة القفل/الإكمال + الشخصيّة.
    // الإحداثيات بالبكسل في الصورة الأصليّة: [x1, y1, x2, y2]
    const MAP_W = 1228, MAP_H = 2000;
    const hotspots = {
      1: [40, 1570, 800, 2000],   // البوّابة
      2: [810, 1340, 1110, 1545],
      3: [140, 1130, 470, 1385],
      4: [660, 900, 990, 1125],
      5: [70, 760, 430, 1025],
      6: [800, 540, 1100, 825],
      7: [170, 430, 460, 645],
      8: [744, 265, 1070, 455]
    };
    const TROPHY_BOX = [460, 60, 770, 320];
    const boxStyle = ([x1, y1, x2, y2]) =>
      `left:${(x1 / MAP_W * 100).toFixed(2)}%; top:${(y1 / MAP_H * 100).toFixed(2)}%;` +
      ` width:${((x2 - x1) / MAP_W * 100).toFixed(2)}%; height:${((y2 - y1) / MAP_H * 100).toFixed(2)}%;`;

    let signsHTML = '';
    CHAPTERS.forEach((ch) => {
      const box = hotspots[ch.id];
      if (!box) return;
      const unlocked = Gamification.isChapterUnlocked(ch.id);
      const isCurrent = ch.id === currentChapterId;
      const doneCount = Gamification.state.completedLessons.filter(l => l.chapterId === ch.id).length;
      const isDone = doneCount >= ch.lessons.length && ch.lessons.length > 0;
      const action = unlocked ? `App.openChapter(${ch.id})` : `App.showLockedMsg(${ch.id})`;
      signsHTML += `
        <button type="button"
          class="mt-spot ${unlocked ? 'unlocked' : 'locked'} ${isCurrent && unlocked ? 'current' : ''} ${isDone ? 'done' : ''}"
          style="${boxStyle(box)}" onclick="${action}"
          aria-label="الفصل ${toArabicOrdinal(ch.id)}: ${ch.title}">
          ${isDone ? '<span class="mt-spot-badge">✓</span>' : ''}
          ${!unlocked ? '<span class="mt-spot-badge lock">🔒</span>' : ''}
        </button>`;
    });

    // ═══ مواضع الشخصيّة على المسار المرسوم (بكسل في الصورة: [x, y]) ═══
    const walkerByChapter = {
      1: [440, 1880],   // عند مدخل البوّابة (بين الدرفتين)
      2: [940, 1680],   // على المسار تحت لافتة الفصل الثاني
      3: [590, 1300],   // بجانب لافتة الفصل الثالث
      4: [550, 1070],   // بجانب لافتة الفصل الرابع
      5: [555, 1020],   // بجانب لافتة الفصل الخامس
      6: [680, 810],    // بجانب لافتة الفصل السادس
      7: [570, 640],    // بجانب لافتة الفصل السابع
      8: [790, 550]     // تحت لافتة الفصل الثامن
    };
    const [wx, wy] = walkerByChapter[currentChapterId] || walkerByChapter[1];

    const characterHTML = `
      <div class="mt-walker" style="top:${(wy / MAP_H * 100).toFixed(2)}%; left:${(wx / MAP_W * 100).toFixed(2)}%;">
        <div class="mt-walker-glow"></div>
        <img class="mt-walker-img" src="${Character.imgPath}" alt="مكانك في الرحلة"/>
      </div>`;

    // ═══ العبارة التحفيزيّة (تتغيّر مع كل فصل) ═══
    function buildMotivation() {
      const curCh = CHAPTERS.find(c => c.id === currentChapterId);
      const nextCh = CHAPTERS.find(c => c.id === currentChapterId + 1);
      // الفصل التالي يُفتح باجتياز كل دروس الفصل الحالي (لا بالنجوم)
      const passedInCur = Gamification.state.completedLessons
        .filter(l => l.chapterId === currentChapterId).length;
      const left = Math.max(0, (curCh?.lessons.length || 0) - passedInCur);
      const needTxt = left === 1 ? 'درس واحد' : left === 2 ? 'درسان' : `${left} دروس`;

      if (allDone) {
        return {
          emoji: '🏆',
          text: 'أكملت كل الفصول! الكأس ينتظرك في القمّة — ابدأ الاختبار النهائي واحصل على شهادتك.'
        };
      }

      // رسائل مخصّصة لكل فصل
      const perChapter = {
        1: [
          `بدأت الرحلة من البوّابة! تعلّم أركان الدين ثم اصعد نحو ${nextCh?.shortTitle || 'الفصل التالي'} 🌟`,
          `أنت في الأساس المتين. باقي ${needTxt} وتفتح "${nextCh?.shortTitle || ''}" 💧`
        ],
        2: [
          `الطهارة نصف الإيمان! باقي ${needTxt} لتصل إلى "${nextCh?.shortTitle || ''}" 🕌`,
          `أحسنت! كل وضوء تتعلّمه يقرّبك من قمّة الجبل ✨`
        ],
        3: [
          `الصلاة عمود الدين — باقي ${needTxt} وتفتح "${nextCh?.shortTitle || ''}" 🤲`,
          `أنت في منتصف الطريق تقريباً! واصل الصعود 💪`
        ],
        4: [
          `أدعية جميلة تحفظها! باقي ${needTxt} لـ"${nextCh?.shortTitle || ''}" 🌤️`,
          `كل دعاء تحفظه كنزٌ لك. استمرّ! 🗝️`
        ],
        5: [
          `صرت تعرف دعاء كل حال! باقي ${needTxt} لـ"${nextCh?.shortTitle || ''}" 📜`,
          `تجاوزت نصف الجبل — القمّة أقرب مما تظنّ 🏔️`
        ],
        6: [
          `تتعرّف على نبيّك ﷺ — باقي ${needTxt} لـ"${nextCh?.shortTitle || ''}" 🕌`,
          `معرفة النبي ﷺ شرف عظيم. واصل يا بطل! 💚`
        ],
        7: [
          `باقي فصل واحد فقط! ${needTxt} وتفتح "${nextCh?.shortTitle || ''}" 🌅`,
          `أنت قريب جداً من القمّة — لا تتوقّف الآن! ⛰️`
        ],
        8: [
          `الفصل الأخير! أكمله ليفتح لك الكأس والشهادة 🏆`,
          `خطوة أخيرة وتصل للقمّة — أنت رائع! ⭐`
        ]
      };

      const msgs = perChapter[currentChapterId] || [`واصل التعلّم، أنت تبلي بلاءً حسناً! 🌟`];
      // نختار الرسالة حسب التقدّم داخل الفصل
      const doneInCh = Gamification.state.completedLessons
        .filter(l => l.chapterId === currentChapterId).length;
      const pick = doneInCh === 0 ? 0 : (msgs.length > 1 ? 1 : 0);

      return { emoji: curCh?.icon || '🌟', text: msgs[pick] };
    }
    const motivation = buildMotivation();

    // الكأس مرسوم في الصورة؛ هنا منطقة الضغط فقط
    const trophyHTML = `
      <button type="button" class="mt-spot mt-spot-trophy ${allDone ? 'unlocked current' : 'locked'}"
        style="${boxStyle(TROPHY_BOX)}"
        onclick="${allDone ? 'App.startFinalExam()' : 'App.showFinalLockedMsg()'}"
        aria-label="الاختبار النهائي">
        ${!allDone ? '<span class="mt-spot-badge lock">🔒</span>' : ''}
      </button>`;

    $('#app').innerHTML = `
      <div class="home-view">
        <header class="home-header hc-header">
          <div class="hh-user">
            <img class="hh-avatar" src="${Character.imgPath}" alt="أنت"/>
            <div>
              <div class="hh-name">${Profile.name}</div>
              <div class="hh-level">${level.icon} ${level.name}</div>
            </div>
          </div>
          <div class="hh-actions">
            <button class="hh-btn" onclick="App.showRecordings()" title="تسجيلات الطفل">🎧</button>
            <button class="hh-btn" onclick="App.showSettings()" title="الإعدادات">⚙️</button>
          </div>
        </header>

        <div class="hc-stats" ${nextLevel ? 'onclick="App.showLevelDetails()"' : ''}>
          <div class="hc-chips">
            <span class="hc-chip">⭐ <b>${Gamification.stars}</b> نجمة</span>
            <span class="hc-chip">🔥 <b>${Gamification.streak}</b> يوم</span>
            <span class="hc-chip">⚡ <b>${Gamification.xp}</b> XP</span>
          </div>
          ${nextLevel ? `
            <div class="hc-level">
              <span>${level.icon}</span>
              <div class="hc-track"><div class="hc-fill" style="width:${levelProgress}%"></div></div>
              <span>${nextLevel.icon} ${nextLevel.name}</span>
            </div>` : ''}
        </div>

        ${reviewBadge}

        <h2 class="road-heading hc-heading">🏔️ رحلة التعلّم</h2>

        <div class="motivation-banner">
          <span class="motiv-emoji">${motivation.emoji}</span>
          <span class="motiv-text">${motivation.text}</span>
        </div>

        <div class="mountain-scene mountain-scene-img">
          <img class="mountain-img" src="assets/map/mountain.webp" alt="خريطة رحلة التعلّم" draggable="false"/>

          <div class="mountain-overlay">
            ${trophyHTML}
            ${signsHTML}
            ${characterHTML}
          </div>
        </div>
      </div>
    `;

    fitMapToScreen();

    // إشعار فتح فصل جديد (إن وُجد)
    const newUnlock = sessionStorage.getItem('newlyUnlocked');
    if (newUnlock) {
      sessionStorage.removeItem('newlyUnlocked');
      try {
        const info = JSON.parse(newUnlock);
        setTimeout(() => showUnlockBanner(info), 400);
      } catch (e) {}
    }
  }

  // الخريطة تأخذ ما تبقّى من ارتفاع الشاشة تحت المعلومات العلويّة وتصغر بنسبتها لتظهر كاملة
  function fitMapToScreen() {
    const scene = document.querySelector('.mountain-scene-img');
    if (!scene) return;
    scene.style.width = '';
    const fullW = scene.parentElement.clientWidth;
    const top = scene.getBoundingClientRect().top + window.scrollY;
    const avail = window.innerHeight - top - 12;
    const w = Math.max(240, Math.min(fullW, Math.floor(avail * 1228 / 2000)));
    scene.style.width = w + 'px';
  }
  window.addEventListener('resize', () => { if (currentViewName === 'home') fitMapToScreen(); });

  // ═══════════════════ إشعار فتح الفصل الجديد ═══════════════════
  function showUnlockBanner(info) {
    // إزالة أي بانر سابق
    document.querySelectorAll('.unlock-banner-overlay').forEach(el => el.remove());

    // اختيار صورة الشخصيّة المبتهجة حسب الجنس
    const happyImg = Character.gender === 'girl'
      ? 'assets/characters/girl-happy.png'
      : 'assets/characters/boy-happy.png';

    const overlay = document.createElement('div');
    overlay.className = 'unlock-banner-overlay';
    overlay.innerHTML = `
      <div class="unlock-stage">
        <img class="unlock-char" src="${happyImg}" alt="مبتهج"/>
        <div class="unlock-banner">
          <div class="unlock-confetti">🎉 ✨ 🎊 ⭐ ✨</div>
          <div class="unlock-icon">🔓</div>
          <div class="unlock-title">تم فتح</div>
          <div class="unlock-chapter">الفصل ${toArabicOrdinal(info.chapterId)}</div>
          <div class="unlock-subtitle">${info.title}</div>
          <button class="btn gold block unlock-btn" onclick="App.dismissUnlockBanner()">
            🚀 هيا بنا نبدأ!
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function dismissUnlockBanner() {
    const overlay = document.querySelector('.unlock-banner-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 500);
    }
    // ضمان الانتقال لخريطة رحلة التعلّم
    if (currentViewName !== 'home') {
      goHome();
    }
  }
  function toArabicOrdinal(n) {
    const names = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
    return names[n - 1] || n;
  }

  function showFinalLockedMsg() {
    Character.sayCustom('🏆 الاختبار النهائي يُفتح بعد أن تُكمل جميع الفصول الثمانية. واصل الصعود! 💪');
  }

  function showLockedMsg(chapterId) {
    const targetCh = CHAPTERS.find(c => c.id === chapterId);
    if (!targetCh) return;

    // إيجاد الفصل غير المكتمل الذي يمنع الوصول
    let totalRemaining = 0;
    let blocker = null;
    for (let id = 1; id < chapterId; id++) {
      const ch = CHAPTERS.find(c => c.id === id);
      if (!ch) continue;
      const doneInCh = Gamification.state.completedLessons
        .filter(l => l.chapterId === id).length;
      const rem = ch.lessons.length - doneInCh;
      if (rem > 0) {
        if (!blocker) blocker = ch;
        totalRemaining += rem;
      }
    }

    if (totalRemaining === 0) return;

    const targetTitle = targetCh.shortTitle || targetCh.title;
    const blockerTitle = blocker.shortTitle || blocker.title;
    const drsWord = totalRemaining === 1 ? 'درس' : totalRemaining === 2 ? 'درسان' : 'دروس';
    Character.sayCustom(
      `🔒 باقي ${totalRemaining} ${drsWord} لإكمال "${blockerTitle}" قبل فتح "${targetTitle}"! 💪`,
      5500
    );
  }

  // ═══════════════════ الإعدادات وأولياء الأمور ═══════════════════
  function showSettings() {
    currentViewName = 'settings';
    const recordings = VoiceRecorder.listAllRecordings();

    $('#app').innerHTML = `
      <div class="settings-view">
        <header class="lesson-header" style="background: var(--emerald-800)">
          <button class="back-btn" onclick="App.goHome()">→</button>
          <div>
            <div class="lesson-header-crumb">القائمة</div>
            <div class="lesson-header-title">الإعدادات</div>
          </div>
        </header>

        <div class="settings-body">
          <div class="settings-section">
            <h3>👤 الملف الشخصي</h3>
            <div class="settings-item">
              <img src="${Character.imgPath}" class="settings-avatar" alt=""/>
              <div>
                <div class="settings-item-name">${Profile.name}</div>
                <div class="settings-item-sub">${Profile.current.age} سنة · ${Profile.gender === 'male' ? 'طفل' : 'طفلة'}</div>
              </div>
              <button class="btn secondary small" onclick="App.editProfile()">تعديل</button>
            </div>
          </div>

          <div class="settings-section">
            <h3>📚 كتاب الذخيرة المشرفة</h3>
            <p class="settings-hint">النسخة الكاملة من الكتاب متوفّرة للتحميل والقراءة</p>
            <button class="btn primary block" onclick="App.downloadBook()">
              📥 فتح/تحميل الكتاب PDF
            </button>
          </div>

          <div class="settings-section">
            <h3>💾 النسخ الاحتياطي</h3>
            <p class="settings-hint">احفظ تقدّمك في ملف لتنقله لجهاز آخر أو تسترجعه لاحقاً</p>
            <button class="btn primary block" onclick="App.exportProgress()">
              📤 حفظ نسخة احتياطية
            </button>
            <label class="btn secondary block" for="import-file-2" style="margin-top:8px">
              📥 استعادة من ملف
            </label>
            <input type="file" id="import-file-2" accept=".json" hidden
                   onchange="App.handleImport(event)" />
          </div>

          <div class="settings-section cert-section">
            <h3>🎓 الشهادة</h3>
            ${hasCertificate() ? `
              <p class="settings-hint">مبروك! لقد أتممت الكتاب واجتزت الاختبار النهائي.</p>
              <button class="btn gold block" onclick="App.showCertificate()">
                📜 عرض شهادة الإتمام
              </button>
            ` : `
              <p class="settings-hint">
                تُفتح الشهادة بعد إكمال كل الفصول واجتياز
                <strong>الاختبار النهائي بعلامة كاملة</strong>.
              </p>
              <div class="cert-locked-box">
                <span class="cert-locked-icon">🔒</span>
                <span>الشهادة مقفلة حتى الآن</span>
              </div>
            `}
          </div>

          <div class="settings-section danger-section">
            <h3>⚠️ منطقة الخطر</h3>
            <p class="settings-hint">مسح كل التقدّم والبيانات والبدء من جديد. لا يمكن التراجع.</p>
            <button class="btn danger block" onclick="App.resetAll()">
              🗑️ مسح كل شيء والبدء من جديد
            </button>
          </div>

          <div class="settings-footer">
            <p>${CONFIG.APP_NAME} · إصدار ${CONFIG.APP_VERSION}</p>
          </div>
        </div>
      </div>
    `;
  }

  function editProfile() {
    const name = prompt('الاسم الجديد:', Profile.name);
    if (name && name.trim().length >= 2) {
      Profile.update({ name: name.trim() });
      Character.setName(name.trim());
      Gamification.showToast('✅ تمّ تحديث الاسم', 'success');
      setTimeout(showSettings, 500);
    }
  }

  async function exportProgress() {
    const ok = await Profile.downloadBackup();
    if (ok) {
      Gamification.showToast('✅ افتح قائمة المشاركة واختر مكان الحفظ', 'success', 3500);
    } else {
      // إذا رجعت false — قد يكون المستخدم أغلق المربّع (لا حاجة لعرض خطأ)
      // نُظهر رسالة فقط لو المستخدم نفذ الطريقة القديمة وفشلت
    }
  }

  function resetAll() {
    if (!confirm('هل أنت متأكد؟ سيتم مسح كل تقدّمك والنجوم والتسجيلات نهائياً.')) return;
    if (!confirm('تأكيد ثانٍ: هذا الإجراء لا رجعة فيه. مسح كل شيء؟')) return;
    Profile.reset();
    Character.forceHide();
    window.location.reload();
  }

  function playRec(key) {
    const dataUrl = localStorage.getItem(key);
    if (!dataUrl) return;
    const audio = new Audio(dataUrl);
    audio.play();
  }

  // ═══════════════════ فتح فصل ═══════════════════
  function openChapter(chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch || !Gamification.isChapterUnlocked(chapterId)) return;
    currentChapter = ch;
    currentViewName = 'chapter';

    let lessonsHTML = '';
    ch.lessons.forEach((lesson) => {
      const isUnlocked = Gamification.isLessonUnlocked(chapterId, lesson.id);
      const isDone = Gamification.state.completedLessons.some(l =>
        l.chapterId === chapterId && l.lessonId === lesson.id);
      const remaining = Gamification.lessonsUntilNext(chapterId, lesson.id);

      // حساب الدرجة الفعليّة للدرس (من 100/عدد الدروس)
      let scoreLine = '';
      if (isDone) {
        const earned = Gamification.getLessonScore(chapterId, lesson.id);
        const max = Gamification.lessonMaxScore(chapterId);
        const fmt = (n) => n % 1 === 0 ? n : (Math.round(n * 10) / 10);
        const percent = max > 0 ? Math.round((earned / max) * 100) : 0;

        let cheer = '';
        if (percent === 100) cheer = 'أحسنت! علامة كاملة';
        else if (percent >= 80) cheer = 'ممتاز';
        else if (percent >= 65) cheer = 'جيّد جداً';
        else cheer = 'مقبول';

        scoreLine = `
          <div class="lesson-score-line">
            ✨ ${cheer}! حصلت على <strong>${fmt(earned)} / ${fmt(max)}</strong> 🎉
          </div>`;
      }

      lessonsHTML += `
        <div class="lesson-card ${isDone ? 'done' : ''} ${isUnlocked ? '' : 'locked'}"
             onclick="${isUnlocked ? `App.openLesson(${chapterId}, ${lesson.id})` : ''}">
          <div class="lesson-num" style="background: ${ch.color}">${lesson.id}</div>
          <div class="lesson-body">
            <div class="lesson-title">${lesson.title}</div>
            ${isDone ? '<span class="badge success">✓ مكتمل</span>' :
              isUnlocked ? '<span class="badge ready">جاهز للبدء</span>' :
              `<span class="badge locked">🔒 باقي لك ${remaining} درس فقط!</span>`}
            ${scoreLine}
          </div>
          <div class="lesson-arrow">←</div>
        </div>
      `;
    });

    $('#app').innerHTML = `
      <div class="chapter-view">
        <header class="chapter-header" style="background: ${ch.color}">
          <button class="back-btn" onclick="App.goHome()">→</button>
          <div class="chapter-header-icon">${ch.icon}</div>
          <div>
            <div class="chapter-header-num">الفصل ${ch.id}</div>
            <div class="chapter-header-title">${ch.title}</div>
          </div>
        </header>
        <div class="chapter-body">
          <p class="chapter-desc">${ch.description}</p>
          <div class="lessons-list">${lessonsHTML}</div>
        </div>
      </div>
    `;
  }

  // ═══════════════════ فتح درس ═══════════════════
  function renderLessonSections(lesson) {
    const s = lesson.sections || {};
    let html = '';

    if (s.original) {
      html += `
        <div class="lesson-section section-original">
          <div class="section-title">📖 النصّ الأصلي من الكتاب</div>
          <div class="section-body">${s.original}</div>
        </div>`;
    }
    if (s.simple) {
      html += `
        <div class="lesson-section section-simple">
          <div class="section-title">💡 الشرح المبسّط</div>
          <div class="section-body"><p>${s.simple}</p></div>
        </div>`;
    }
    if (s.hardWords && s.hardWords.length) {
      html += `
        <div class="lesson-section section-hard">
          <div class="section-title">🔍 الكلمات الصعبة</div>
          <div class="section-body">
            <div class="hard-words-grid">
              ${s.hardWords.map(w => `
                <div class="hard-word">
                  <span class="hw-word">${w.word}</span>
                  <span class="hw-arrow">←</span>
                  <span class="hw-meaning">${w.meaning}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`;
    }
    if (s.example) {
      html += `
        <div class="lesson-section section-example">
          <div class="section-title">🌟 مثال من حياتك</div>
          <div class="section-body"><p>${s.example}</p></div>
        </div>`;
    }
    if (s.learned && s.learned.length) {
      html += `
        <div class="lesson-section section-learned">
          <div class="section-title">✅ ماذا تعلّمنا؟</div>
          <div class="section-body">
            <ul class="learned-list">
              ${s.learned.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>`;
    }
    if (s.mainIdea) {
      html += `
        <div class="lesson-section section-main">
          <div class="section-title">💎 الفكرة الرئيسية</div>
          <div class="section-body"><p>${s.mainIdea}</p></div>
        </div>`;
    }
    if (s.memorize) {
      html += `
        <div class="lesson-section section-memorize">
          <div class="section-title">📌 احفظ هذا</div>
          <div class="section-body"><p class="memorize-text">${s.memorize}</p></div>
        </div>`;
    }
    return html;
  }

  // فيديو نهاية الدرس: assets/video/<الفصل>-<الدرس>.mp4
  // إن لم يوجد الملف يُحذف القسم تلقائياً (فلا يلزم تسجيل الفيديوهات في أي قائمة)
  function renderLessonVideo(chapterId, lessonId) {
    return `
      <div class="lesson-section section-video">
        <div class="section-title">🎬 شاهد الدرس</div>
        <div class="section-body">
          <video class="lesson-video" controls playsinline preload="metadata"
                 controlsList="nodownload"
                 src="assets/video/${chapterId}-${lessonId}.mp4"
                 onerror="this.closest('.section-video')?.remove()"></video>
        </div>
      </div>`;
  }

  function openLesson(chapterId, lessonId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    const lesson = ch?.lessons.find(l => l.id === lessonId);
    if (!lesson || !Gamification.isLessonUnlocked(chapterId, lessonId)) return;

    currentChapter = ch;
    currentLesson = lesson;
    currentViewName = 'lesson';
    lessonQuizTaken = Gamification.state.completedLessons.some(l =>
      l.chapterId === chapterId && l.lessonId === lessonId);

    setTimeout(() => Character.lessonStart(), 500);

    const thinkQuestions = (lesson.quiz || []).filter(q => q.type === 'think');
    const gradedQuestions = (lesson.quiz || []).filter(q => q.type !== 'think');

    let thinkHTML = '';
    if (thinkQuestions.length > 0) {
      thinkHTML = `
        <div class="think-section">
          <h3>💭 فكّر قليلاً</h3>
          ${thinkQuestions.map((q, i) => {
            const hasRec = VoiceRecorder.hasRecording(chapterId, lessonId, i);
            return `
              <div class="think-card">
                <p class="think-q">${q.q}</p>
                ${q.hint ? `<p class="think-hint">💡 ${q.hint}</p>` : ''}
                <div class="think-actions">
                  <button class="btn record-btn" id="rec-btn-${i}"
                          onclick="App.toggleRecord(${chapterId}, ${lessonId}, ${i})">
                    🎙️ ${hasRec ? 'أعِد التسجيل' : 'اضغط لتسجيل صوتك'}
                  </button>
                  ${hasRec ? `
                    <button class="btn secondary" onclick="App.playRecording(${chapterId}, ${lessonId}, ${i})">
                      ▶️ استمع لصوتك
                    </button>
                  ` : ''}
                </div>
                <div class="rec-status" id="rec-status-${i}"></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    $('#app').innerHTML = `
      <div class="lesson-view">
        <header class="lesson-header" style="background: ${ch.color}">
          <button class="back-btn" onclick="App.openChapter(${ch.id})">→</button>
          <div>
            <div class="lesson-header-crumb">الفصل ${ch.id} · ${ch.title}</div>
            <div class="lesson-header-title">${lesson.title}</div>
          </div>
        </header>

        <div class="lesson-body">
          ${renderLessonSections(lesson)}

          ${renderLessonVideo(chapterId, lessonId)}

          ${thinkHTML}

          <div class="lesson-actions">
            <button class="btn primary block" onclick="App.startQuiz()"
                    ${gradedQuestions.length === 0 ? 'disabled' : ''}>
              ${gradedQuestions.length === 0 ? 'لا يوجد اختبار' : 'ابدأ اختبار الدرس'}
            </button>
            <button class="btn secondary block" onclick="App.finishLesson()"
                    id="finish-btn" ${lessonQuizTaken ? '' : 'disabled'}
                    title="${lessonQuizTaken ? '' : 'أكمل الاختبار بعلامة كاملة أولاً'}">
              ${lessonQuizTaken ? '✓ أنهيت الدرس' : '🔒 أكمل الاختبار كاملاً لإنهاء الدرس'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════ التسجيل الصوتي ═══════════════════
  async function toggleRecord(chapterId, lessonId, qIdx) {
    const btn = document.getElementById(`rec-btn-${qIdx}`);
    const status = document.getElementById(`rec-status-${qIdx}`);

    if (recordingIdx === qIdx) {
      // إيقاف تسجيل جارٍ
      const blob = await VoiceRecorder.stop();
      recordingIdx = null;
      btn.classList.remove('recording');
      if (!blob) {
        status.textContent = '⚠️ لم يُسجَّل شيء';
        return;
      }
      status.textContent = '⏳ جارٍ الحفظ...';
      const res = await VoiceRecorder.saveRecording(chapterId, lessonId, qIdx, blob);
      if (res && res.ok) {
        status.textContent = `✅ حُفظ التسجيل (${res.sizeKB} كيلوبايت)`;
        setTimeout(() => openLesson(chapterId, lessonId), 900);
      } else {
        status.textContent = '⚠️ فشل الحفظ';
        alert(res?.message || 'تعذّر حفظ التسجيل — حاول مجدّداً');
      }
      return;
    }

    // بدء تسجيل جديد — نتحقّق من الإذن أوّلاً
    const permOk = await ensureMicPermission();
    if (!permOk) return;

    await VoiceRecorder.start(
      () => {
        recordingIdx = qIdx;
        btn.classList.add('recording');
        btn.textContent = '⏹️ إيقاف التسجيل';
        status.textContent = '🔴 جارٍ التسجيل...';
      },
      (err) => showMicPermissionDialog(err)
    );
  }

  // نتحقّق من حالة إذن الميكروفون؛ إن لم يكن ممنوحاً نطلبه من داخل التطبيق
  async function ensureMicPermission() {
    // ١) التحقّق عبر Permissions API (متوفّرة في معظم WebViews الحديثة)
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        if (result.state === 'granted') return true;
        if (result.state === 'denied') {
          showMicPermissionDialog('كان قد تمّ رفض الإذن سابقاً');
          return false;
        }
        // 'prompt' — نُظهر شرحاً ثم نطلب الإذن
        return await requestMicWithDialog();
      }
    } catch (e) { /* بعض المتصفّحات لا تدعم مصدر 'microphone' */ }
    // ٢) لا يوجد Permissions API — نطلب مباشرة عبر مربّع حوار مخصّص
    return await requestMicWithDialog();
  }

  // مربّع حوار داخل التطبيق يشرح للطفل قبل ظهور طلب أندرويد الأصلي
  function requestMicWithDialog() {
    return new Promise((resolve) => {
      // منع فتح أكثر من مربّع في نفس الوقت
      document.querySelectorAll('.mic-perm-overlay').forEach(el => el.remove());

      const overlay = document.createElement('div');
      overlay.className = 'mic-perm-overlay';
      overlay.innerHTML = `
        <div class="mic-perm-box">
          <div class="mic-perm-icon">🎤</div>
          <div class="mic-perm-title">الإذن بالتسجيل الصوتي</div>
          <div class="mic-perm-text">
            نحتاج إذنك لاستخدام الميكروفون
            حتى نُسجّل إجابتك على سؤال "فكّر قليلاً".
            <br/><br/>
            <strong>لن نستخدم الميكروفون لأيّ شيء آخر</strong>،
            وكل تسجيلاتك تبقى محفوظة في جهازك فقط.
          </div>
          <div class="mic-perm-actions">
            <button class="btn primary block" id="mic-perm-allow">
              🎤 السماح بالتسجيل
            </button>
            <button class="btn secondary block" id="mic-perm-cancel">
              ليس الآن
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));

      const cleanup = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
      };

      document.getElementById('mic-perm-allow').onclick = async () => {
        cleanup();
        // تشغيل getUserMedia مباشرة → أندرويد يُظهر طلب الإذن الأصلي
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          // أغلق الـstream التجريبي فوراً (سنفتحه من جديد بعد قليل عبر MediaRecorder)
          s.getTracks().forEach(t => t.stop());
          resolve(true);
        } catch (e) {
          showMicPermissionDialog(e.name === 'NotAllowedError'
            ? 'تمّ رفض الإذن'
            : (e.message || 'تعذّر الوصول للميكروفون'));
          resolve(false);
        }
      };

      document.getElementById('mic-perm-cancel').onclick = () => {
        cleanup();
        resolve(false);
      };
    });
  }

  // عند رفض الإذن نهائيّاً — نُوجّه المستخدم للإعدادات
  function showMicPermissionDialog(errMsg) {
    document.querySelectorAll('.mic-perm-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'mic-perm-overlay';
    overlay.innerHTML = `
      <div class="mic-perm-box denied">
        <div class="mic-perm-icon">🔒</div>
        <div class="mic-perm-title">الإذن مرفوض</div>
        <div class="mic-perm-text">
          ${errMsg ? `<em>${errMsg}</em><br/><br/>` : ''}
          حتى تُفعّل الميكروفون:
          <ol style="text-align: right; margin: 10px 20px 0; padding: 0;">
            <li>افتح <strong>إعدادات هاتفك</strong></li>
            <li>التطبيقات ← <strong>الذخيرة المشرّفة</strong></li>
            <li>الأذونات ← <strong>الميكروفون</strong> ← اختر <strong>"السماح"</strong></li>
            <li>ارجع للتطبيق وحاول مجدّداً</li>
          </ol>
        </div>
        <div class="mic-perm-actions">
          <button class="btn primary block" id="mic-perm-close">
            حسناً، فهمت
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    document.getElementById('mic-perm-close').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    };
  }

  function playRecording(chapterId, lessonId, qIdx) {
    const dataUrl = VoiceRecorder.getRecording(chapterId, lessonId, qIdx);
    if (!dataUrl) return;
    new Audio(dataUrl).play();
  }

  // ═══════════════════ الاختبار ═══════════════════
  function startQuiz() {
    const gradedQuestions = (currentLesson.quiz || []).filter(q => q.type !== 'think');
    if (gradedQuestions.length === 0) return;
    currentQuizIdx = 0;
    quizAnswers = [];
    quizStartTime = Date.now();
    renderQuizQuestion(gradedQuestions);
  }

  function renderQuizQuestion(questions) {
    currentViewName = 'quiz';
    const q = questions[currentQuizIdx];
    const total = questions.length;

    let questionHTML = '';
    if (q.type === 'mcq') {
      questionHTML = q.options.map((opt, i) => `
        <button class="quiz-option" onclick="App.answerQuiz(${i})">
          <span class="opt-letter">${['أ','ب','ج','د'][i]}</span>
          <span>${opt}</span>
        </button>
      `).join('');
    } else if (q.type === 'tf') {
      questionHTML = `
        <button class="quiz-option tf" onclick="App.answerQuiz(true)">✓ صح</button>
        <button class="quiz-option tf" onclick="App.answerQuiz(false)">✗ خطأ</button>
      `;
    } else if (q.type === 'fill') {
      // "أكمل الفراغ" صار اختيار الكلمة الصحيحة بالضغط (أسهل للأطفال)
      const opts = buildFillOptions(q);
      questionHTML = `
        <div class="fill-sentence">${q.q.replace(/_{2,}|______/g, '<span class="fill-blank">؟</span>')}</div>
        <p class="fill-instruction">اختر الكلمة الصحيحة:</p>
        <div class="fill-choices" id="fill-choices">
          ${opts.map((o, i) => `
            <button class="fill-choice" onclick="App.answerFillChoice(${i})">${o}</button>
          `).join('')}
        </div>
        ${q.hint ? `<p class="quiz-hint">💡 ${q.hint}</p>` : ''}
      `;
      window._fillOptions = opts;
    } else if (q.type === 'match') {
      // سؤال توصيل: عمود يمين (المفاتيح) وعمود يسار (القيم المخلوطة)
      const rights = q.pairs.map((p, i) => ({ text: p[1], idx: i }))
        .sort(() => Math.random() - 0.5);
      questionHTML = `
        <p class="fill-instruction">اضغط كلمة من اليمين ثم معناها من اليسار — سترى خط التوصيل</p>
        <div class="match-grid-wrap">
          <svg class="match-lines-svg" id="match-lines-svg"></svg>
          <div class="match-grid" id="match-grid">
            <div class="match-col match-col-right">
              ${q.pairs.map((p, i) => `
                <button class="match-item match-key" data-key="${i}"
                        onclick="App.selectMatchKey(${i})">${p[0]}</button>
              `).join('')}
            </div>
            <div class="match-col match-col-left">
              ${rights.map(r => `
                <button class="match-item match-val" data-val="${r.idx}"
                        onclick="App.selectMatchVal(${r.idx})">${r.text}</button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="match-status" id="match-status">وصّل ${q.pairs.length} أزواج</div>
        <button class="btn primary block" onclick="App.answerMatch()" id="match-submit" disabled>
          تحقّق من التوصيل
        </button>
      `;
      window._matchPairs = {};
      window._matchSelectedKey = null;
    } else if (q.type === 'order') {
      // items دائماً بالترتيب الصحيح — نُخلطها فقط للعرض
      const shuffled = q.items.map((it, i) => ({ text: it, originalIdx: i }))
        .sort(() => Math.random() - 0.5);
      questionHTML = `
        <div class="order-list" id="order-list">
          ${shuffled.map(it => `
            <div class="order-item" draggable="true" data-idx="${it.originalIdx}">
              <span class="order-handle">☰</span>
              <span>${it.text}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn primary block" onclick="App.answerOrder()">تحقّق من الترتيب</button>
      `;
    }

    $('#app').innerHTML = `
      <div class="quiz-view">
        <header class="quiz-header">
          <button class="back-btn" onclick="App.openLesson(${currentChapter.id}, ${currentLesson.id})">→</button>
          <div class="quiz-progress">
            <div class="qp-track">
              <div class="qp-fill" style="width: ${((currentQuizIdx+1)/total)*100}%"></div>
            </div>
            <span>${currentQuizIdx + 1} / ${total}</span>
          </div>
        </header>

        <div class="quiz-body">
          <div class="quiz-topic">${q.topic || ''}</div>
          ${q.type === 'fill' ? '' : `<h2 class="quiz-question">${q.q}</h2>`}
          <div class="quiz-options">${questionHTML}</div>
          <div class="quiz-feedback" id="quiz-feedback" aria-live="polite"></div>
        </div>
      </div>
    `;

    if (q.type === 'order') initDragDrop();
    if (q.type === 'match') {
      // إعادة رسم الخطوط عند تغيير حجم النافذة (لتفادي انحرافها بعد كيبورد أو دوران)
      window.addEventListener('resize', drawMatchLines);
      setTimeout(drawMatchLines, 100); // بعد اكتمال التخطيط
    }
  }

  function initDragDrop() {
    const list = document.getElementById('order-list');
    let dragging = null;
    list.querySelectorAll('.order-item').forEach(item => {
      item.addEventListener('dragstart', () => { dragging = item; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => { dragging?.classList.remove('dragging'); dragging = null; });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const rect = item.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        list.insertBefore(dragging, after ? item.nextSibling : item);
      });
    });
  }

  function answerQuiz(answer) {
    if (window._answering) return; // منع الضغط أثناء ظهور اللون
    const questions = currentLesson.quiz.filter(q => q.type !== 'think');
    const q = questions[currentQuizIdx];
    const correct = answer === q.answer;
    flashOption(q.type, answer, correct);
    handleAnswer(q, answer, correct, questions);
  }

  // ═══════════════════ تطبيع النصّ العربي (ة=ه، أ=ا، ى=ي، ال) ═══════════════════
  function normalizeArabic(s) {
    if (s === undefined || s === null) return '';
    let t = String(s);
    t = t.replace(/[\u064B-\u0652\u0670\u0640]/g, ''); // تشكيل + تطويل
    t = t.replace(/[أإآٱا]/g, 'ا');                     // كل أشكال الألف
    t = t.replace(/ة/g, 'ه');                           // التاء المربوطة = هاء
    t = t.replace(/[ىي]/g, 'ي');                        // الألف المقصورة = ياء
    t = t.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '');
    t = t.replace(/^ال/, '');                           // تجاهل "ال" التعريف
    t = t.replace(/[\s\-_.,،؛:!؟"'()]/g, '');           // مسافات وترقيم
    return t.trim();
  }

  function answersMatch(given, expected) {
    return normalizeArabic(given) === normalizeArabic(expected);
  }

  // ═══════════════════ بناء خيارات "أكمل الفراغ" ═══════════════════
  function buildFillOptions(q) {
    if (q.options && q.options.length) return q.options;
    // نولّد مشتّتات من كلمات في نفس الفصل
    const pool = [];
    (currentChapter?.lessons || []).forEach(l => {
      (l.quiz || []).forEach(qq => {
        if (qq.type === 'fill' && qq.answer && !answersMatch(qq.answer, q.answer)) {
          pool.push(qq.answer);
        }
      });
    });
    const uniq = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3);
    const fallback = ['الصلاة', 'الإيمان', 'الطهارة', 'الذكر', 'الدعاء']
      .filter(w => !answersMatch(w, q.answer));
    while (uniq.length < 3 && fallback.length) uniq.push(fallback.shift());
    return [q.answer, ...uniq].sort(() => Math.random() - 0.5);
  }

  function answerFillChoice(idx) {
    if (window._answering) return;
    const questions = currentLesson.quiz.filter(q => q.type !== 'think');
    const q = questions[currentQuizIdx];
    const chosen = (window._fillOptions || [])[idx];
    const correct = answersMatch(chosen, q.answer);
    flashOption('fillchoice', idx, correct);
    handleAnswer(q, chosen, correct, questions);
  }

  // ═══════════════════ سؤال التوصيل ═══════════════════
  function selectMatchKey(keyIdx) {
    if (window._answering) return;
    window._matchSelectedKey = keyIdx;
    document.querySelectorAll('.match-key').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.match-key[data-key="${keyIdx}"]`)?.classList.add('selected');
  }

  function selectMatchVal(valIdx) {
    if (window._answering) return;
    const keyIdx = window._matchSelectedKey;
    if (keyIdx === null || keyIdx === undefined) {
      $('#match-status').textContent = '👈 اختر كلمة من اليمين أولاً';
      return;
    }
    // امنع تكرار نفس القيمة على مفتاحين
    Object.keys(window._matchPairs).forEach(k => {
      if (window._matchPairs[k] === valIdx) delete window._matchPairs[k];
    });
    window._matchPairs[keyIdx] = valIdx;
    window._matchSelectedKey = null;
    renderMatchState();
  }

  function renderMatchState() {
    const questions = currentLesson.quiz.filter(q => q.type !== 'think');
    const q = questions[currentQuizIdx];
    const pairs = window._matchPairs || {};

    document.querySelectorAll('.match-key').forEach(el => {
      const k = el.dataset.key;
      el.classList.remove('selected');
      el.classList.toggle('paired', pairs[k] !== undefined);
    });
    document.querySelectorAll('.match-val').forEach(el => {
      const v = +el.dataset.val;
      el.classList.toggle('paired', Object.values(pairs).includes(v));
    });

    const done = Object.keys(pairs).length;
    const total = q.pairs.length;
    $('#match-status').textContent = done === total
      ? '✅ اكتملت كل التوصيلات — اضغط تحقّق'
      : `وصّلت ${done} من ${total}`;
    $('#match-submit').disabled = done !== total;

    // رسم خطوط التوصيل
    drawMatchLines();
  }

  function drawMatchLines() {
    const svg = document.getElementById('match-lines-svg');
    const wrap = document.querySelector('.match-grid-wrap');
    if (!svg || !wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);
    svg.setAttribute('width', wrapRect.width);
    svg.setAttribute('height', wrapRect.height);

    const pairs = window._matchPairs || {};
    // ألوان مختلفة لكل خط
    const colors = ['#2ba676', '#7f9cf5', '#e6c264', '#b490c2', '#e08a8a', '#5ac0d4'];

    let lines = '';
    Object.entries(pairs).forEach(([keyIdx, valIdx], i) => {
      const key = document.querySelector(`.match-key[data-key="${keyIdx}"]`);
      const val = document.querySelector(`.match-val[data-val="${valIdx}"]`);
      if (!key || !val) return;
      const kr = key.getBoundingClientRect();
      const vr = val.getBoundingClientRect();

      // في RTL: keys في العمود اليمين، vals في العمود اليسار
      // الخط من الحافة اليسرى للـkey إلى الحافة اليمنى للـval
      const x1 = kr.left - wrapRect.left;
      const y1 = kr.top + kr.height / 2 - wrapRect.top;
      const x2 = vr.right - wrapRect.left;
      const y2 = vr.top + vr.height / 2 - wrapRect.top;

      const color = colors[i % colors.length];
      // منحنى Bezier لجمالية أكثر
      const midX = (x1 + x2) / 2;
      lines += `
        <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}"
              fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"
              stroke-dasharray="6 5" opacity="0.85">
          <animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite"/>
        </path>
        <circle cx="${x1}" cy="${y1}" r="5" fill="${color}"/>
        <circle cx="${x2}" cy="${y2}" r="5" fill="${color}"/>
      `;
    });
    svg.innerHTML = lines;
  }

  function answerMatch() {
    if (window._answering) return;
    const questions = currentLesson.quiz.filter(q => q.type !== 'think');
    const q = questions[currentQuizIdx];
    const pairs = window._matchPairs || {};
    const correct = q.pairs.every((_, i) => pairs[i] === i);
    flashOption('match', pairs, correct);
    handleAnswer(q, pairs, correct, questions);
  }

  // ═══════════════════ الشهادة ═══════════════════
  function hasCertificate() {
    return !!localStorage.getItem(`certificate_${Profile.id}`);
  }

  function formatArabicDate(iso) {
    const d = new Date(iso);
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function showCertificate() {
    const raw = localStorage.getItem(`certificate_${Profile.id}`);
    if (!raw) {
      Character.sayCustom('🔒 الشهادة تُفتح بعد اجتياز الاختبار النهائي بعلامة كاملة', 4500);
      return;
    }
    const cert = JSON.parse(raw);
    currentViewName = 'certificate';

    $('#app').innerHTML = `
      <div class="cert-view">
        <header class="settings-header cert-header">
          <button class="back-btn" onclick="App.goHome()">→</button>
          <h2>🎓 شهادة الإتمام</h2>
        </header>

        <div class="cert-scroll">
          <div class="certificate" id="certificate">
            <div class="cert-border">
              <div class="cert-corner tl"></div>
              <div class="cert-corner tr"></div>
              <div class="cert-corner bl"></div>
              <div class="cert-corner br"></div>

              <div class="cert-seal">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="sealG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#ffe07a"/>
                      <stop offset="50%" stop-color="#f5b700"/>
                      <stop offset="100%" stop-color="#c98a00"/>
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" fill="url(#sealG)" stroke="#a67c1b" stroke-width="3"/>
                  <circle cx="50" cy="50" r="34" fill="none" stroke="#a67c1b" stroke-width="1.5" stroke-dasharray="3 3"/>
                  <text x="50" y="44" text-anchor="middle" font-size="26" fill="#5c3612">🏆</text>
                  <text x="50" y="66" text-anchor="middle" font-size="11" font-weight="bold" fill="#5c3612">متميّز</text>
                </svg>
              </div>

              <div class="cert-bismillah">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</div>

              <div class="cert-title">شهادة إتمام</div>
              <div class="cert-subtitle">كتاب الذخيرة المشرّفة</div>
              <div class="cert-divider">❖ ❖ ❖</div>

              <div class="cert-body">
                <p class="cert-intro">تشهد إدارة التطبيق بأنّ الطالب/ة</p>
                <p class="cert-name">${cert.name}</p>
                <p class="cert-text">
                  قد أتمّ بنجاح دراسة كتاب
                  <strong>«الذخيرة المشرّفة فيما يجب على المسلم أن يعرفه»</strong>
                  للحبيب العلّامة الداعي إلى الله
                  <strong>عمر بن محمد بن سالم بن حفيظ</strong>،
                  متقناً فصوله الثمانية في أركان الدين والطهارة والصلاة
                  والأدعية ونسب الرسول ﷺ وصلاة الجنازة وأذكار الصباح والمساء.
                </p>

                <div class="cert-scores">
                  <div class="cert-score-row">
                    <span class="cert-score-lbl">الاختبارات الفرعيّة</span>
                    <span class="cert-score-val">${(cert.subtotals ?? 0)} <em>من 50</em></span>
                  </div>
                  <div class="cert-score-row">
                    <span class="cert-score-lbl">الاختبار النهائي</span>
                    <span class="cert-score-val">${(cert.finalExam ?? 0)} <em>من 50</em></span>
                  </div>
                  <div class="cert-score-row total">
                    <span class="cert-score-lbl">المجموع النهائي</span>
                    <span class="cert-score-val">${(cert.totalScore ?? 0)} <em>من 100</em></span>
                  </div>
                </div>

                <p class="cert-dua">
                  نسأل الله أن يبارك في علمه وعمله، وأن يجعله من العاملين بما علموا.
                </p>
              </div>

              <div class="cert-footer">
                <div class="cert-date">
                  <div class="cert-date-lbl">تاريخ الإصدار</div>
                  <div class="cert-date-val">${formatArabicDate(cert.date)}</div>
                </div>
                <div class="cert-sig">
                  <div class="cert-sig-line"></div>
                  <div class="cert-sig-lbl">الذخيرة المشرّفة</div>
                </div>
              </div>
            </div>
          </div>

          <div class="cert-actions">
            <button class="btn primary block" onclick="App.downloadCertPNG()">
              🖼️ تحميل الشهادة كصورة
            </button>
            <button class="btn gold block" onclick="App.downloadCertPDF()">
              📄 تحميل الشهادة كـ PDF
            </button>
            <button class="btn secondary block" onclick="App.goHome()">
              ← العودة للخريطة
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════ تحميل الشهادة (PNG + PDF) ═══════════════════
  function buildCertificateSVG(cert) {
    const dateStr = formatArabicDate(cert.date);
    const nameEsc = String(cert.name).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" direction="rtl">
      <defs>
        <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fffdf5"/>
          <stop offset="50%" stop-color="#fdf6e3"/>
          <stop offset="100%" stop-color="#faedd2"/>
        </linearGradient>
        <linearGradient id="csealG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffe07a"/>
          <stop offset="60%" stop-color="#f5b700"/>
          <stop offset="100%" stop-color="#c98a00"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="850" fill="url(#cbg)"/>
      <rect x="30" y="30" width="1140" height="790" fill="none" stroke="#c9a227" stroke-width="6"/>
      <rect x="45" y="45" width="1110" height="760" fill="none" stroke="#c9a227" stroke-width="2"/>

      <!-- الختم الذهبي -->
      <g transform="translate(140, 170)">
        <circle cx="0" cy="0" r="72" fill="url(#csealG)" stroke="#a67c1b" stroke-width="4"/>
        <circle cx="0" cy="0" r="58" fill="none" stroke="#a67c1b" stroke-width="1.8" stroke-dasharray="5 4"/>
        <text x="0" y="8" text-anchor="middle" font-size="40" font-family="serif">🏆</text>
        <text x="0" y="40" text-anchor="middle" font-size="15" font-weight="bold" fill="#5c3612" font-family="Cairo, Arial, sans-serif">متميّز</text>
      </g>

      <!-- البسملة -->
      <text x="600" y="120" text-anchor="middle" font-family="Amiri, 'Traditional Arabic', serif" font-size="30" fill="#8b6b1f" font-weight="700">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</text>

      <!-- العنوان -->
      <text x="600" y="205" text-anchor="middle" font-family="Cairo, 'Segoe UI', Arial, sans-serif" font-size="62" font-weight="900" fill="#0d3b2e">شهادة إتمام</text>
      <text x="600" y="260" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="38" font-weight="800" fill="#b8860b">كتاب الذخيرة المشرّفة</text>
      <text x="600" y="305" text-anchor="middle" font-family="serif" font-size="26" fill="#c9a227">❖  ❖  ❖</text>

      <!-- الاسم -->
      <text x="600" y="370" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="24" fill="#4a4a4a">تشهد إدارة التطبيق بأنّ الطالب/ة</text>
      <text x="600" y="445" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="56" font-weight="900" fill="#0d3b2e">${nameEsc}</text>
      <line x1="350" y1="465" x2="850" y2="465" stroke="#c9a227" stroke-width="3"/>

      <!-- النص -->
      <text x="600" y="525" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="22" fill="#333">قد أتمّ بنجاح دراسة كتاب «الذخيرة المشرّفة فيما يجب على المسلم أن يعرفه»</text>
      <text x="600" y="562" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="22" fill="#333">للحبيب العلّامة الداعي إلى الله عمر بن محمد بن سالم بن حفيظ</text>

      <!-- جدول الدرجات -->
      <g transform="translate(300, 585)">
        <rect x="0" y="0" width="600" height="130" rx="12" fill="#fef8e7" stroke="#c9a227" stroke-width="2"/>

        <!-- سطر ١: الفرعيّة -->
        <text x="20" y="35" font-family="Cairo, Arial, sans-serif" font-size="20" font-weight="800" fill="#5c3612" text-anchor="start">الاختبارات الفرعيّة</text>
        <text x="580" y="35" font-family="Cairo, Arial, sans-serif" font-size="22" font-weight="900" fill="#0d3b2e" text-anchor="end">${(cert.subtotals ?? 0)} من 50</text>

        <!-- سطر ٢: النهائي -->
        <line x1="20" y1="52" x2="580" y2="52" stroke="#c9a227" stroke-width="1" stroke-dasharray="3 3"/>
        <text x="20" y="80" font-family="Cairo, Arial, sans-serif" font-size="20" font-weight="800" fill="#5c3612" text-anchor="start">الاختبار النهائي</text>
        <text x="580" y="80" font-family="Cairo, Arial, sans-serif" font-size="22" font-weight="900" fill="#0d3b2e" text-anchor="end">${(cert.finalExam ?? 0)} من 50</text>

        <!-- سطر ٣: المجموع -->
        <line x1="20" y1="97" x2="580" y2="97" stroke="#c9a227" stroke-width="2"/>
        <text x="20" y="122" font-family="Cairo, Arial, sans-serif" font-size="22" font-weight="900" fill="#b8860b" text-anchor="start">المجموع النهائي</text>
        <text x="580" y="122" font-family="Cairo, Arial, sans-serif" font-size="26" font-weight="900" fill="#b8860b" text-anchor="end">${(cert.totalScore ?? 0)} من 100</text>
      </g>

      <!-- الدعاء -->
      <text x="600" y="750" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="20" font-weight="800" fill="#8b6b1f">نسأل الله أن يبارك في علمه وعمله، وأن يجعله من العاملين بما علموا.</text>

      <!-- التذييل -->
      <line x1="80" y1="785" x2="1120" y2="785" stroke="#c9a227" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="140" y="805" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="15" fill="#666">تاريخ الإصدار</text>
      <text x="140" y="828" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="19" font-weight="800" fill="#0d3b2e">${dateStr}</text>
      <line x1="960" y1="810" x2="1120" y2="810" stroke="#c9a227" stroke-width="2"/>
      <text x="1040" y="830" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="16" font-weight="800" fill="#8b6b1f">الذخيرة المشرّفة</text>
    </svg>`;
  }

  async function svgToCanvas(svgString, w, h) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(0, 0, w, h);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function safeFilename(s) {
    return String(s).replace(/[^\p{L}\p{N}_\- ]/gu, '').trim() || 'الطالب';
  }

  async function downloadCertPNG() {
    const raw = localStorage.getItem(`certificate_${Profile.id}`);
    if (!raw) return;
    const cert = JSON.parse(raw);
    try {
      Gamification.showToast('⏳ جاري تحضير الصورة...', 'info', 2000);
      const svg = buildCertificateSVG(cert);
      const canvas = await svgToCanvas(svg, 2400, 1700); // hi-res
      canvas.toBlob((blob) => {
        if (!blob) {
          Gamification.showToast('❌ تعذّر إنشاء الصورة', 'warning', 3000);
          return;
        }
        const link = document.createElement('a');
        link.download = `شهادة_${safeFilename(cert.name)}.png`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        Gamification.showToast('✅ تم تحميل الشهادة كصورة', 'success', 3000);
      }, 'image/png');
    } catch (e) {
      console.error(e);
      Gamification.showToast('❌ تعذّر التحميل — جرّب مرّة أخرى', 'warning', 3000);
    }
  }

  async function downloadCertPDF() {
    const raw = localStorage.getItem(`certificate_${Profile.id}`);
    if (!raw) return;
    const cert = JSON.parse(raw);
    try {
      Gamification.showToast('⏳ جاري تحضير PDF...', 'info', 2500);
      const svg = buildCertificateSVG(cert);
      const canvas = await svgToCanvas(svg, 2400, 1700);
      const jpegData = canvas.toDataURL('image/jpeg', 0.92);
      const jpegBase64 = jpegData.split(',')[1];
      const jpegBinary = atob(jpegBase64);
      const jpegBytes = new Uint8Array(jpegBinary.length);
      for (let i = 0; i < jpegBinary.length; i++) jpegBytes[i] = jpegBinary.charCodeAt(i);

      const pdfBytes = buildSimplePDF(jpegBytes, canvas.width, canvas.height);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.download = `شهادة_${safeFilename(cert.name)}.pdf`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      Gamification.showToast('✅ تم تحميل الشهادة كـ PDF', 'success', 3000);
    } catch (e) {
      console.error(e);
      Gamification.showToast('❌ تعذّر التحميل — جرّب مرّة أخرى', 'warning', 3000);
    }
  }

  // بناء PDF بسيط يحتوي صورة JPEG واحدة بحجم صفحة A4 أفقي
  function buildSimplePDF(jpegBytes, imgW, imgH) {
    const pageW = 842, pageH = 595; // A4 landscape (pt)
    const margin = 20;
    const aspectImg = imgW / imgH;
    const aspectAvail = (pageW - 2 * margin) / (pageH - 2 * margin);
    let dispW, dispH;
    if (aspectImg > aspectAvail) {
      dispW = pageW - 2 * margin;
      dispH = dispW / aspectImg;
    } else {
      dispH = pageH - 2 * margin;
      dispW = dispH * aspectImg;
    }
    const dispX = (pageW - dispW) / 2;
    const dispY = (pageH - dispH) / 2;

    const encoder = new TextEncoder();
    const parts = [];
    let offset = 0;
    const offsets = [0];

    const push = (data) => {
      const bytes = typeof data === 'string' ? encoder.encode(data) : data;
      parts.push(bytes);
      offset += bytes.length;
    };

    push('%PDF-1.4\n%\xC7\xEC\x8F\xA2\n');

    offsets[1] = offset;
    push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets[2] = offset;
    push('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');

    offsets[3] = offset;
    push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`);

    const contentStr = `q\n${dispW} 0 0 ${dispH} ${dispX} ${dispY} cm\n/Im1 Do\nQ\n`;
    const contentBytes = encoder.encode(contentStr);
    offsets[4] = offset;
    push(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    push('\nendstream\nendobj\n');

    offsets[5] = offset;
    push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    push(jpegBytes);
    push('\nendstream\nendobj\n');

    const xrefOffset = offset;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    // دمج
    const total = parts.reduce((s, p) => s + p.length, 0);
    const combined = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { combined.set(p, pos); pos += p.length; }
    return combined;
  }

  // إبقاء shareCertificate القديم كـ alias للتحميل PNG
  function shareCertificate() { return downloadCertPNG(); }

  // ═══════════════════ شاشة التسجيلات الصوتيّة (مستقلّة) ═══════════════════
  function showRecordings() {
    currentViewName = 'recordings';
    const recordings = VoiceRecorder.listAllRecordings();

    // تجميع التسجيلات حسب الفصل
    const byChapter = {};
    recordings.forEach(r => {
      (byChapter[r.chapterId] = byChapter[r.chapterId] || []).push(r);
    });

    const groupsHTML = Object.keys(byChapter)
      .sort((a, b) => a - b)
      .map(chId => {
        const ch = CHAPTERS.find(c => c.id === +chId);
        const items = byChapter[chId].map(r => {
          const lesson = ch?.lessons.find(l => l.id === r.lessonId);
          const thinkQs = lesson?.quiz?.filter(qq => qq.type === 'think') || [];
          const q = thinkQs[r.questionIdx] || thinkQs[0];
          return `
            <div class="recording-card">
              <div class="recording-lesson-tag">
                📄 الدرس ${toArabicOrdinal(r.lessonId)}: ${lesson?.title || 'درس ' + r.lessonId}
              </div>
              <div class="recording-question-box">
                <div class="recording-q-label">❓ السؤال:</div>
                <div class="recording-q-text">${q?.q || 'سؤال "فكّر قليلاً"'}</div>
              </div>
              <div class="recording-actions">
                <button class="btn primary" onclick="App.playRec('${r.key}')">
                  ▶️ استمع
                </button>
                <button class="btn danger-outline" onclick="App.deleteRec('${r.key}')">
                  🗑️ حذف
                </button>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="rec-group">
            <div class="rec-group-header">
              <span class="rec-group-icon">${ch?.icon || '📖'}</span>
              <span class="rec-group-title">الفصل ${toArabicOrdinal(+chId)}: ${ch?.title || ''}</span>
              <span class="rec-group-count">${byChapter[chId].length}</span>
            </div>
            ${items}
          </div>`;
      }).join('');

    $('#app').innerHTML = `
      <div class="settings-view">
        <header class="settings-header">
          <button class="back-btn" onclick="App.goHome()">→</button>
          <h2>🎧 تسجيلات الطفل الصوتيّة</h2>
        </header>

        <div class="settings-body">
          <div class="rec-intro">
            <p>اسمع إجابات <strong>${Profile.name}</strong> على أسئلة "فكّر قليلاً" في كل درس.</p>
            <div class="rec-total">
              <span class="rec-total-num">${recordings.length}</span>
              <span class="rec-total-lbl">تسجيل صوتي</span>
            </div>
          </div>

          ${recordings.length === 0 ? `
            <div class="rec-empty">
              <div class="rec-empty-icon">🎙️</div>
              <p>لم يسجّل الطفل أي إجابة صوتيّة بعد.</p>
              <p class="settings-hint">
                في نهاية كل درس يوجد سؤال "فكّر قليلاً" مع زر تسجيل.
                شجّع طفلك على تسجيل إجابته بصوته!
              </p>
              <button class="btn primary block" onclick="App.goHome()">
                ← العودة للخريطة
              </button>
            </div>
          ` : groupsHTML}
        </div>
      </div>
    `;
  }

  function deleteRec(key) {
    if (!confirm('هل تريد حذف هذا التسجيل؟ لا يمكن التراجع.')) return;
    localStorage.removeItem(key);
    Gamification.showToast('🗑️ تم حذف التسجيل', 'info', 2000);
    showRecordings();
  }

  function answerOrder() {
    if (window._answering) return;
    const questions = currentLesson.quiz.filter(q => q.type !== 'think');
    const q = questions[currentQuizIdx];
    const items = Array.from(document.querySelectorAll('#order-list .order-item'));
    const currentOrder = items.map(it => parseInt(it.dataset.idx));
    // الترتيب الصحيح دائماً [0,1,2,...N-1] لأن items في data.js بالترتيب الصحيح
    const expectedOrder = q.items.map((_, i) => i);
    const correct = JSON.stringify(currentOrder) === JSON.stringify(expectedOrder);
    flashOption('order', currentOrder, correct);
    handleAnswer(q, currentOrder, correct, questions);
  }

  // ═══════════════════ تلوين الإجابة (أخضر/أحمر يختفي بعد ثانيتين) ═══════════════════
  function flashOption(qType, given, correct) {
    const cls = correct ? 'flash-correct' : 'flash-wrong';
    if (qType === 'mcq') {
      const options = document.querySelectorAll('.quiz-options .quiz-option');
      options[given]?.classList.add(cls);
      options.forEach(o => o.style.pointerEvents = 'none');
    } else if (qType === 'tf') {
      const options = document.querySelectorAll('.quiz-options .quiz-option.tf');
      const idx = given === true ? 0 : 1;
      options[idx]?.classList.add(cls);
      options.forEach(o => o.style.pointerEvents = 'none');
    } else if (qType === 'fillchoice') {
      const choices = document.querySelectorAll('.fill-choice');
      choices[given]?.classList.add(cls);
      choices.forEach(c => c.style.pointerEvents = 'none');
    } else if (qType === 'match') {
      document.querySelector('.match-grid')?.classList.add(cls);
      document.querySelectorAll('.match-item').forEach(m => m.style.pointerEvents = 'none');
      const btn = document.getElementById('match-submit');
      if (btn) btn.disabled = true;
    } else if (qType === 'order') {
      document.querySelector('.order-list')?.classList.add(cls);
    }
    // منع إعادة الإجابة
    window._answering = true;
  }

  function handleAnswer(q, given, correct, questions) {
    quizAnswers.push({ q, given, correct });

    if (correct) {
      Character.correct();
      SmartReview.recordCorrect(q.id);
    } else {
      Character.wrong();
      SmartReview.recordMistake({ ...q, chapterId: currentChapter.id, lessonId: currentLesson.id });
    }

    setTimeout(() => {
      window._answering = false;
      currentQuizIdx++;
      if (currentQuizIdx < questions.length) {
        renderQuizQuestion(questions);
      } else {
        finishQuiz();
      }
    }, 2000); // ثانيتان مثل ما طلبت
  }

  function finishQuiz() {
    currentViewName = 'result';
    const correctCount = quizAnswers.filter(a => a.correct).length;
    const total = quizAnswers.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const duration = Math.round((Date.now() - quizStartTime) / 1000);

    const isReview = currentChapter.id === 0;
    const isFinal = currentChapter.id === 99;

    // ═══ النظام الجديد للنجاح ═══
    // للدرس العادي: ٥٠٪ فأكثر يجتاز ويفتح التالي
    // للاختبار النهائي: كل درجة تُحفظ، ودائماً هناك زر إعادة
    const lessonPassed = score >= 50;
    const isPerfect = score === 100;

    let result = { alreadyDone: true, passed: false };
    let subtotalsJustCompleted = false;
    let subtotalsOutOf50 = 0;

    // ═══ حفظ درجة الدرس (يجتازه إذا ٥٠٪+) ═══
    if (!isReview && !isFinal) {
      result = Gamification.markLessonComplete(currentChapter.id, currentLesson.id, score);
      Gamification.save(Profile.id);
      lessonQuizTaken = true;

      // فحص إن كان أكمل كل الاختبارات الفرعيّة الآن
      if (result.passed && Gamification.allSubtestsComplete()) {
        // نتأكّد أنّه لم يُعرَض هذا الإنجاز من قبل
        const shownKey = `subtotalsShown_${Profile.id}`;
        if (!localStorage.getItem(shownKey)) {
          subtotalsJustCompleted = true;
          subtotalsOutOf50 = Gamification.getSubtotalsOutOf50();
          localStorage.setItem(shownKey, '1');
        }
      }
    }

    // ═══ الاختبار النهائي: نحفظ الدرجة دائماً + نحدّث الشهادة ═══
    let finalScoreOutOf50 = 0;
    if (isFinal) {
      finalScoreOutOf50 = Gamification.saveFinalExamScore(score);
      Gamification.save(Profile.id);

      // بناء/تحديث الشهادة تلقائياً (تشمل كل التفاصيل الجديدة)
      const subOut50 = Gamification.getSubtotalsOutOf50();
      const finalTotal = subOut50 + finalScoreOutOf50;
      const cert = {
        name: Profile.name,
        date: new Date().toISOString(),
        subtotals: Math.round(subOut50 * 10) / 10,
        finalExam: Math.round(finalScoreOutOf50 * 10) / 10,
        totalScore: Math.round(finalTotal * 10) / 10,
        finalPercent: score,
        totalQuestions: total
      };
      localStorage.setItem(`certificate_${Profile.id}`, JSON.stringify(cert));
    }

    const certExists = !!localStorage.getItem(`certificate_${Profile.id}`);

    // ═══ منطق الأزرار ═══
    const nextLesson = currentChapter.lessons?.find(l => l.id === currentLesson.id + 1);
    const nextChapter = (!isReview && !isFinal && lessonPassed)
      ? CHAPTERS.find(c => c.id === currentChapter.id + 1)
      : null;
    const hasNextLesson = !isReview && !isFinal && lessonPassed && !!nextLesson;
    const hasNextChapter = !isReview && !isFinal && lessonPassed && !hasNextLesson && !!nextChapter;

    let nextButton = '';
    if (isFinal) {
      // الاختبار النهائي: زر إعادة دائماً + عرض الشهادة
      nextButton = `<button class="btn success block" onclick="App.goHome()">
        🏠 العودة للرئيسية
      </button>`;
    } else if (isReview) {
      nextButton = `<button class="btn success block" onclick="App.goHome()">
        ← العودة للخريطة
      </button>`;
    } else if (!lessonPassed) {
      // لم يجتز الدرس (أقل من ٥٠٪) — فقط إعادة + مراجعة، الدرس التالي مقفل
      nextButton = `<button class="btn secondary block" onclick="App.openLesson(${currentChapter.id}, ${currentLesson.id})">
        📖 مراجعة الدرس
      </button>`;
    } else if (hasNextLesson) {
      nextButton = `<button class="btn success block" onclick="App.openLesson(${currentChapter.id}, ${nextLesson.id})">
        ← الدرس التالي: ${nextLesson.title}
      </button>`;
    } else if (hasNextChapter) {
      sessionStorage.setItem('newlyUnlocked', JSON.stringify({
        chapterId: nextChapter.id,
        title: nextChapter.title,
        shortTitle: nextChapter.shortTitle
      }));
      nextButton = `<button class="btn success block" onclick="App.goHome()">
        🗺️ العودة إلى الرئيسية
      </button>`;
    } else if (lessonPassed) {
      // أنهى كل الدروس — العودة للخريطة
      nextButton = `<button class="btn success block" onclick="App.goHome()">
        🏆 العودة للخريطة
      </button>`;
    }

    // ═══ رسالة النتيجة ═══
    let resultMsg = '';
    if (isFinal) {
      resultMsg = score >= 90 ? '🌟 ممتاز! درجة عالية جداً'
                : score >= 70 ? '💪 أداء جيّد — يمكنك المحاولة مجدّداً لرفع الدرجة'
                : score >= 50 ? '📚 مقبول — راجع الفصول وأعد الاختبار'
                : '🌱 حاول مرّة أخرى — راجع الفصول بتأنٍّ';
    } else if (isPerfect) {
      resultMsg = '🌟 ممتاز! علامة كاملة';
    } else if (lessonPassed) {
      resultMsg = '✅ اجتزت الدرس — يمكنك المتابعة للدرس التالي';
    } else if (score >= 30) {
      resultMsg = '💪 قريب من النجاح — أعد المحاولة!';
    } else {
      resultMsg = '🌱 راجع الدرس بتأنٍّ ثم أعد الاختبار';
    }

    // ═══ ملاحظة اجتياز الدرس ═══
    let passNote = '';
    if (!isReview && !isFinal) {
      const maxScore = Gamification.lessonMaxScore(currentChapter.id);
      const earnedScore = Gamification.lessonEarnedScore(currentChapter.id, score);
      const passThreshold = maxScore / 2;
      const maxStr = maxScore % 1 === 0 ? maxScore : maxScore.toFixed(1);
      const earnedStr = earnedScore % 1 === 0 ? earnedScore : earnedScore.toFixed(1);
      const passStr = passThreshold % 1 === 0 ? passThreshold : passThreshold.toFixed(1);

      if (!lessonPassed) {
        passNote = `<div class="perfect-required-note">
          ⚠️ درجتك: <strong>${earnedStr}</strong> من ${maxStr} —
          الحدّ الأدنى للاجتياز: <strong>${passStr}</strong> (٥٠٪).
          <br/>الدرس التالي مقفل حتى تجتاز هذا الاختبار.
        </div>`;
      } else {
        passNote = `<div class="lesson-passed-note">
          ✅ درجتك: <strong>${earnedStr}</strong> من ${maxStr}
        </div>`;
      }
    }

    // ═══ بانر إكمال الاختبارات الفرعيّة (يظهر مرّة واحدة فقط) ═══
    const subtotalsBanner = subtotalsJustCompleted ? `
      <div class="subtotals-banner">
        <div class="subtotals-icon">🎊</div>
        <div class="subtotals-title">لقد أكملت جميع اختبارات الفصول!</div>
        <div class="subtotals-score">درجتك في الاختبارات الفرعيّة:
          <strong>${(Math.round(subtotalsOutOf50 * 10) / 10)}</strong> من <strong>50</strong>
        </div>
        <div class="subtotals-hint">
          الآن يمكنك أداء الاختبار النهائي من الخريطة (الكأس في القمّة)
          للحصول على شهادتك 🏆
        </div>
      </div>` : '';

    // ═══ بانر الشهادة (يظهر في نتيجة الاختبار النهائي) ═══
    const certBanner = isFinal ? `
      <div class="cert-earned-banner">
        <div class="cert-earned-icon">🎓</div>
        <div class="cert-earned-title">شهادتك محدَّثة!</div>
        <div class="cert-final-scores">
          <div class="cert-final-row">
            <span>الاختبارات الفرعيّة:</span>
            <strong>${Math.round(Gamification.getSubtotalsOutOf50() * 10) / 10} من 50</strong>
          </div>
          <div class="cert-final-row">
            <span>الاختبار النهائي:</span>
            <strong>${Math.round(finalScoreOutOf50 * 10) / 10} من 50</strong>
          </div>
          <div class="cert-final-row total">
            <span>المجموع النهائي:</span>
            <strong>${Math.round(Gamification.getFinalTotal() * 10) / 10} من 100</strong>
          </div>
        </div>
        <button class="btn gold block" onclick="App.showCertificate()">
          📜 عرض الشهادة
        </button>
      </div>` : '';

    $('#app').innerHTML = `
      <div class="quiz-result-view ${lessonPassed || isFinal ? 'perfect' : 'imperfect'}">
        <div class="result-circle" style="--score: ${score}">
          <div class="result-score">${score}%</div>
          <div class="result-label">النتيجة</div>
        </div>

        <div class="result-msg">${resultMsg}</div>

        <div class="result-stats">
          <div><strong>${correctCount}</strong> إجابة صحيحة من ${total}</div>
          <div><strong>${duration}</strong> ثانية</div>
        </div>

        ${passNote}
        ${subtotalsBanner}
        ${certBanner}

        <div class="result-actions">
          <button class="btn primary block" onclick="App.retakeQuiz()">
            🔄 إعادة الاختبار
          </button>
          ${nextButton}
        </div>
      </div>
    `;

    // ═══ صندوق المكافأة فقط عند النجاح لأوّل مرّة في الدرس ═══
    if (lessonPassed && !isFinal && !isReview && !result.alreadyDone) {
      setTimeout(() => Gamification.showRewardBox(result), 1200);
    }

    // ═══ احتفاليّة الشهادة عند اجتياز الاختبار النهائي بدرجة ممتازة ═══
    if (isFinal && score >= 90) {
      const celShownKey = `finalCelShown_${Profile.id}`;
      if (!localStorage.getItem(celShownKey)) {
        localStorage.setItem(celShownKey, '1');
        setTimeout(() => showCertificateCelebration(), 1500);
      }
    }
  }

  // ═══════════════════ احتفاليّة الشهادة الكبرى ═══════════════════
  function showCertificateCelebration() {
    // إزالة أي احتفاليّة سابقة
    document.querySelectorAll('.cert-celebration-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'cert-celebration-overlay';

    // بناء الألعاب الناريّة (مواقع عشوائيّة)
    let fireworks = '';
    for (let i = 0; i < 18; i++) {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 2;
      const emoji = ['✨','🎉','🎊','⭐','💫','🌟'][Math.floor(Math.random() * 6)];
      fireworks += `<span class="firework" style="left:${left}%;top:${top}%;animation-delay:${delay}s;">${emoji}</span>`;
    }

    overlay.innerHTML = `
      <div class="cert-cel-fireworks">${fireworks}</div>
      <div class="cert-cel-content">
        <svg class="cert-cel-trophy" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="celCup" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stop-color="#fff3b0"/>
              <stop offset="25%" stop-color="#ffd93d"/>
              <stop offset="55%" stop-color="#f5b700"/>
              <stop offset="100%" stop-color="#d18f00"/>
            </linearGradient>
            <linearGradient id="celBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffd93d"/>
              <stop offset="100%" stop-color="#c98a00"/>
            </linearGradient>
            <radialGradient id="celShine" cx="0.32" cy="0.25" r="0.5">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <path d="M22,22 C6,22 6,48 24,52" fill="none" stroke="url(#celCup)" stroke-width="7" stroke-linecap="round"/>
          <path d="M78,22 C94,22 94,48 76,52" fill="none" stroke="url(#celCup)" stroke-width="7" stroke-linecap="round"/>
          <path d="M22,16 L78,16 L74,50 C72,64 60,72 50,72 C40,72 28,64 26,50 Z" fill="url(#celCup)" stroke="#b87d00" stroke-width="2.5"/>
          <path d="M22,16 L78,16 L74,50 C72,64 60,72 50,72 C40,72 28,64 26,50 Z" fill="url(#celShine)"/>
          <path d="M50,28 L54.2,37.2 L64,38.4 L56.8,45.2 L58.7,55 L50,50.2 L41.3,55 L43.2,45.2 L36,38.4 L45.8,37.2 Z" fill="#ffb300" stroke="#a86e00" stroke-width="1.2"/>
          <rect x="44" y="72" width="12" height="12" fill="url(#celBase)" stroke="#b87d00" stroke-width="2"/>
          <rect x="32" y="84" width="36" height="9" rx="2" fill="url(#celBase)" stroke="#b87d00" stroke-width="2"/>
          <rect x="26" y="93" width="48" height="11" rx="3" fill="#7a4a1a" stroke="#5c3612" stroke-width="2"/>
        </svg>
        <div class="cert-cel-halo"></div>
        <div class="cert-cel-title">🎉 مبروك مبروك! 🎉</div>
        <div class="cert-cel-msg">أتممتَ كتاب الذخيرة المشرّفة كاملاً!</div>
        <div class="cert-cel-sub">شهادتك جاهزة — قم بتحميلها من الإعدادات</div>
        <button class="btn gold block cert-cel-view" onclick="App.viewCertNow()">
          📜 عرض الشهادة الآن
        </button>
        <button class="btn secondary block cert-cel-close" onclick="App.closeCertCelebration()">
          إغلاق
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function closeCertCelebration() {
    const overlay = document.querySelector('.cert-celebration-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 500);
  }

  function viewCertNow() {
    closeCertCelebration();
    setTimeout(() => showCertificate(), 400);
  }

  function retakeQuiz() { startQuiz(); }

  function finishLesson() {
    if (!lessonQuizTaken) {
      Gamification.showToast('يجب إكمال الاختبار أولاً', 'warning');
      return;
    }
    Character.lessonDone();
    setTimeout(() => openChapter(currentChapter.id), 1500);
  }

  // ═══════════════════ المراجعة الذكية ═══════════════════
  function startReview() {
    const questions = SmartReview.getReviewQuestions(5);
    if (questions.length === 0) {
      Gamification.showToast('لا توجد أسئلة للمراجعة الآن', 'info');
      return;
    }
    currentLesson = { title: 'مراجعة ذكية', quiz: questions };
    currentChapter = { id: 0, title: 'مراجعة', color: '#a67c1b', lessons: [] };
    currentQuizIdx = 0;
    quizAnswers = [];
    quizStartTime = Date.now();
    Character.sayCustom('🧠 حان وقت المراجعة! لنتأكد أنك تذكر ما تعلّمته', 3500);
    setTimeout(() => renderQuizQuestion(questions), 500);
  }

  // ═══════════════════ الاختبار النهائي ═══════════════════
  function startFinalExam() {
    const all = [];
    CHAPTERS.forEach(ch => {
      ch.lessons.forEach(l => {
        (l.quiz || []).filter(q => q.type !== 'think').forEach(q => {
          all.push({ ...q, chapterId: ch.id, lessonId: l.id });
        });
      });
    });
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 15);
    currentLesson = { title: 'الاختبار النهائي', quiz: shuffled };
    currentChapter = { id: 99, title: 'الاختبار النهائي', color: '#a67c1b', lessons: [] };
    currentQuizIdx = 0;
    quizAnswers = [];
    quizStartTime = Date.now();
    Character.sayCustom('🏆 موعد الاختبار النهائي! أظهر ما تعلّمته', 4000);
    setTimeout(() => renderQuizQuestion(shuffled), 500);
  }

  // ═══════════════════ تحميل PDF (يفتح Google Drive في المتصفح) ═══════════════════
  function downloadBook() {
    const url = CONFIG.BOOK_PDF_URL;
    try {
      // في Capacitor: يفتح في المتصفح الخارجي تلقائياً
      window.open(url, '_blank');
      Gamification.showToast('📚 يفتح رابط الكتاب...', 'info', 2000);
    } catch (e) {
      Gamification.showToast('تعذّر فتح الرابط', 'warning');
    }
  }

  function showLevelDetails() {
    const level = Gamification.getCurrentLevel();
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-modal" style="border-color: ${level.color}">
        <div class="levels-list">
          ${CONFIG.LEVELS.map(lv => `
            <div class="level-row ${lv.name === level.name ? 'current' : ''} ${Gamification.xp >= lv.minXP ? 'achieved' : ''}">
              <div class="level-icon">${lv.icon}</div>
              <div class="level-name">${lv.name}</div>
              <div class="level-xp">${lv.minXP} XP</div>
            </div>
          `).join('')}
        </div>
        <button class="btn primary" onclick="this.closest('.levelup-overlay').remove()">
          إغلاق
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function goHome() {
    // إلغاء أي تسجيل جارٍ (يُغلق stream الميكروفون)
    if (recordingIdx !== null && window.VoiceRecorder?.cancel) {
      VoiceRecorder.cancel();
      recordingIdx = null;
    }
    Character.forceHide();
    showJourneyMap();
  }

  return {
    init,
    completeOnboarding, handleImport,
    goHome, showJourneyMap, openChapter, openLesson,
    showLockedMsg, showFinalLockedMsg, toggleRecord, playRecording,
    startQuiz, answerQuiz, answerOrder,
    answerFillChoice, selectMatchKey, selectMatchVal, answerMatch,
    retakeQuiz, finishLesson,
    startReview, startFinalExam,
    downloadBook, showLevelDetails,
    showSettings, editProfile, exportProgress, resetAll, playRec,
    showRecordings, deleteRec, showCertificate, shareCertificate,
    downloadCertPNG, downloadCertPDF,
    dismissUnlockBanner,
    viewCertNow, closeCertCelebration
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', App.init);
