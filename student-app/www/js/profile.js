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
      version: CONFIG.APP_VERSION,
      exportedAt: Date.now(),
      profile: current,
      gamification: localStorage.getItem(`gamification_${uid}`),
      review: localStorage.getItem(`review_${uid}`),
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

  function downloadBackup() {
    const backup = exportBackup();
    if (!backup) return false;
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athakhira-${current.name}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
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
      if (backup.recordings) {
        Object.entries(backup.recordings).forEach(([k, v]) => {
          localStorage.setItem(k, v);
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
    get current() { return current; },
    get exists() { return !!current; },
    get id()      { return current?.id; },
    get name()    { return current?.name || 'صديقي'; },
    get gender()  { return current?.gender || 'male'; }
  };
})();

window.Profile = Profile;
