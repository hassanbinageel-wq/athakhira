/* ============================================================
   character.js  —  الشخصيّة المرافقة (مع رسائل مذكّرة/مؤنّثة)
   ============================================================
   عند اختيار "ذكر" → ممتاز، أحسنت، يا بطل، جاهز، ...
   عند اختيار "أنثى" → ممتازة، أحسنتِ، يا بطلة، جاهزة، ...
   ============================================================ */
'use strict';

const Character = (function() {
  let gender = 'boy';       // 'boy' | 'girl'
  let userName = 'صديقي';
  let container = null;
  let bubble = null;
  let img = null;
  let currentTimeout = null;

  // ═══════════════════ رسائل الذكور ═══════════════════
  const MESSAGES_BOY = {
    greeting: [
      'أهلاً {name}! جاهز نتعلّم اليوم؟ 🌟',
      'يا هلا {name}! يلا نبدأ الدرس 📖',
      'مرحبا {name}! درس اليوم راح يعجبك ✨',
      'وصلت {name}! خلّينا نبدأ 🚀'
    ],
    lessonStart: [
      'ركّز معي {name}، الدرس ممتع 💡',
      'اقرأ بتأنٍّ {name}، وافهم كل كلمة 📚',
      'أنا معك {name}، ما راح تتعلّم إلا وأنا جنبك 🌟'
    ],
    correctAnswer: [
      '🎉 ممتاز {name}! إجابة صحيحة!',
      '👏 عاش! جوابك صحيح!',
      '🌟 برافو! أجبتَ صحّ!',
      '💚 أحسنتَ! فعلاً كذا الصح!',
      '🏆 رائع! أنت ذكيّ!'
    ],
    wrongAnswer: [
      '🌱 قريب! جرّب مرّة ثانية',
      '💪 لا بأس، خذ نفَساً وحاول',
      '🤔 فكّر شويّة، الجواب قريب',
      '🌟 كل الناس يخطئون، حاول مرّة أخرى',
      '💡 استفد من الخطأ، هذا طريق التعلّم'
    ],
    lessonComplete: [
      '🎊 مبروك {name}! أنهيتَ الدرس',
      '🏆 يا بطل! خلّصتَ الدرس بنجاح',
      '⭐ ممتاز! هذا درس آخر أنجزتَه',
      '🎉 عاش {name}! خطوة أقرب للنهاية'
    ],
    chapterUnlock: [
      '🎁 مفاجأة! فتحتَ باباً جديداً!',
      '🗝️ ممتاز! الفصل الجاي انفتح لك',
      '🚀 وصلتَ لمرحلة جديدة!'
    ],
    levelUp: [
      '👑 مستوى جديد! أنتَ الآن {level}',
      '🌟 ترقّيتَ! صرتَ {level}',
      '🎊 مبروك! أصبحتَ {level}'
    ],
    streak: [
      '🔥 استمرّ! يومك الـ{days} على التوالي',
      '⚡ رائع! {days} أيام متواصلة'
    ],
    encouragement: [
      'استمرّ {name}، أنتَ ممتاز! 💪',
      'لا تتوقّف، أنتَ قريب من الهدف 🎯',
      'كل درس يقرّبك من الكأس 🏆'
    ]
  };

  // ═══════════════════ رسائل الإناث ═══════════════════
  const MESSAGES_GIRL = {
    greeting: [
      'أهلاً {name}! جاهزة نتعلّم اليوم؟ 🌟',
      'يا هلا {name}! يلا نبدأ الدرس 📖',
      'مرحبا {name}! درس اليوم راح يعجبك ✨',
      'وصلتِ {name}! خلّينا نبدأ 🚀'
    ],
    lessonStart: [
      'ركّزي معي {name}، الدرس ممتع 💡',
      'اقرئي بتأنٍّ {name}، وافهمي كل كلمة 📚',
      'أنا معكِ {name}، ما راح تتعلّمي إلا وأنا جنبك 🌟'
    ],
    correctAnswer: [
      '🎉 ممتازة {name}! إجابة صحيحة!',
      '👏 عاش! جوابك صحيح!',
      '🌟 برافو! أجبتِ صحّ!',
      '💚 أحسنتِ! فعلاً كذا الصح!',
      '🏆 رائعة! أنتِ ذكيّة!'
    ],
    wrongAnswer: [
      '🌱 قريب! جرّبي مرّة ثانية',
      '💪 لا بأس، خذي نفَساً وحاولي',
      '🤔 فكّري شويّة، الجواب قريب',
      '🌟 كل الناس يخطئون، حاولي مرّة أخرى',
      '💡 استفيدي من الخطأ، هذا طريق التعلّم'
    ],
    lessonComplete: [
      '🎊 مبروك {name}! أنهيتِ الدرس',
      '🏆 يا بطلة! خلّصتِ الدرس بنجاح',
      '⭐ ممتازة! هذا درس آخر أنجزتِه',
      '🎉 عاش {name}! خطوة أقرب للنهاية'
    ],
    chapterUnlock: [
      '🎁 مفاجأة! فتحتِ باباً جديداً!',
      '🗝️ ممتازة! الفصل الجاي انفتح لكِ',
      '🚀 وصلتِ لمرحلة جديدة!'
    ],
    levelUp: [
      '👑 مستوى جديد! أنتِ الآن {level}',
      '🌟 ترقّيتِ! صرتِ {level}',
      '🎊 مبروك! أصبحتِ {level}'
    ],
    streak: [
      '🔥 استمرّي! يومكِ الـ{days} على التوالي',
      '⚡ رائعة! {days} أيام متواصلة'
    ],
    encouragement: [
      'استمرّي {name}، أنتِ ممتازة! 💪',
      'لا تتوقّفي، أنتِ قريبة من الهدف 🎯',
      'كل درس يقرّبكِ من الكأس 🏆'
    ]
  };

  function getMessages() {
    return gender === 'girl' ? MESSAGES_GIRL : MESSAGES_BOY;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function replace(msg, vars) {
    return msg.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
  }

  // ═══════════════════ تهيئة الشخصية ═══════════════════
  function init(userGender, name) {
    gender = userGender === 'female' ? 'girl' : 'boy';
    userName = name || 'صديقي';

    container = document.getElementById('character-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'character-container';
      container.className = 'character-container hidden';
      container.innerHTML = `
        <div class="character-bubble" id="character-bubble"></div>
        <img id="character-img" class="character-img" alt="الشخصية المرافقة" />
      `;
      document.body.appendChild(container);
    }

    img = document.getElementById('character-img');
    bubble = document.getElementById('character-bubble');
    img.src = `assets/characters/${gender}.png`;
  }

  function setGender(newGender) {
    gender = newGender === 'female' ? 'girl' : 'boy';
    if (img) img.src = `assets/characters/${gender}.png`;
  }

  function setName(name) {
    userName = name || 'صديقي';
  }

  // ═══════════════════ عرض الرسالة ═══════════════════
  function say(messageKey, extraVars = {}, duration = 4000) {
    if (!container) return;

    const messages = getMessages()[messageKey];
    if (!messages) return;

    const raw = pick(messages);
    const text = replace(raw, { name: userName, ...extraVars });

    bubble.textContent = text;
    container.classList.remove('hidden');
    container.classList.add('active', 'pop');

    clearTimeout(currentTimeout);
    currentTimeout = setTimeout(() => {
      container.classList.remove('pop');
      hide(duration);
    }, 50);
  }

  function sayCustom(text, duration = 4000) {
    if (!container || !text) return;
    // تحويل تلقائي للنصّ المخصّص حسب الجنس
    const finalText = adaptGenderInText(text);
    bubble.textContent = finalText;
    container.classList.remove('hidden');
    container.classList.add('active', 'pop');
    clearTimeout(currentTimeout);
    currentTimeout = setTimeout(() => {
      container.classList.remove('pop');
      hide(duration);
    }, 50);
  }

  // تكييف النصّ للأنثى تلقائياً (يحوّل الكلمات المذكّرة للمؤنّثة)
  function adaptGenderInText(text) {
    if (gender !== 'girl') return text;
    const swaps = [
      // صفات
      [/ممتاز\b/g,   'ممتازة'],
      [/رائع\b/g,     'رائعة'],
      [/ذكيّ?\b/g,   'ذكيّة'],
      [/بطل\b/g,      'بطلة'],
      [/جاهز\b/g,     'جاهزة'],
      [/قريب\b/g,     'قريبة'],
      // ضمائر ومخاطبة
      [/\bأنت\b/g,    'أنتِ'],
      [/\bلك\b/g,      'لكِ'],
      [/\bمعك\b/g,    'معكِ'],
      [/\bعليك\b/g,   'عليكِ'],
      [/\bصرت\b/g,    'صرتِ'],
      [/\bترقّيت\b/g, 'ترقّيتِ'],
      [/\bأصبحت\b/g,  'أصبحتِ'],
      [/\bوصلت\b/g,    'وصلتِ'],
      [/\bفتحت\b/g,    'فتحتِ'],
      [/\bأنهيت\b/g,   'أنهيتِ'],
      [/\bخلّصت\b/g,   'خلّصتِ'],
      [/\bأجبت\b/g,    'أجبتِ'],
      [/\bأحسنت\b/g,   'أحسنتِ'],
      // أفعال أمر
      [/\bاستمرّ\b/g,  'استمرّي'],
      [/\bجرّب\b/g,    'جرّبي'],
      [/\bفكّر\b/g,    'فكّري'],
      [/\bحاول\b/g,    'حاولي'],
      [/\bركّز\b/g,    'ركّزي'],
      [/\bاقرأ\b/g,    'اقرئي'],
      [/\bاكتب\b/g,    'اكتبي'],
      [/\bخذ\b/g,      'خذي']
    ];
    let out = text;
    swaps.forEach(([re, rep]) => { out = out.replace(re, rep); });
    return out;
  }

  function hide(delay = 3500) {
    clearTimeout(currentTimeout);
    currentTimeout = setTimeout(() => {
      container?.classList.add('hidden');
      container?.classList.remove('active');
    }, delay);
  }

  function forceHide() {
    clearTimeout(currentTimeout);
    container?.classList.add('hidden');
    container?.classList.remove('active');
  }

  return {
    init, setGender, setName, say, sayCustom, hide, forceHide,
    greet:          () => say('greeting'),
    lessonStart:    () => say('lessonStart'),
    correct:        () => say('correctAnswer', {}, 2500),
    wrong:          () => say('wrongAnswer', {}, 3000),
    lessonDone:     () => say('lessonComplete'),
    chapterUnlock:  () => say('chapterUnlock', {}, 5000),
    levelUp:        (levelName) => say('levelUp', { level: levelName }, 5000),
    streak:         (days) => say('streak', { days }),
    encourage:      () => say('encouragement'),
    get gender()    { return gender; },
    get imgPath()   { return `assets/characters/${gender}.png`; }
  };
})();

window.Character = Character;
