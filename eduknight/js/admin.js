/* ==========================================================================
   EduKnight — Admin Panel
   Depends on js/app-shell.js. Gates the whole page behind role === 'admin'
   (server-side enforcement lives in restrictTo('admin') on every /api/admin
   route — this client-side check is just for UX, not the real security).
   ========================================================================== */

let qPage = 1, rPage = 1, sPage = 1, aPage = 1;
let chaptersCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadSidebarUser();
  if (!user || user.role !== 'admin') {
    document.getElementById('adminGate').innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <i class="bi bi-shield-x" style="font-size:32px;"></i>
        <p style="margin-top:10px;">This area is for admins only.</p>
        <a href="dashboard.html" class="btn btn-primary" style="margin-top:14px;">Back to Dashboard</a>
      </div>`;
    return;
  }

  initTabs();
  loadAnalytics();
  wireQuestions();
  wireQuizManagement();
  wireResources();
  wireStudents();
});

function initTabs() {
  document.querySelectorAll('#adminTabs .exam-select-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#adminTabs .exam-select-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.admin-panel-section').forEach(s => s.style.display = 'none');
      document.getElementById(`section-${btn.dataset.tab}`).style.display = 'block';
      if (btn.dataset.tab === 'questions' && !chaptersCache.length) loadChaptersCache();
      if (btn.dataset.tab === 'quizmgmt') { loadQuizSettings(); loadAttempts(); }
      if (btn.dataset.tab === 'resources') loadResources();
      if (btn.dataset.tab === 'students') loadStudents();
    });
  });
}

function renderPagination(containerId, pagination, onPage) {
  const el = document.getElementById(containerId);
  const { page, totalPages } = pagination;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = `<button class="res-page-btn" ${page === 1 ? 'disabled' : ''} data-p="${page - 1}"><i class="bi bi-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) html += `<button class="res-page-btn ${i === page ? 'active' : ''}" data-p="${i}">${i}</button>`;
    else if (Math.abs(i - page) === 2) html += `<span style="color:var(--text-muted);padding:0 4px;">…</span>`;
  }
  html += `<button class="res-page-btn" ${page === totalPages ? 'disabled' : ''} data-p="${page + 1}"><i class="bi bi-chevron-right"></i></button>`;
  el.innerHTML = html;
  el.querySelectorAll('.res-page-btn:not(:disabled)').forEach(b => b.addEventListener('click', () => onPage(parseInt(b.dataset.p, 10))));
}

