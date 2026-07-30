// ═══════════════════════════════════════════════════════════════════
// طبقة الاتصال بـ Supabase مع دعم العمل بدون إنترنت (Offline-First)
// ═══════════════════════════════════════════════════════════════════

const db = {
  client: null,
  currentUser: null,
  isOnline: navigator.onLine,

  init() {
    if (CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      console.warn('⚠️ يرجى تعيين إعدادات Supabase في config.js');
      this.client = null;
      return;
    }
    this.client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    window.addEventListener('online', () => { this.isOnline = true; this.syncPending(); });
    window.addEventListener('offline', () => { this.isOnline = false; });
  },

  // ─── المصادقة ──────────────────────────────────
  async signUp(email, password, fullName, age) {
    if (!this.client) return this.offlineSignUp(email, fullName, age);
    const { data, error } = await this.client.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, age } }
    });
    if (error) throw error;
    this.currentUser = data.user;
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_name', fullName);
    return data;
  },

  async signIn(email, password) {
    if (!this.client) throw new Error('لا يوجد اتصال بالإنترنت');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    localStorage.setItem('user_id', data.user.id);
    const profile = await this.getProfile();
    if (profile) localStorage.setItem('user_name', profile.full_name);
    return data;
  },

  async signOut() {
    if (this.client) await this.client.auth.signOut();
    this.currentUser = null;
    localStorage.clear();
  },

  async restoreSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    if (data?.session) this.currentUser = data.session.user;
    return data?.session;
  },

  offlineSignUp(email, fullName, age) {
    const fakeId = 'local_' + Date.now();
    localStorage.setItem('user_id', fakeId);
    localStorage.setItem('user_name', fullName);
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_age', age);
    this.currentUser = { id: fakeId };
    return { user: { id: fakeId } };
  },

  // ─── الملف الشخصي ──────────────────────────────────
  async getProfile() {
    if (!this.client || !this.currentUser) return null;
    const { data, error } = await this.client
      .from('profiles').select('*').eq('id', this.currentUser.id).single();
    if (error) console.error(error);
    return data;
  },

  // ─── التقدم في الدروس ──────────────────────────────────
  async saveProgress(chapterId, lessonId, status = 'completed') {
    const key = `progress_${lessonId}`;
    const data = { chapter_id: chapterId, lesson_id: lessonId, status, completed_at: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(data));

    if (this.client && this.currentUser && this.isOnline) {
      await this.client.from('lesson_progress').upsert({
        user_id: this.currentUser.id,
        chapter_id: chapterId,
        lesson_id: lessonId,
        status,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' });
    } else {
      this.queuePending('progress', data);
    }
  },

  getLocalProgress() {
    const progress = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('progress_')) {
        const data = JSON.parse(localStorage.getItem(key));
        progress[data.lesson_id] = data;
      }
    }
    return progress;
  },

  // ─── نتائج الاختبارات ──────────────────────────────────
  async saveQuizResult(lessonId, score, total, wrongAnswers = []) {
    const percentage = Math.round((score / total) * 100);
    const data = {
      lesson_id: lessonId, quiz_type: 'lesson',
      score, total_questions: total, percentage,
      wrong_answers: wrongAnswers,
      created_at: new Date().toISOString()
    };
    const key = `quiz_${lessonId}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(data));

    if (this.client && this.currentUser && this.isOnline) {
      await this.client.from('quiz_results').insert({
        user_id: this.currentUser.id, ...data
      });
    } else {
      this.queuePending('quiz', data);
    }
  },

  getLocalQuizResults() {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('quiz_')) results.push(JSON.parse(localStorage.getItem(key)));
    }
    return results;
  },

  // ─── الإحصائيات ──────────────────────────────────
  async updateStats(updates) {
    const current = this.getLocalStats();
    const merged = { ...current, ...updates };
    localStorage.setItem('user_stats', JSON.stringify(merged));

    if (this.client && this.currentUser && this.isOnline) {
      await this.client.from('user_stats').upsert({
        user_id: this.currentUser.id, ...merged,
        updated_at: new Date().toISOString()
      });
    }
    return merged;
  },

  getLocalStats() {
    const stats = localStorage.getItem('user_stats');
    return stats ? JSON.parse(stats) : {
      xp: 0, level: 1, stars: 0, coins: 0, gems: 0,
      streak_days: 0, last_study_date: null, total_study_minutes: 0
    };
  },

  // ─── المفضلة ──────────────────────────────────
  async toggleFavorite(itemType, itemId, itemData) {
    const favs = this.getLocalFavorites();
    const key = `${itemType}_${itemId}`;
    if (favs[key]) {
      delete favs[key];
      if (this.client && this.currentUser) {
        await this.client.from('favorites').delete()
          .eq('user_id', this.currentUser.id)
          .eq('item_type', itemType).eq('item_id', itemId);
      }
    } else {
      favs[key] = { item_type: itemType, item_id: itemId, item_data: itemData, created_at: new Date().toISOString() };
      if (this.client && this.currentUser) {
        await this.client.from('favorites').insert({
          user_id: this.currentUser.id, item_type: itemType, item_id: itemId, item_data: itemData
        });
      }
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
    return !!favs[key];
  },

  getLocalFavorites() {
    const favs = localStorage.getItem('favorites');
    return favs ? JSON.parse(favs) : {};
  },

  isFavorite(itemType, itemId) {
    const favs = this.getLocalFavorites();
    return !!favs[`${itemType}_${itemId}`];
  },

  // ─── الإنجازات ──────────────────────────────────
  async unlockAchievement(key, name, icon) {
    const achs = this.getLocalAchievements();
    if (achs[key]) return false;
    achs[key] = { achievement_key: key, achievement_name: name, icon, unlocked_at: new Date().toISOString() };
    localStorage.setItem('achievements', JSON.stringify(achs));

    if (this.client && this.currentUser && this.isOnline) {
      await this.client.from('achievements').insert({
        user_id: this.currentUser.id,
        achievement_key: key, achievement_name: name, icon
      });
    }
    return true;
  },

  getLocalAchievements() {
    const a = localStorage.getItem('achievements');
    return a ? JSON.parse(a) : {};
  },

  // ─── قائمة انتظار المزامنة ──────────────────────────────────
  queuePending(type, data) {
    const queue = JSON.parse(localStorage.getItem('pending_sync') || '[]');
    queue.push({ type, data, timestamp: Date.now() });
    localStorage.setItem('pending_sync', JSON.stringify(queue));
  },

  async syncPending() {
    if (!this.client || !this.currentUser) return;
    const queue = JSON.parse(localStorage.getItem('pending_sync') || '[]');
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        if (item.type === 'progress') {
          await this.client.from('lesson_progress').upsert({
            user_id: this.currentUser.id, ...item.data
          }, { onConflict: 'user_id,lesson_id' });
        } else if (item.type === 'quiz') {
          await this.client.from('quiz_results').insert({
            user_id: this.currentUser.id, ...item.data
          });
        }
      } catch (e) { console.error('Sync error:', e); }
    }
    localStorage.setItem('pending_sync', '[]');
  }
};

window.db = db;
