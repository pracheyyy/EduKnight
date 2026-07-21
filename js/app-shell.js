/* ==========================================================================
   EduKnight — Shared app shell behaviors
   Theme toggle, mobile sidebar, command palette, logout, toast helper.
   Used by every logged-in page from Module 5 onward. (Dashboard/Profile
   from Modules 3-4 still carry their own copies — not worth a risky
   refactor of shipped pages just to dedupe.)
   ========================================================================== */

const API_BASE_URL = 'http://localhost:5000/api';

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
  if (!palette) return;

  const routes = [
    { label: 'Dashboard', icon: 'bi-grid-1x2', href: 'dashboard.html' },
    { label: 'Profile', icon: 'bi-person-circle', href: 'profile.html' },
    { label: 'Exams', icon: 'bi-journal-bookmark', href: 'exams.html' },
    { label: 'Daily Quiz', icon: 'bi-lightning-charge', href: 'quiz.html?mode=daily' },
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
  overlay?.addEventListener('click', closePalette);
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

async function loadSidebarUser() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
    if (!res.ok) throw new Error('unauthenticated');
    const result = await res.json();
    const user = result.user;
    document.getElementById('sidebarAvatar').textContent = initials(user.name);
    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarUserTier').textContent = `${user.rankTier || 'Pawn'} tier`;
    return user;
  } catch (err) {
    document.getElementById('sidebarUserName').textContent = 'Guest';
    document.getElementById('sidebarUserTier').textContent = 'Not logged in';
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSidebarMobile();
  initCommandPalette();
  initLogout();
  loadSidebarUser();
});