/* ============================== Analytics ============================== */
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/analytics`, { credentials: 'include' });
    const { data } = await res.json();

    const t = data.totals;
    document.getElementById('analyticsStats').innerHTML = `
      <div class="mini-stat-card"><div class="msc-icon icon-blue"><i class="bi bi-people-fill"></i></div><div><strong>${t.totalStudents}</strong><span>Students</span></div></div>
      <div class="mini-stat-card"><div class="msc-icon icon-indigo"><i class="bi bi-shield-lock-fill"></i></div><div><strong>${t.totalAdmins}</strong><span>Admins</span></div></div>
      <div class="mini-stat-card"><div class="msc-icon icon-green"><i class="bi bi-journal-question"></i></div><div><strong>${t.totalQuestions}</strong><span>Questions</span></div></div>
      <div class="mini-stat-card"><div class="msc-icon" style="background:rgba(245,158,11,0.12);color:var(--warning);"><i class="bi bi-collection-play"></i></div><div><strong>${t.totalResources}</strong><span>Resources</span></div></div>
      <div class="mini-stat-card"><div class="msc-icon" style="background:rgba(239,68,68,0.1);color:var(--danger);"><i class="bi bi-controller"></i></div><div><strong>${t.totalBattles}</strong><span>Battles played</span></div></div>
      <div class="mini-stat-card"><div class="msc-icon icon-blue"><i class="bi bi-bullseye"></i></div><div><strong>${data.avgAccuracy}%</strong><span>Avg. accuracy</span></div></div>
    `;

    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--primary').trim();
    const accent = styles.getPropertyValue('--accent').trim();
    const muted = styles.getPropertyValue('--text-muted').trim();
    const border = styles.getPropertyValue('--border').trim();

    new Chart(document.getElementById('signupsChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: data.last7Days.labels,
        datasets: [
          { label: 'Signups', data: data.last7Days.signups, borderColor: primary, backgroundColor: 'transparent', tension: 0.4 },
          { label: 'Quiz Attempts', data: data.last7Days.quizAttempts, borderColor: accent, backgroundColor: 'transparent', tension: 0.4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: muted } } }, scales: { y: { ticks: { color: muted }, grid: { color: border } }, x: { ticks: { color: muted }, grid: { display: false } } } },
    });

    new Chart(document.getElementById('examDistChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.examDistribution.map(e => e.exam),
        datasets: [{ data: data.examDistribution.map(e => e.count), backgroundColor: [primary, accent, styles.getPropertyValue('--secondary').trim()] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: muted } } } },
    });
  } catch (err) {
    showToast('Could not load analytics.', 'error');
  }
}

/* ============================== Questions ============================== */
async function loadChaptersCache() {
  const res = await fetch(`${API_BASE_URL}/admin/chapters`, { credentials: 'include' });
  const { data } = await res.json();
  chaptersCache = data;
  loadQuestions();
}

function wireQuestions() {
  document.getElementById('qSearchInput').addEventListener('input', debounce(() => { qPage = 1; loadQuestions(); }, 350));
  document.getElementById('qExamFilter').addEventListener('change', () => { qPage = 1; loadQuestions(); });
  document.getElementById('qDifficultyFilter').addEventListener('change', () => { qPage = 1; loadQuestions(); });
  document.getElementById('addQuestionBtn').addEventListener('click', () => openQuestionModal());
}

async function loadQuestions() {
  const table = document.getElementById('questionsTable');
  table.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--text-muted);">Loading…</td></tr>`;

  const qs = new URLSearchParams({ page: qPage });
  const search = document.getElementById('qSearchInput').value;
  const exam = document.getElementById('qExamFilter').value;
  const difficulty = document.getElementById('qDifficultyFilter').value;
  if (search) qs.set('search', search);
  if (exam) qs.set('exam', exam);
  if (difficulty) qs.set('difficulty', difficulty);

  const res = await fetch(`${API_BASE_URL}/admin/questions?${qs}`, { credentials: 'include' });
  const { data } = await res.json();

  if (!data.questions.length) {
    table.innerHTML = `<tr><td style="padding:24px;text-align:center;color:var(--text-muted);">No questions found.</td></tr>`;
  } else {
    table.innerHTML = `
      <tr><th>Question</th><th>Chapter</th><th>Exam</th><th>Difficulty</th><th>PYQ</th><th></th></tr>
      ${data.questions.map(q => `
        <tr>
          <td class="dt-truncate">${q.questionText}</td>
          <td>${q.chapter?.name || '—'}</td>
          <td>${q.examCode}</td>
          <td><span class="diff-badge diff-${q.difficulty}">${q.difficulty}</span></td>
          <td>${q.isPYQ ? `<i class="bi bi-check-circle-fill" style="color:var(--accent);"></i>` : '—'}</td>
          <td class="dt-actions">
            <div class="dt-icon-btn" data-edit="${q._id}"><i class="bi bi-pencil"></i></div>
            <div class="dt-icon-btn danger" data-delete="${q._id}"><i class="bi bi-trash"></i></div>
          </td>
        </tr>`).join('')}`;
  }

  table.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const q = data.questions.find(x => x._id === el.dataset.edit);
    openQuestionModal(q);
  }));
  table.querySelectorAll('[data-delete]').forEach(el => el.addEventListener('click', () => deleteQuestion(el.dataset.delete)));

  renderPagination('questionsPagination', data.pagination, (p) => { qPage = p; loadQuestions(); });
}

