/* ==========================================================================
   EduKnight — Profile JS
   Shell behaviors (theme/sidebar/cmdk/logout) mirror dashboard.js exactly —
   duplicated intentionally rather than shared as a module, since this
   project has no build step (per the brief: no bundler, no frameworks).
   ========================================================================== */

const API_BASE_URL = 'http://localhost:5000/api';

const ACHIEVEMENTS = [
  { badge: '🔥', name: '7-Day Streak', desc: 'Study 7 days straight', key: 'streak7' },
  { badge: '🎯', name: 'Sharp Shooter', desc: '90%+ accuracy in a quiz', key: 'accuracy90' },
  { badge: '⚔️', name: 'First Blood', desc: 'Win your first battle', key: 'firstWin' },
  { badge: '📚', name: 'Chapter Master', desc: 'Finish a full chapter', key: 'chapterDone' },
  { badge: '💯', name: 'Century', desc: 'Solve 100 questions total', key: 'century' },
  { badge: '🌙', name: 'Night Owl', desc: 'Study after 11 PM 5 times', key: 'nightOwl' },
  { badge: '👑', name: 'King Tier', desc: 'Reach the top rank tier', key: 'kingTier' },
  { badge: '🤝', name: 'Rival', desc: 'Battle the same friend 5 times', key: 'rival' },
];

let currentUserData = null;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSidebarMobile();
  initCommandPalette();
  initLogout();
  initTabs();
  initEditForm();
  loadProfile();
});

/* ---------------- Shared shell behaviors (same as dashboard.js) ---------------- */
function initThemeToggle() {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    if (icon) {
      icon.innerHTML = theme === 'dark'
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
    localStorage.setItem('eduknight-theme', theme);
  };
  const saved = localStorage.getItem('eduknight-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
  toggle?.addEventListener('click', () => applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
}

function initSidebarMobile() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  document.getElementById('sidebarOpenBtn')?.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
  document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });
}

function initCommandPalette() {
  const palette = document.getElementById('cmdkPalette');
  const overlay = document.getElementById('cmdkOverlay');
  const input = document.getElementById('cmdkInput');
  const results = document.getElementById('cmdkResults');
  const trigger = document.getElementById('topbarCmdk');
  const routes = [
    { label: 'Dashboard', icon: 'bi-grid-1x2', href: 'dashboard.html' },
    { label: 'Profile', icon: 'bi-person-circle', href: 'profile.html' },
    { label: 'Exams', icon: 'bi-journal-bookmark', href: 'exams.html' },
    { label: 'Daily Quiz', icon: 'bi-lightning-charge', href: 'quiz.html' },
    { label: '1v1 Battle', icon: 'bi-controller', href: 'battle.html' },
    { label: 'Leaderboard', icon: 'bi-trophy', href: 'leaderboard.html' },
    { label: 'Resources', icon: 'bi-collection-play', href: 'resources.html' },
    { label: 'Settings', icon: 'bi-gear', href: 'settings.html' },
  ];
  const render = (query = '') => {
    const filtered = routes.filter(r => r.label.toLowerCase().includes(query.toLowerCase()));
    results.innerHTML = filtered.map(r => `<a href="${r.href}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;color:var(--text);font-size:14px;font-weight:500;"><i class="bi ${r.icon}" style="color:var(--primary);"></i> ${r.label}</a>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13.5px;">No matches</div>';
    results.querySelectorAll('a').forEach(a => a.addEventListener('click', closePalette));
  };
  const openPalette = () => { palette.style.display = 'block'; overlay.classList.add('open'); input.value = ''; render(); setTimeout(() => input.focus(), 50); };
  const closePalette = () => { palette.style.display = 'none'; overlay.classList.remove('open'); };
  trigger?.addEventListener('click', openPalette);
  overlay.addEventListener('click', closePalette);
  input?.addEventListener('input', () => render(input.value));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.style.display === 'block' ? closePalette() : openPalette(); }
    if (e.key === 'Escape') closePalette();
  });
}

function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch (_) {}
    window.location.href = 'login.html';
  });
}

function showToast(message, type = 'info') {
  const bg = { success: 'linear-gradient(135deg,#10B981,#059669)', error: 'linear-gradient(135deg,#EF4444,#DC2626)', info: 'linear-gradient(135deg,#2563EB,#4F46E5)' };
  if (window.Toastify) Toastify({ text: message, duration: 3500, gravity: 'top', position: 'right', style: { background: bg[type], borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '13.5px' } }).showToast();
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/* ---------------- Tabs ---------------- */
function initTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const panels = document.querySelectorAll('.profile-panel');
  const activate = (name) => {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  };
  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.tab)));
  document.getElementById('editProfileTabBtn')?.addEventListener('click', () => activate('edit'));
  document.getElementById('cancelEditBtn')?.addEventListener('click', () => activate('overview'));
}

/* ---------------- Load profile data ---------------- */
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE_URL}/users/me/profile`, { credentials: 'include' });
    if (!res.ok) throw new Error('unauthenticated');
    const { data } = await res.json();
    currentUserData = data;
    renderProfile(data);
  } catch (err) {
    renderProfile(getFallbackData());
    showToast('Showing preview data — log in to see your real profile.', 'info');
  }
}

