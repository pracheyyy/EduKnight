/* ==========================================================================
   EduKnight — Dashboard JS
   Fetches /api/users/dashboard (real backend, cookie auth) and renders every
   widget. Falls back to friendly placeholder data if the request fails
   (e.g. not logged in yet) so the screen is still inspectable/demoable.
   ========================================================================== */

const API_BASE_URL = 'http://localhost:5000/api';

const ACHIEVEMENTS = [
  { badge: '🔥', name: '7-Day Streak', desc: 'Study 7 days straight', key: 'streak7' },
  { badge: '🎯', name: 'Sharp Shooter', desc: '90%+ accuracy in a quiz', key: 'accuracy90' },
  { badge: '⚔️', name: 'First Blood', desc: 'Win your first battle', key: 'firstWin' },
  { badge: '📚', name: 'Chapter Master', desc: 'Finish a full chapter', key: 'chapterDone' },
];

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSidebarMobile();
  initCommandPalette();
  initLogout();
  loadDashboard();
});

/* ---------------- Theme (shared pattern with landing/auth) ---------------- */
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

  const saved = localStorage.getItem('eduknight-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
  toggle?.addEventListener('click', () => applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
}

/* ---------------- Mobile sidebar ---------------- */
function initSidebarMobile() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const openBtn = document.getElementById('sidebarOpenBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

/* ---------------- Command palette (Ctrl+K), same routes as landing ---------------- */
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
    results.innerHTML = filtered.map(r => `
      <a href="${r.href}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;color:var(--text);font-size:14px;font-weight:500;">
        <i class="bi ${r.icon}" style="color:var(--primary);"></i> ${r.label}
      </a>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13.5px;">No matches</div>';
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

/* ---------------- Logout ---------------- */
function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) { /* ignore network errors on logout */ }
    window.location.href = 'login.html';
  });
}

/* ---------------- Toast helper (same style as auth.js) ---------------- */
function showToast(message, type = 'info') {
  const bg = { success: 'linear-gradient(135deg,#10B981,#059669)', error: 'linear-gradient(135deg,#EF4444,#DC2626)', info: 'linear-gradient(135deg,#2563EB,#4F46E5)' };
  if (window.Toastify) {
    Toastify({ text: message, duration: 3500, gravity: 'top', position: 'right', style: { background: bg[type], borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '13.5px' } }).showToast();
  }
}

/* ---------------- Load dashboard data ---------------- */
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/users/dashboard`, { credentials: 'include' });
    if (!res.ok) throw new Error('unauthenticated');
    const { data } = await res.json();
    renderDashboard(data, true);
  } catch (err) {
    // Not logged in / backend not running yet — show a friendly placeholder version
    // instead of a blank/broken screen, and nudge toward login.
    renderDashboard(getFallbackData(), false);
    showToast("Showing preview data — log in to see your real progress.", 'info');
  }
}

function getFallbackData() {
  return {
    user: { name: 'Aspirant', avatarUrl: '', targetExam: 'NEET', xp: 0, coins: 0, level: 1, streakCount: 0, battleWins: 0, battleLosses: 0, rankTier: 'Pawn', nextRankTier: 'Bishop', percentToNextTier: 0 },
    todaysProgress: { questionsSolved: 0, questionsGoal: 20 },
    dailyQuiz: { completed: false, questionCount: 10, xpReward: 50, coinsReward: 20 },
    recentActivity: [],
    upcomingGoals: [
      { label: 'Finish your diagnostic quiz', done: false },
      { label: 'Reach a 7-day streak', done: false },
      { label: 'Win your first 1v1 battle', done: false },
    ],
    performanceTrend: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], accuracy: [0, 0, 0, 0, 0, 0, 0] },
    heatmap: Array.from({ length: 84 }, (_, i) => ({ dayIndex: i, level: 0 })),
    leaderboardPreview: { yourRank: null, top: [] },
    battleInvitations: [],
  };
}

function renderDashboard(data, isReal) {
  renderWelcome(data.user);
  renderStatCards(data.user);
  renderProgressRing(data.user, data.todaysProgress);
  renderDailyQuiz(data.dailyQuiz);
  renderChart(data.performanceTrend);
  renderHeatmap(data.heatmap);
  renderActivity(data.recentActivity);
  renderGoals(data.upcomingGoals);
  renderLeaderboardPreview(data.leaderboardPreview, data.user);
  renderBattleInvites(data.battleInvitations);
  renderAchievements(data.user);
  renderSidebarUser(data.user);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function renderWelcome(user) {
  const firstName = (user.name || 'Aspirant').split(' ')[0];
  document.getElementById('welcomeHeading').textContent = `Welcome back, ${firstName} 👋`;
  document.getElementById('welcomeSub').textContent =
    `${user.rankTier} tier · ${user.streakCount}-day streak · keep the momentum going for ${user.targetExam}.`;
}

function renderStatCards(user) {
  document.getElementById('statXp').textContent = (user.xp || 0).toLocaleString('en-IN');
  document.getElementById('statCoins').textContent = (user.coins || 0).toLocaleString('en-IN');
  document.getElementById('statStreak').textContent = user.streakCount || 0;
  document.getElementById('statBattles').textContent = `${user.battleWins || 0}-${user.battleLosses || 0}`;
}

function renderSidebarUser(user) {
  document.getElementById('sidebarAvatar').textContent = initials(user.name);
  document.getElementById('sidebarUserName').textContent = user.name || 'Aspirant';
  document.getElementById('sidebarUserTier').textContent = `${user.rankTier} tier`;
}

function renderProgressRing(user, todaysProgress) {
  const ring = document.getElementById('progressRing');
  const circumference = 2 * Math.PI * 45;
  const percent = Math.min(user.percentToNextTier || 0, 100);
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = String(circumference * (1 - percent / 100));
  });
  document.getElementById('progressRingLabel').textContent = `${percent}%`;
  document.getElementById('progressTier').textContent = user.rankTier;
  document.getElementById('progressNextTier').textContent = user.nextRankTier || 'Max tier reached';
  document.getElementById('progressQuestions').textContent =
    `${todaysProgress.questionsSolved || 0} / ${todaysProgress.questionsGoal || 20}`;
}

