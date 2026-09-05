/* ============================================================
   voice-recorder.js  —  تسجيل صوت الطفل في قسم "فكّر قليلاً"
   ============================================================ */
'use strict';

const VoiceRecorder = (function() {
  let mediaRecorder = null;
  let audioChunks = [];
  let stream = null;
  let userId = 'guest';

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  async function start(onStart, onError) {
    if (!isSupported()) {
      onError?.('التسجيل غير مدعوم على هذا الجهاز');
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start();
      onStart?.();
      return true;
    } catch (e) {
      // رسائل واضحة حسب نوع الخطأ
      let msg = 'تعذّر الوصول للميكروفون';
      const errName = e.name || '';
      if (errName === 'NotAllowedError' || (e.message && e.message.includes('Permission'))) {
        msg = '🎤 يحتاج التطبيق لإذن الميكروفون\n\n' +
              '١. افتح إعدادات هاتفك\n' +
              '٢. التطبيقات ← الذخيرة المشرّفة\n' +
              '٣. الأذونات ← الميكروفون ← "السماح"\n' +
              '٤. أعد فتح التطبيق وحاول مجدّداً';
      } else if (errName === 'NotFoundError') {
        msg = '🎤 لم يُعثر على ميكروفون في الجهاز';
      } else if (errName === 'NotReadableError') {
        msg = '🎤 الميكروفون مشغول من تطبيق آخر — أغلق التطبيقات الأخرى وحاول';
      } else if (e.message) {
        msg += ':\n' + e.message;
      }
      onError?.(msg);
      return false;
    }
  }

  function stop() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        stream?.getTracks().forEach(t => t.stop());
        stream = null;
        mediaRecorder = null;
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  function cancel() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    mediaRecorder = null;
    audioChunks = [];
  }

  // ═══════════════════ التخزين المحلي ═══════════════════
  function setUser(uid) { userId = uid || 'guest'; }

  async function saveRecording(chapterId, lessonId, questionIdx, blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const key = `voice_${userId}_${chapterId}_${lessonId}_${questionIdx}`;
        try {
          localStorage.setItem(key, reader.result);
          resolve(true);
        } catch (e) {
          console.warn('Voice save failed', e);
          resolve(false);
        }
      };
      reader.readAsDataURL(blob);
    });
  }

  function getRecording(chapterId, lessonId, questionIdx) {
    const key = `voice_${userId}_${chapterId}_${lessonId}_${questionIdx}`;
    return localStorage.getItem(key);
  }

  function hasRecording(chapterId, lessonId, questionIdx) {
    return !!getRecording(chapterId, lessonId, questionIdx);
  }

  function deleteRecording(chapterId, lessonId, questionIdx) {
    const key = `voice_${userId}_${chapterId}_${lessonId}_${questionIdx}`;
    localStorage.removeItem(key);
  }

  function listAllRecordings() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`voice_${userId}_`)) continue;
      // المفتاح: voice_<userId>_<chapterId>_<lessonId>_<qIdx>
      // نقرأ آخر ٣ أجزاء لأن userId قد يحتوي على "_"
      const parts = k.split('_');
      if (parts.length < 5) continue;
      const qIdx      = +parts[parts.length - 1];
      const lessonId  = +parts[parts.length - 2];
      const chapterId = +parts[parts.length - 3];
      if (isNaN(qIdx) || isNaN(lessonId) || isNaN(chapterId)) continue;
      list.push({ chapterId, lessonId, questionIdx: qIdx, key: k });
    }
    // ترتيب: الفصل ثم الدرس ثم السؤال
    list.sort((a, b) =>
      a.chapterId - b.chapterId ||
      a.lessonId  - b.lessonId  ||
      a.questionIdx - b.questionIdx
    );
    return list;
  }

  return {
    isSupported, start, stop, cancel,
    setUser, saveRecording, getRecording, hasRecording, deleteRecording, listAllRecordings
  };
})();

window.VoiceRecorder = VoiceRecorder;
