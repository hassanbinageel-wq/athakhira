// ═══════════════════════════════════════════════════════════════════
// وحدة تحكم لوحة الإدارة
// ═══════════════════════════════════════════════════════════════════

const admin = {
  client: null,
  currentUser: null,
  usersData: [],

  init() {
    if (CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      this.showToast('يرجى إعداد Supabase أولاً من صفحة الإعدادات', true);
      return;
    }
    this.client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    this.checkSession();
  },

  async checkSession() {
    if (!this.client) return;
    const { data } = await this.client.auth.getSession();
    if (data?.session) {
      // تحقق أن الحساب Admin
      const { data: profile } = await this.client
        .from('profiles').select('*').eq('id', data.session.user.id).single();
      if (profile?.role === 'admin') {
        this.currentUser = data.session.user;
        document.getElementById('admin-name').textContent = profile.full_name || 'المشرف';
        this.showDashboard();
      } else {
        await this.client.auth.signOut();
      }
    }
  },

  async login() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errEl = document.getElementById('login-error');

    if (!email || !password) {
      errEl.textContent = 'يرجى ملء جميع الحقول';
      return;
    }
    if (!this.client) {
      errEl.textContent = 'يجب إعداد Supabase أولاً في ملف config.js';
      return;
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile } = await this.client
        .from('profiles').select('*').eq('id', data.user.id).single();

      if (!profile || profile.role !== 'admin') {
        await this.client.auth.signOut();
        errEl.textContent = 'هذا الحساب ليس حساب مشرف';
        return;
      }

      this.currentUser = data.user;
      document.getElementById('admin-name').textContent = profile.full_name || 'المشرف';
      errEl.textContent = '';
      this.showDashboard();
    } catch (err) {
      errEl.textContent = err.message || 'فشل تسجيل الدخول';
    }
  },

  async logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
      await this.client.auth.signOut();
      document.getElementById('dashboard-view').classList.remove('active');
      document.getElementById('login-view').classList.add('active');
    }
  },

  showDashboard() {
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    this.showPage('overview');
  },

  // ═══════════════════════════ التنقل بين الصفحات ═══════════════════════════
  showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelector(`.nav-item[onclick*="${page}"]`).classList.add('active');

    const titles = {
      'overview': 'نظرة عامة',
      'users': 'الطلاب',
      'lessons': 'الدروس',
      'quiz-stats': 'الاختبارات',
      'notifications': 'الإشعارات',
      'reports': 'التقارير',
      'settings': 'الإعدادات',
    };
    document.getElementById('page-title').textContent = titles[page] || '';

    if (page === 'overview') this.loadOverview();
    if (page === 'users') this.loadUsers();
    if (page === 'lessons') this.loadLessons();
    if (page === 'quiz-stats') this.loadQuizStats();
    if (page === 'notifications') this.loadNotifications();
  },

  // ═══════════════════════════ نظرة عامة ═══════════════════════════
  async loadOverview() {
    if (!this.client) return;

    // KPIs
    const { count: userCount } = await this.client
      .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    document.getElementById('kpi-users').textContent = userCount || 0;

    const { count: lessonCount } = await this.client
      .from('lesson_progress').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    document.getElementById('kpi-lessons').textContent = lessonCount || 0;

    const { count: quizCount } = await this.client
      .from('quiz_results').select('*', { count: 'exact', head: true });
    document.getElementById('kpi-quizzes').textContent = quizCount || 0;

    const { data: quizzes } = await this.client.from('quiz_results').select('percentage');
    const avg = quizzes && quizzes.length > 0
      ? Math.round(quizzes.reduce((s, q) => s + (q.percentage || 0), 0) / quizzes.length)
      : 0;
    document.getElementById('kpi-avg').textContent = `${avg}%`;

    // مخططات
    this.drawChapterChart();
    this.drawActivityChart();
  },

  async drawChapterChart() {
    if (!this.client) return;
    const { data } = await this.client.from('lesson_progress').select('chapter_id').eq('status', 'completed');
    const chapterCounts = {};
    (data || []).forEach(row => {
      chapterCounts[row.chapter_id] = (chapterCounts[row.chapter_id] || 0) + 1;
    });

    const chapters = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'];
    const labels = ['الدين', 'الوضوء', 'الصلاة', 'الأدعية', 'الأحوال', 'النبي', 'الجنازة', 'الأذكار'];

    const ctx = document.getElementById('chart-chapters').getContext('2d');
    if (this.chartChapters) this.chartChapters.destroy();
    this.chartChapters = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'دروس مكتملة',
          data: chapters.map(c => chapterCounts[c] || 0),
          backgroundColor: '#0E4B3F',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  },

  async drawActivityChart() {
    if (!this.client) return;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(Date.now() - i * 86400000));
    }
    const labels = days.map(d => d.toLocaleDateString('ar-SA', { weekday: 'short' }));

    const { data } = await this.client
      .from('quiz_results')
      .select('created_at')
      .gte('created_at', days[0].toISOString());

    const counts = days.map(day => {
      const dayStr = day.toISOString().split('T')[0];
      return (data || []).filter(r => r.created_at.startsWith(dayStr)).length;
    });

    const ctx = document.getElementById('chart-activity').getContext('2d');
    if (this.chartActivity) this.chartActivity.destroy();
    this.chartActivity = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'اختبارات',
          data: counts,
          borderColor: '#D4A94A',
          backgroundColor: 'rgba(212, 169, 74, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
      }
    });
  },

  // ═══════════════════════════ الطلاب ═══════════════════════════
  async loadUsers() {
    if (!this.client) return;
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">جارٍ التحميل...</td></tr>';

    const { data: profiles } = await this.client
      .from('profiles')
      .select('*, user_stats(*)')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (!profiles || profiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">لا يوجد طلاب مسجلون بعد</td></tr>';
      return;
    }

    this.usersData = profiles;
    this.renderUsers(profiles);
  },

  renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = users.map(u => {
      const stats = u.user_stats?.[0] || u.user_stats || {};
      return `
        <tr>
          <td>${u.full_name || '-'}</td>
          <td>${u.email || '-'}</td>
          <td>${u.age || '-'}</td>
          <td><span class="badge success">${stats.level || 1}</span></td>
          <td>${stats.xp || 0}</td>
          <td>🔥 ${stats.streak_days || 0}</td>
          <td>
            <button class="btn small primary" onclick="admin.viewUser('${u.id}')">عرض</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterUsers() {
    const query = document.getElementById('user-search').value.trim().toLowerCase();
    if (!query) return this.renderUsers(this.usersData);
    const filtered = this.usersData.filter(u =>
      (u.full_name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query)
    );
    this.renderUsers(filtered);
  },

  async viewUser(userId) {
    const user = this.usersData.find(u => u.id === userId);
    if (!user) return;

    const { data: progress } = await this.client
      .from('lesson_progress').select('*').eq('user_id', userId).eq('status', 'completed');

    const { data: quizzes } = await this.client
      .from('quiz_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);

    const avg = quizzes && quizzes.length > 0
      ? Math.round(quizzes.reduce((s, q) => s + (q.percentage || 0), 0) / quizzes.length)
      : 0;

    alert(
      `📊 تقرير الطالب: ${user.full_name}\n\n` +
      `العمر: ${user.age || '-'}\n` +
      `الدروس المكتملة: ${progress?.length || 0}\n` +
      `عدد الاختبارات: ${quizzes?.length || 0}\n` +
      `متوسط الدرجات: ${avg}%\n` +
      `تاريخ التسجيل: ${new Date(user.created_at).toLocaleDateString('ar-SA')}`
    );
  },

  // ═══════════════════════════ الدروس ═══════════════════════════
  loadLessons() {
    const content = document.getElementById('lessons-content');
    // نعرض قائمة الفصول والدروس من نفس بيانات الكتاب المدرجة في تطبيق الطالب
    content.innerHTML = `
      <div class="form-card" style="max-width:none">
        <h3>هيكل الكتاب</h3>
        <p style="color:var(--text-muted);margin-bottom:16px">
          محتوى الكتاب مضمّن في تطبيق الطالب مباشرة (في ملف <code>data.js</code>) لضمان العمل بدون إنترنت وحفاظاً على النص الأصلي.
          لأي تعديل، حدّث الملف مباشرة ثم أعد بناء التطبيق.
        </p>
        <div id="chapters-summary"></div>
      </div>
    `;

    // نستخدم fetch لتحميل بيانات الكتاب من مسار نسبي (يفترض نشر تطبيق الطالب على نفس النطاق)
    // كبديل، نرسم قائمة مبسطة من قاعدة البيانات
    this.loadLessonsSummary();
  },

  async loadLessonsSummary() {
    const summary = document.getElementById('chapters-summary');
    if (!this.client) return;

    // نجمع كل chapter_id و lesson_id من التقدم
    const { data } = await this.client.from('lesson_progress').select('chapter_id, lesson_id, status');
    const grouped = {};
    (data || []).forEach(row => {
      if (!grouped[row.chapter_id]) grouped[row.chapter_id] = { total: 0, completed: 0, lessons: new Set() };
      grouped[row.chapter_id].lessons.add(row.lesson_id);
      grouped[row.chapter_id].total++;
      if (row.status === 'completed') grouped[row.chapter_id].completed++;
    });

    const chNames = {
      'ch1': 'أركان الدين والإسلام والإيمان والإحسان',
      'ch2': 'أحكام الطهارة والوضوء',
      'ch3': 'أركان الصلاة وشروطها',
      'ch4': 'أدعية الصلاة',
      'ch5': 'أدعية الأحوال اليومية',
      'ch6': 'نسب الرسول ﷺ',
      'ch7': 'صلاة الجنازة',
      'ch8': 'أذكار الصباح والمساء',
    };

    summary.innerHTML = Object.keys(chNames).map(chId => {
      const g = grouped[chId] || { completed: 0, total: 0, lessons: new Set() };
      return `
        <div class="chapter-block">
          <h3>${chNames[chId]}</h3>
          <div class="lesson-row">
            <span>عدد الطلاب الذين تفاعلوا معه</span>
            <strong>${g.total}</strong>
          </div>
          <div class="lesson-row">
            <span>عدد الإتمامات</span>
            <strong style="color:var(--success)">${g.completed}</strong>
          </div>
        </div>
      `;
    }).join('');
  },

  // ═══════════════════════════ الاختبارات ═══════════════════════════
  async loadQuizStats() {
    if (!this.client) return;
    const tbody = document.getElementById('quiz-tbody');

    const { data } = await this.client
      .from('quiz_results')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">لا توجد نتائج بعد</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => {
      const badge = r.percentage >= 80 ? 'success' : r.percentage >= 50 ? 'warning' : 'danger';
      return `
        <tr>
          <td>${r.profiles?.full_name || '-'}</td>
          <td>${r.lesson_id}</td>
          <td>${r.score}/${r.total_questions}</td>
          <td><span class="badge ${badge}">${r.percentage}%</span></td>
          <td>${new Date(r.created_at).toLocaleDateString('ar-SA')}</td>
        </tr>
      `;
    }).join('');
  },

  // ═══════════════════════════ الإشعارات ═══════════════════════════
  async loadNotifications() {
    if (!this.client) return;
    const { data } = await this.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const container = document.getElementById('notif-history');
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="padding:20px;color:var(--text-muted)">لا يوجد إشعارات مُرسلة</p>';
      return;
    }
    container.innerHTML = data.map(n => `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
        <div style="font-weight:700">${n.title}</div>
        <div style="color:var(--text-muted);font-size:13px;margin:4px 0">${n.body || ''}</div>
        <div style="color:var(--text-muted);font-size:12px">${new Date(n.created_at).toLocaleString('ar-SA')}</div>
      </div>
    `).join('');
  },

  async sendNotification() {
    const title = document.getElementById('notif-title').value.trim();
    const body = document.getElementById('notif-body').value.trim();
    const target = document.getElementById('notif-target').value;

    if (!title) return this.showToast('العنوان مطلوب', true);

    try {
      const { error } = await this.client.from('notifications').insert({
        title, body,
        target_role: target === 'all' ? null : target,
      });
      if (error) throw error;
      this.showToast('تم إرسال الإشعار بنجاح');
      document.getElementById('notif-title').value = '';
      document.getElementById('notif-body').value = '';
      this.loadNotifications();
    } catch (err) {
      this.showToast('خطأ: ' + err.message, true);
    }
  },

  // ═══════════════════════════ التقارير ═══════════════════════════
  async exportReport(type) {
    if (!this.client) return;
    let rows = [];
    let filename = '';

    if (type === 'users') {
      const { data } = await this.client
        .from('profiles')
        .select('*, user_stats(*)')
        .eq('role', 'student');
      rows = (data || []).map(u => {
        const s = u.user_stats?.[0] || u.user_stats || {};
        return {
          'الاسم': u.full_name, 'العمر': u.age,
          'المستوى': s.level || 1, 'XP': s.xp || 0,
          'سلسلة الأيام': s.streak_days || 0,
          'تاريخ التسجيل': new Date(u.created_at).toLocaleDateString('ar-SA')
        };
      });
      filename = 'users_report.csv';
    } else if (type === 'quizzes') {
      const { data } = await this.client
        .from('quiz_results').select('*, profiles(full_name)');
      rows = (data || []).map(r => ({
        'الطالب': r.profiles?.full_name,
        'الدرس': r.lesson_id,
        'النتيجة': r.score,
        'المجموع': r.total_questions,
        'النسبة': r.percentage,
        'التاريخ': new Date(r.created_at).toLocaleDateString('ar-SA')
      }));
      filename = 'quizzes_report.csv';
    } else if (type === 'progress') {
      const { data } = await this.client
        .from('lesson_progress').select('*, profiles(full_name)');
      rows = (data || []).map(p => ({
        'الطالب': p.profiles?.full_name,
        'الفصل': p.chapter_id, 'الدرس': p.lesson_id,
        'الحالة': p.status,
        'التاريخ': p.completed_at ? new Date(p.completed_at).toLocaleDateString('ar-SA') : '-'
      }));
      filename = 'progress_report.csv';
    }

    if (rows.length === 0) return this.showToast('لا توجد بيانات للتصدير', true);
    this.downloadCSV(rows, filename);
  },

  downloadCSV(rows, filename) {
    const headers = Object.keys(rows[0]);
    const csv = [
      '\uFEFF' + headers.join(','), // UTF-8 BOM for Arabic support
      ...rows.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    this.showToast('تم تحميل الملف');
  },

  // ═══════════════════════════ الإعدادات ═══════════════════════════
  saveSettings() {
    const url = document.getElementById('settings-url').value.trim();
    const key = document.getElementById('settings-key').value.trim();

    if (!url || !key) return this.showToast('يرجى ملء جميع الحقول', true);
    if (!url.includes('.supabase.co')) return this.showToast('URL غير صحيح', true);

    localStorage.setItem('admin_supabase_url', url);
    localStorage.setItem('admin_supabase_key', key);
    this.showToast('تم حفظ الإعدادات — سيتم إعادة التحميل...');
    setTimeout(() => location.reload(), 1200);
  },

  // ═══════════════════════════ Toast ═══════════════════════════
  showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
};

window.admin = admin;
document.addEventListener('DOMContentLoaded', () => admin.init());