function openQuestionModal(existing) {
  const isEdit = !!existing;
  const chapterOptions = chaptersCache.map(c => `<option value="${c._id}" ${existing?.chapter?._id === c._id ? 'selected' : ''}>${c.examCode} — ${c.name}</option>`).join('');
  const opts = existing?.options || ['', '', '', ''];

  Swal.fire({
    title: isEdit ? 'Edit Question' : 'Add Question',
    width: 640,
    html: `
      <div class="admin-form-field"><label>Chapter</label><select id="swChapter" ${isEdit ? 'disabled' : ''}>${chapterOptions}</select></div>
      <div class="admin-form-field"><label>Question text</label><textarea id="swQuestionText" rows="2">${existing?.questionText || ''}</textarea></div>
      <div class="admin-form-field"><label>Options (select the correct one)</label>
        ${[0, 1, 2, 3].map(i => `
          <div class="admin-option-row">
            <input type="radio" name="swCorrect" value="${i}" ${existing ? (existing.correctOptionIndex === i ? 'checked' : '') : (i === 0 ? 'checked' : '')}>
            <input type="text" id="swOpt${i}" value="${(opts[i] || '').replace(/"/g, '&quot;')}" placeholder="Option ${String.fromCharCode(65 + i)}">
          </div>`).join('')}
      </div>
      <div class="admin-form-row">
        <div class="admin-form-field"><label>Difficulty</label><select id="swDifficulty">
          ${['easy', 'medium', 'hard'].map(d => `<option value="${d}" ${existing?.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select></div>
        <div class="admin-form-field"><label>Is PYQ?</label><select id="swIsPyq">
          <option value="false" ${!existing?.isPYQ ? 'selected' : ''}>No</option>
          <option value="true" ${existing?.isPYQ ? 'selected' : ''}>Yes</option>
        </select></div>
      </div>
      <div class="admin-form-field"><label>Explanation</label><textarea id="swExplanation" rows="2">${existing?.explanation || ''}</textarea></div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? 'Save Changes' : 'Create Question',
    confirmButtonColor: '#2563EB',
    preConfirm: () => {
      const questionText = document.getElementById('swQuestionText').value.trim();
      const options = [0, 1, 2, 3].map(i => document.getElementById(`swOpt${i}`).value.trim());
      if (!questionText || options.some(o => !o)) {
        Swal.showValidationMessage('Fill in the question text and all 4 options.');
        return false;
      }
      return {
        chapter: document.getElementById('swChapter')?.value,
        questionText, options,
        correctOptionIndex: parseInt(document.querySelector('input[name="swCorrect"]:checked').value, 10),
        difficulty: document.getElementById('swDifficulty').value,
        isPYQ: document.getElementById('swIsPyq').value === 'true',
        explanation: document.getElementById('swExplanation').value.trim(),
      };
    },
  }).then(async (result) => {
    if (!result.isConfirmed) return;
    try {
      const url = isEdit ? `${API_BASE_URL}/admin/questions/${existing._id}` : `${API_BASE_URL}/admin/questions`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result.value),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast(isEdit ? 'Question updated.' : 'Question created.', 'success');
      loadQuestions();
    } catch (err) {
      showToast(err.message || 'Could not save question.', 'error');
    }
  });
}