function getFallbackData() {
  return {
    user: { name: 'Aspirant', email: 'you@example.com', avatarUrl: '', targetExam: 'NEET', level: 1, xp: 0, coins: 0, streakCount: 0, battleWins: 0, battleLosses: 0, winRate: 0, rankTier: 'Pawn', nextRankTier: 'Bishop', percentToNextTier: 0, memberSince: new Date().toISOString() },
    quizAccuracy: { overall: 0 },
    weeklyProgress: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], questionsSolved: [0, 0, 0, 0, 0, 0, 0] },
    monthlyProgress: { labels: ['W1', 'W2', 'W3', 'W4'], xpEarned: [0, 0, 0, 0] },
    activityTimeline: [{ type: 'account', text: 'Joined EduKnight', date: new Date().toISOString() }],
  };
}

function renderProfile(data) {
  const { user } = data;

  document.getElementById('profileAvatar').textContent = initials(user.name);
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileTierBadge').innerHTML = `<i class="bi bi-award"></i> ${user.rankTier} tier`;
  document.getElementById('profileExamBadge').innerHTML = `<i class="bi bi-journal-bookmark"></i> ${user.targetExam}`;
  document.getElementById('profileMemberBadge').innerHTML = `<i class="bi bi-calendar3"></i> Member since ${formatMonthYear(user.memberSince)}`;

  document.getElementById('pStatXp').textContent = (user.xp || 0).toLocaleString('en-IN');
  document.getElementById('pStatCoins').textContent = (user.coins || 0).toLocaleString('en-IN');
  document.getElementById('pStatStreak').textContent = user.streakCount || 0;
  document.getElementById('pStatBattles').textContent = `${user.battleWins || 0}-${user.battleLosses || 0}`;
  document.getElementById('pStatAccuracy').textContent = `${data.quizAccuracy.overall}%`;

  document.getElementById('sidebarAvatar').textContent = initials(user.name);
  document.getElementById('sidebarUserName').textContent = user.name;
  document.getElementById('sidebarUserTier').textContent = `${user.rankTier} tier`;

  // Prefill edit form
  document.getElementById('editName').value = user.name;
  document.getElementById('editEmail').value = user.email;
  document.getElementById('editExam').value = user.targetExam;

  renderAchievements(user);
  renderTimeline(data.activityTimeline);
  renderCharts(data.weeklyProgress, data.monthlyProgress);
}

function formatMonthYear(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function renderAchievements(user) {
  const grid = document.getElementById('profileAchvGrid');
  const unlocked = {
    streak7: user.streakCount >= 7,
    accuracy90: false,
    firstWin: user.battleWins > 0,
    chapterDone: false,
    century: user.xp >= 500,
    nightOwl: false,
    kingTier: user.rankTier === 'King',
    rival: false,
  };
  grid.innerHTML = ACHIEVEMENTS.map(a => `
    <div class="achievement-card ${unlocked[a.key] ? '' : 'locked'}">
      <div class="ac-badge">${a.badge}</div>
      <strong>${a.name}</strong>
      <span>${a.desc}</span>
    </div>`).join('');
}

function renderTimeline(items) {
  const el = document.getElementById('activityTimeline');
  if (!items || !items.length) {
    el.innerHTML = `<div class="empty-state"><i class="bi bi-clock-history"></i>No activity yet.</div>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <div class="timeline-item">
      <p>${item.text}</p>
      <span>${new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>`).join('');
}

function renderCharts(weekly, monthly) {
  if (!window.Chart) return;
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim() || '#2563EB';
  const accent = styles.getPropertyValue('--accent').trim() || '#10B981';
  const muted = styles.getPropertyValue('--text-muted').trim() || '#5B6472';
  const border = styles.getPropertyValue('--border').trim() || '#E5E9F0';

  const weeklyCanvas = document.getElementById('weeklyChart');
  if (weeklyCanvas) {
    new Chart(weeklyCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: weekly.labels, datasets: [{ label: 'Questions solved', data: weekly.questionsSolved, backgroundColor: primary, borderRadius: 6, maxBarThickness: 28 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: muted }, grid: { color: border } }, x: { ticks: { color: muted }, grid: { display: false } } } },
    });
  }

  const monthlyCanvas = document.getElementById('monthlyChart');
  if (monthlyCanvas) {
    new Chart(monthlyCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: monthly.labels, datasets: [{ label: 'XP earned', data: monthly.xpEarned, backgroundColor: accent, borderRadius: 6, maxBarThickness: 40 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: muted }, grid: { color: border } }, x: { ticks: { color: muted }, grid: { display: false } } } },
    });
  }
}

/* ---------------- Edit form — real PATCH to backend ---------------- */
function initEditForm() {
  const form = document.getElementById('editProfileForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('editName').value.trim();
    const targetExam = document.getElementById('editExam').value;

    if (name.length < 2) {
      showToast('Enter a valid name.', 'error');
      return;
    }

    const btn = document.getElementById('saveProfileBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, targetExam }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Could not save changes.');

      showToast('Profile updated successfully.', 'success');
      document.getElementById('profileName').textContent = name;
      document.getElementById('profileExamBadge').innerHTML = `<i class="bi bi-journal-bookmark"></i> ${targetExam}`;
      document.getElementById('sidebarUserName').textContent = name;
      document.querySelector('.profile-tab[data-tab="overview"]').click();
    } catch (err) {
      showToast(err.message || 'Could not save changes. Try again.', 'error');
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });
}