function renderDailyQuiz(dailyQuiz) {
  const btn = document.getElementById('quizCardBtn');
  const title = document.getElementById('quizCardTitle');
  const sub = document.getElementById('quizCardSub');
  if (dailyQuiz.completed) {
    title.textContent = "Today's quiz is done — nice work";
    sub.textContent = 'Come back tomorrow for a fresh set.';
    btn.textContent = 'View results';
  } else {
    title.textContent = `${dailyQuiz.questionCount} fresh questions, waiting`;
    sub.textContent = `Earn ${dailyQuiz.xpReward} XP + ${dailyQuiz.coinsReward} coins · resets every 24h`;
    btn.textContent = 'Start Quiz';
  }
}

function renderChart(trend) {
  const canvas = document.getElementById('performanceChart');
  if (!canvas || !window.Chart) return;

  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim() || '#2563EB';
  const muted = styles.getPropertyValue('--text-muted').trim() || '#5B6472';
  const border = styles.getPropertyValue('--border').trim() || '#E5E9F0';

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Accuracy %',
        data: trend.accuracy,
        borderColor: primary,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
          g.addColorStop(0, 'rgba(37,99,235,0.25)');
          g.addColorStop(1, 'rgba(37,99,235,0)');
          return g;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: primary,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { color: muted, stepSize: 25 }, grid: { color: border } },
        x: { ticks: { color: muted }, grid: { display: false } },
      },
    },
  });
}

function renderHeatmap(cells) {
  const grid = document.getElementById('heatmapGrid');
  grid.innerHTML = cells.map(c => `<div class="heatmap-cell" data-level="${c.level}" title="Level ${c.level}"></div>`).join('');
}

function renderActivity(items) {
  const feed = document.getElementById('activityFeed');
  if (!items || !items.length) {
    feed.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>No activity yet — solve a few questions to get started.</div>`;
    return;
  }
  const iconFor = { quiz: 'bi-lightning-charge-fill', battle: 'bi-controller', practice: 'bi-journal-text', info: 'bi-info-circle' };
  feed.innerHTML = items.map(item => `
    <div class="activity-item">
      <div class="ai-icon icon-blue"><i class="bi ${iconFor[item.type] || 'bi-dot'}"></i></div>
      <div><p>${item.text}</p>${item.timeAgo ? `<span>${item.timeAgo}</span>` : ''}</div>
    </div>`).join('');
}

function renderGoals(goals) {
  const list = document.getElementById('goalsList');
  list.innerHTML = (goals || []).map(g => `
    <div class="goal-item ${g.done ? 'done' : ''}">
      <div class="goal-check">${g.done ? '<i class="bi bi-check"></i>' : ''}</div>
      <span>${g.label}</span>
    </div>`).join('');
}

function renderLeaderboardPreview(preview, user) {
  const el = document.getElementById('leaderboardPreview');
  if (!preview.top || !preview.top.length) {
    el.innerHTML = `<div class="empty-state"><i class="bi bi-trophy"></i>Solve a few quizzes to appear on the leaderboard.</div>`;
    return;
  }
  el.innerHTML = preview.top.map((p, i) => `
    <div class="lb-preview-row">
      <span class="lb-rank">#${i + 1}</span>
      <div class="avatar-sm">${initials(p.name)}</div>
      <div><strong>${p.name}</strong><span>${p.rankTier}</span></div>
      <span class="lb-xp">${p.xp} XP</span>
    </div>`).join('');
}

function renderBattleInvites(invites) {
  const el = document.getElementById('battleInvitesList');
  if (!invites || !invites.length) {
    el.innerHTML = `<div class="empty-state"><i class="bi bi-controller"></i>No pending battle invites. Challenge a friend!</div>`;
    return;
  }
  el.innerHTML = invites.map(inv => `
    <div class="battle-invite-row">
      <div class="avatar-sm">${initials(inv.fromName)}</div>
      <div><strong>${inv.fromName}</strong><span>wants to battle</span></div>
      <div class="invite-actions">
        <button class="invite-accept"><i class="bi bi-check-lg"></i></button>
        <button class="invite-decline"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>`).join('');
}

function renderAchievements(user) {
  const grid = document.getElementById('achievementGrid');
  const unlocked = {
    streak7: user.streakCount >= 7,
    accuracy90: false,
    firstWin: user.battleWins > 0,
    chapterDone: false,
  };
  grid.innerHTML = ACHIEVEMENTS.map(a => `
    <div class="achievement-card ${unlocked[a.key] ? '' : 'locked'}">
      <div class="ac-badge">${a.badge}</div>
      <strong>${a.name}</strong>
      <span>${a.desc}</span>
    </div>`).join('');
}