async function deleteQuestion(id) {
  const confirm = await Swal.fire({ title: 'Delete this question?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Delete' });
  if (!confirm.isConfirmed) return;
  const res = await fetch(`${API_BASE_URL}/admin/questions/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { showToast('Question deleted.', 'success'); loadQuestions(); }
  else showToast('Could not delete question.', 'error');
}

/* ============================== Quiz Management ============================== */
function wireQuizManagement() {
  document.getElementById('quizSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      dailyQuizQuestionCount: parseInt(document.getElementById('qsQuestionCount').value, 10),
      dailyQuizXpReward: parseInt(document.getElementById('qsXpReward').value, 10),
      dailyQuizCoinsReward: parseInt(document.getElementById('qsCoinsReward').value, 10),
    };
    try {
      const res = await fetch(`${API_BASE_URL}/admin/quiz-settings`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      showToast('Daily quiz settings saved.', 'success');
    } catch (err) {
      showToast('Could not save settings.', 'error');
    }
  });

  document.getElementById('qaModeFilter').addEventListener('change', () => { aPage = 1; loadAttempts(); });
}

async function loadQuizSettings() {
  const res = await fetch(`${API_BASE_URL}/admin/quiz-settings`, { credentials: 'include' });
  const { data } = await res.json();
  document.getElementById('qsQuestionCount').value = data.dailyQuizQuestionCount;
  document.getElementById('qsXpReward').value = data.dailyQuizXpReward;
  document.getElementById('qsCoinsReward').value = data.dailyQuizCoinsReward;
}

async function loadAttempts() {
  const table = document.getElementById('attemptsTable');
  table.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--text-muted);">Loading…</td></tr>`;

  const qs = new URLSearchParams({ page: aPage });
  const mode = document.getElementById('qaModeFilter').value;
  if (mode) qs.set('mode', mode);

  const res = await fetch(`${API_BASE_URL}/admin/quiz-attempts?${qs}`, { credentials: 'include' });
  const { data } = await res.json();

  if (!data.attempts.length) {
    table.innerHTML = `<tr><td style="padding:24px;text-align:center;color:var(--text-muted);">No quiz attempts yet.</td></tr>`;
  } else {
    table.innerHTML = `
      <tr><th>Student</th><th>Mode</th><th>Exam</th><th>Score</th><th>Accuracy</th><th>XP</th><th>Date</th></tr>
      ${data.attempts.map(a => `
        <tr>
          <td>${a.user?.name || 'Deleted user'}</td>
          <td style="text-transform:capitalize;">${a.mode}</td>
          <td>${a.examCode}</td>
          <td>${a.correctCount}/${a.totalQuestions}</td>
          <td>${a.accuracy}%</td>
          <td>+${a.xpEarned}</td>
          <td>${new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
        </tr>`).join('')}`;
  }

  renderPagination('attemptsPagination', data.pagination, (p) => { aPage = p; loadAttempts(); });
}

/* ============================== Resources ============================== */
function wireResources() {
  document.getElementById('rSearchInput').addEventListener('input', debounce(() => { rPage = 1; loadResources(); }, 350));
  document.getElementById('rTypeFilter').addEventListener('change', () => { rPage = 1; loadResources(); });
  document.getElementById('addResourceBtn').addEventListener('click', () => openResourceModal());
}

async function loadResources() {
  const table = document.getElementById('resourcesTable');
  table.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--text-muted);">Loading…</td></tr>`;

  const qs = new URLSearchParams({ page: rPage });
  const search = document.getElementById('rSearchInput').value;
  const type = document.getElementById('rTypeFilter').value;
  if (search) qs.set('search', search);
  if (type) qs.set('type', type);

  const res = await fetch(`${API_BASE_URL}/admin/resources?${qs}`, { credentials: 'include' });
  const { data } = await res.json();

  if (!data.resources.length) {
    table.innerHTML = `<tr><td style="padding:24px;text-align:center;color:var(--text-muted);">No resources found.</td></tr>`;
  } else {
    table.innerHTML = `
      <tr><th>Title</th><th>Type</th><th>Exam / Subject</th><th>Source</th><th></th></tr>
      ${data.resources.map(r => `
        <tr>
          <td class="dt-truncate">${r.thumbnailEmoji} ${r.title}</td>
          <td style="text-transform:capitalize;">${r.type.replace('-', ' ')}</td>
          <td>${r.examCode} / ${r.subjectCode}</td>
          <td>${r.source || '—'}</td>
          <td class="dt-actions">
            <div class="dt-icon-btn" data-edit="${r._id}"><i class="bi bi-pencil"></i></div>
            <div class="dt-icon-btn danger" data-delete="${r._id}"><i class="bi bi-trash"></i></div>
          </td>
        </tr>`).join('')}`;
  }

  table.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const r = data.resources.find(x => x._id === el.dataset.edit);
    openResourceModal(r);
  }));
  table.querySelectorAll('[data-delete]').forEach(el => el.addEventListener('click', () => deleteResource(el.dataset.delete)));

  renderPagination('resourcesPagination', data.pagination, (p) => { rPage = p; loadResources(); });
}

