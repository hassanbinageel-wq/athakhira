/* ============================================================
   profile.js  —  إدارة الملف الشخصي محلياً (بديل عن Supabase Auth)
   ============================================================
   كل بيانات الطفل تُحفظ في localStorage على الجهاز نفسه.
   ملف واحد لكل جهاز — بسيط، سريع، بدون إنترنت.
   ============================================================ */
'use strict';

const Profile = (function() {
  const STORAGE_KEY = 'athakhira_profile';
  let current = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        current = JSON.parse(raw);
        return current;
      }
    } catch (e) { console.warn('Failed to load profile', e); }
    return null;
  }

  function save() {
    if (!current) return false;
    try {
      current.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return true;
    } catch (e) { console.warn('Failed to save profile', e); return false; }
  }

  function create({ name, age, gender }) {
    if (!name || !gender) return null;
    current = {
      id: 'local_' + Date.now().toString(36),
      name: name.trim(),
      age: age || 10,
      gender: gender === 'female' ? 'female' : 'male',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    save();
    return current;
  }

  function update(updates) {
    if (!current) return null;
    Object.assign(current, updates);
    save();
    return current;
  }

  function reset() {
    // مسح كل بيانات المستخدم على هذا الجهاز
    if (!current) return;
    const uid = current.id;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`gamification_${uid}`);
    localStorage.removeItem(`review_${uid}`);
    // مسح كل التسجيلات الصوتية لهذا المستخدم
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`voice_${uid}_`)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    current = null;
  }

  // ═══════════════════ نسخ احتياطي (تصدير/استيراد) ═══════════════════
  function exportBackup() {
    if (!current) return null;
    const uid = current.id;
    const backup = {
      version: CONFIG.APP_VERSION || '2.0',
      exportedAt: Date.now(),
      profile: current,
      gamification: localStorage.getItem(`gamification_${uid}`),
      review: localStorage.getItem(`review_${uid}`),
      certificate: localStorage.getItem(`certificate_${uid}`),
      recordings: {}
    };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`voice_${uid}_`)) {
        backup.recordings[k] = localStorage.getItem(k);
      }
    }
    return backup;
  }

  async function downloadBackup() {
    const backup = exportBackup();
    if (!backup) return false;
    const jsonStr = JSON.stringify(backup);
    const fileName = `athakhira-${safeFileName(current.name)}-${new Date().toISOString().slice(0,10)}.json`;

    // ١) الأفضل — نستخدم Web Share API لفتح قائمة المشاركة الأصليّة (تعمل على أندرويد WebView)
    try {
      if (navigator.share && navigator.canShare) {
        const file = new File([jsonStr], fileName, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'نسخة احتياطية — الذخيرة المشرفة',
            text: 'اختر "الملفّات" أو "Drive" أو "واتساب" لحفظ النسخة'
          });
          return true;
        }
      }
    } catch (e) {
      // المستخدم أغلق قائمة المشاركة أو رفضها — لا نُعامل هذا كخطأ
      if (e.name === 'AbortError') return false;
      // نستمرّ للطريقة البديلة
    }

    // ٢) البديل — قائمة عرض النصّ للنسخ اليدوي (يعمل في كل مكان)
    try {
      showBackupTextModal(jsonStr, fileName);
      return true;
    } catch (e) {}

    // ٣) طريقة أخيرة قديمة (لن تعمل في WebView غالباً لكن مفيدة على المتصفّح)
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('All backup methods failed', e);
      return false;
    }
  }

  function safeFileName(s) {
    return String(s || 'user').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 30) || 'user';
  }

  // مربّع بديل: يعرض النصّ للنسخ اليدوي وحفظه من خلال منسّق أندرويد
  function showBackupTextModal(jsonStr, fileName) {
    // إزالة أي مربّع سابق
    document.querySelectorAll('.backup-modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'backup-modal-overlay';
    overlay.innerHTML = `
      <div class="backup-modal">
        <div class="backup-modal-title">💾 نسختك الاحتياطية جاهزة</div>
        <div class="backup-modal-hint">
          انسخ النصّ التالي كاملاً واحفظه في مكان آمن (WhatsApp،
          Notes، Gmail، Google Drive، أو أي مكان تحبّ).
          <br/><strong>لاستعادته لاحقاً، احفظه في ملفّ باسم:</strong>
          <br/><code>${fileName}</code>
        </div>
        <textarea class="backup-modal-text" readonly onclick="this.select()">${jsonStr}</textarea>
        <div class="backup-modal-actions">
          <button class="btn primary block" onclick="Profile._copyBackup()">
            📋 نسخ النصّ إلى الحافظة
          </button>
          <button class="btn secondary block" onclick="Profile._closeBackupModal()">
            إغلاق
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  // (داخلي) نسخ للحافظة
  async function _copyBackup() {
    const ta = document.querySelector('.backup-modal-text');
    if (!ta) return;
    ta.select();
    try {
      await navigator.clipboard.writeText(ta.value);
      alert('✅ تمّ النسخ! الآن الصق النصّ في WhatsApp أو Notes لحفظه.');
    } catch (e) {
      // الطريقة القديمة
      document.execCommand('copy');
      alert('✅ تمّ التحديد — اضغط "نسخ" في القائمة');
    }
  }

  function _closeBackupModal() {
    const overlay = document.querySelector('.backup-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  }

  function importBackup(json) {
    try {
      const backup = typeof json === 'string' ? JSON.parse(json) : json;
      if (!backup.profile) throw new Error('ملف غير صالح');

      const uid = backup.profile.id;
      current = backup.profile;
      save();

      if (backup.gamification) localStorage.setItem(`gamification_${uid}`, backup.gamification);
      if (backup.review) localStorage.setItem(`review_${uid}`, backup.review);
      if (backup.certificate) localStorage.setItem(`certificate_${uid}`, backup.certificate);
      if (backup.recordings) {
        Object.entries(backup.recordings).forEach(([k, v]) => {
          if (v) localStorage.setItem(k, v);
        });
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  return {
    load, save, create, update, reset,
    exportBackup, downloadBackup, importBackup,
    _copyBackup, _closeBackupModal,
    get current() { return current; },
    get exists() { return !!current; },
    get id()      { return current?.id; },
    get name()    { return current?.name || 'صديقي'; },
    get gender()  { return current?.gender || 'male'; }
  };
})();

window.Profile = Profile;
