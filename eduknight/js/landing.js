/* ==========================================================================
   EduKnight — Landing Page JS
   Modules: nav scroll, theme toggle, mobile menu, animated counters,
   exam tabs, FAQ accordion, command palette, scroll-top FAB
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 700, once: true, offset: 60, easing: 'ease-out-cubic' });

  initNavScroll();
  initThemeToggle();
  initMobileMenu();
  initCounters();
  initRankRing();
  initExamTabs();
  initFaqAccordion();
  initCommandPalette();
  initScrollTopFab();
});

/* ---------------- Navbar scroll state ---------------- */
function initNavScroll() {
  const nav = document.getElementById('mainNav');
  const onScroll = () => {
    if (window.scrollY > 24) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------------- Theme toggle (persisted) ---------------- */
function initThemeToggle() {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    icon.innerHTML = theme === 'dark'
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    localStorage.setItem('eduknight-theme', theme);
  };

  const saved = localStorage.getItem('eduknight-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);

  toggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

/* ---------------- Mobile menu ---------------- */
function initMobileMenu() {
  const openBtn = document.getElementById('mobileToggle');
  const closeBtn = document.getElementById('mobileClose');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');

  const open = () => { menu.classList.add('open'); overlay.classList.add('open'); };
  const close = () => { menu.classList.remove('open'); overlay.classList.remove('open'); };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

/* ---------------- Animated counters (IntersectionObserver-driven) ---------------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseInt(el.getAttribute('data-counter'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('en-IN') + suffix;
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach(el => observer.observe(el));
}

/* ---------------- Hero rank ring fill ---------------- */
function initRankRing() {
  const ring = document.getElementById('rankRing');
  if (!ring) return;
  const circumference = 2 * Math.PI * 80;
  const percent = 0.78;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        ring.style.strokeDashoffset = String(circumference * (1 - percent));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  observer.observe(ring);
}

/* ---------------- Exam tabs ---------------- */
function initExamTabs() {
  const tabs = document.querySelectorAll('.exam-tab');
  const panels = document.querySelectorAll('.exam-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-exam');
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${target}`).classList.add('active');
    });
  });
}

/* ---------------- FAQ accordion ---------------- */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = 0;
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
}

/* ---------------- Command palette (Ctrl+K) ---------------- */
function initCommandPalette() {
  const palette = document.getElementById('cmdkPalette');
  const overlay = document.getElementById('cmdkOverlay');
  const input = document.getElementById('cmdkInput');
  const results = document.getElementById('cmdkResults');
  const hint = document.getElementById('cmdkHint');

  const routes = [
    { label: 'Dashboard', icon: 'bi-grid-1x2', href: 'dashboard.html' },
    { label: 'Profile', icon: 'bi-person-circle', href: 'profile.html' },
    { label: 'Exams', icon: 'bi-journal-bookmark', href: '#exams' },
    { label: 'Daily Quiz', icon: 'bi-lightning-charge', href: 'quiz.html' },
    { label: '1v1 Battle', icon: 'bi-controller', href: 'battle.html' },
    { label: 'Leaderboard', icon: 'bi-trophy', href: 'leaderboard.html' },
    { label: 'Resources', icon: 'bi-collection-play', href: '#resources' },
    { label: 'Settings', icon: 'bi-gear', href: 'settings.html' },
  ];

  const renderResults = (query = '') => {
    const filtered = routes.filter(r => r.label.toLowerCase().includes(query.toLowerCase()));
    results.innerHTML = filtered.map(r => `
      <a href="${r.href}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;color:var(--text);font-size:14px;font-weight:500;">
        <i class="bi ${r.icon}" style="color:var(--primary);"></i> ${r.label}
      </a>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13.5px;">No matches</div>';

    results.querySelectorAll('a').forEach(a => a.addEventListener('mouseenter', function() {
      results.querySelectorAll('a').forEach(x => x.style.background = 'transparent');
      this.style.background = 'rgba(37,99,235,0.08)';
    }));
    results.querySelectorAll('a').forEach(a => a.addEventListener('click', closePalette));
  };

  const openPalette = () => {
    palette.style.display = 'block';
    overlay.classList.add('open');
    input.value = '';
    renderResults();
    setTimeout(() => input.focus(), 50);
  };
  const closePalette = () => {
    palette.style.display = 'none';
    overlay.classList.remove('open');
  };

  hint?.addEventListener('click', openPalette);
  overlay.addEventListener('click', closePalette);
  input?.addEventListener('input', () => renderResults(input.value));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.style.display === 'block' ? closePalette() : openPalette();
    }
    if (e.key === 'Escape') closePalette();
  });
}

/* ---------------- Scroll-to-top FAB ---------------- */
function initScrollTopFab() {
  const fab = document.getElementById('scrollTopFab');
  const toggleFab = () => {
    fab.style.opacity = window.scrollY > 500 ? '1' : '0';
    fab.style.pointerEvents = window.scrollY > 500 ? 'auto' : 'none';
  };
  window.addEventListener('scroll', toggleFab, { passive: true });
  toggleFab();
  fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