function openResourceModal(existing) {
  const isEdit = !!existing;
  Swal.fire({
    title: isEdit ? 'Edit Resource' : 'Add Resource',
    width: 560,
    html: `
      <div class="admin-form-field"><label>Title</label><input type="text" id="swTitle" value="${existing?.title || ''}"></div>
      <div class="admin-form-row">
        <div class="admin-form-field"><label>Type</label><select id="swType">
          ${['youtube', 'notes', 'formula-sheet', 'pyq-paper'].map(t => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t.replace('-', ' ')}</option>`).join('')}
        </select></div>
        <div class="admin-form-field"><label>Exam</label><select id="swExam">
          ${['NEET', 'JEE', 'MHT-CET'].map(e => `<option value="${e}" ${existing?.examCode === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select></div>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-field"><label>Subject code</label><input type="text" id="swSubject" value="${existing?.subjectCode || ''}" placeholder="e.g. physics"></div>
        <div class="admin-form-field"><label>Source / Channel</label><input type="text" id="swSource" value="${existing?.source || ''}"></div>
      </div>
      <div class="admin-form-field"><label>URL</label><input type="text" id="swUrl" value="${existing?.url || ''}" placeholder="https://..."></div>
      <div class="admin-form-field"><label>Description</label><textarea id="swDesc" rows="2">${existing?.description || ''}</textarea></div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? 'Save Changes' : 'Create Resource',
    confirmButtonColor: '#2563EB',
    preConfirm: () => {
      const title = document.getElementById('swTitle').value.trim();
      const url = document.getElementById('swUrl').value.trim();
      const subjectCode = document.getElementById('swSubject').value.trim();
      if (!title || !url || !subjectCode) {
        Swal.showValidationMessage('Title, subject code, and URL are required.');
        return false;
      }
      return {
        title, url, subjectCode,
        type: document.getElementById('swType').value,
        examCode: document.getElementById('swExam').value,
        source: document.getElementById('swSource').value.trim(),
        description: document.getElementById('swDesc').value.trim(),
      };
    },
  }).then(async (result) => {
    if (!result.isConfirmed) return;
    try {
      const url = isEdit ? `${API_BASE_URL}/admin/resources/${existing._id}` : `${API_BASE_URL}/admin/resources`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result.value),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast(isEdit ? 'Resource updated.' : 'Resource created.', 'success');
      loadResources();
    } catch (err) {
      showToast(err.message || 'Could not save resource.', 'error');
    }
  });
}

async function deleteResource(id) {
  const confirm = await Swal.fire({ title: 'Delete this resource?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Delete' });
  if (!confirm.isConfirmed) return;
  const res = await fetch(`${API_BASE_URL}/admin/resources/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { showToast('Resource deleted.', 'success'); loadResources(); }
  else showToast('Could not delete resource.', 'error');
}

/* ============================== Students ============================== */
function wireStudents() {
  document.getElementById('sSearchInput').addEventListener('input', debounce(() => { sPage = 1; loadStudents(); }, 350));
  document.getElementById('sRoleFilter').addEventListener('change', () => { sPage = 1; loadStudents(); });
}

async function loadStudents() {
  const table = document.getElementById('studentsTable');
  table.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--text-muted);">Loading…</td></tr>`;

  const qs = new URLSearchParams({ page: sPage });
  const search = document.getElementById('sSearchInput').value;
  const role = document.getElementById('sRoleFilter').value;
  if (search) qs.set('search', search);
  if (role) qs.set('role', role);

  const res = await fetch(`${API_BASE_URL}/admin/students?${qs}`, { credentials: 'include' });
  const { data } = await res.json();

  if (!data.students.length) {
    table.innerHTML = `<tr><td style="padding:24px;text-align:center;color:var(--text-muted);">No students found.</td></tr>`;
  } else {
    table.innerHTML = `
      <tr><th>Name</th><th>Email</th><th>Exam</th><th>Role</th><th>XP</th><th>Streak</th><th>Joined</th><th></th></tr>
      ${data.students.map(s => `
        <tr>
          <td>${s.name}</td>
          <td>${s.email}</td>
          <td>${s.targetExam}</td>
          <td><span class="role-chip ${s.role}">${s.role}</span></td>
          <td>${s.xp}</td>
          <td>${s.streakCount}🔥</td>
          <td>${new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
          <td class="dt-actions">
            <div class="dt-icon-btn" data-toggle-role="${s._id}" data-current-role="${s.role}" title="Toggle admin role"><i class="bi bi-shield-lock"></i></div>
            <div class="dt-icon-btn danger" data-delete-student="${s._id}" title="Delete account"><i class="bi bi-trash"></i></div>
          </td>
        </tr>`).join('')}`;
  }

  table.querySelectorAll('[data-toggle-role]').forEach(el => el.addEventListener('click', () => toggleStudentRole(el.dataset.toggleRole, el.dataset.currentRole)));
  table.querySelectorAll('[data-delete-student]').forEach(el => el.addEventListener('click', () => deleteStudent(el.dataset.deleteStudent)));

  renderPagination('studentsPagination', data.pagination, (p) => { sPage = p; loadStudents(); });
}

async function toggleStudentRole(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'student' : 'admin';
  const confirm = await Swal.fire({
    title: `Make this user ${newRole === 'admin' ? 'an admin' : 'a student'}?`,
    icon: 'question', showCancelButton: true, confirmButtonColor: '#2563EB', confirmButtonText: 'Confirm',
  });
  if (!confirm.isConfirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/${id}/role`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    showToast('Role updated.', 'success');
    loadStudents();
  } catch (err) {
    showToast(err.message || 'Could not update role.', 'error');
  }
}

async function deleteStudent(id) {
  const confirm = await Swal.fire({ title: 'Delete this account?', text: 'This permanently removes the user.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Delete' });
  if (!confirm.isConfirmed) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).message);
    showToast('Account deleted.', 'success');
    loadStudents();
  } catch (err) {
    showToast(err.message || 'Could not delete account.', 'error');
  }
}

/* ---------------- Utility ---------------- */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
