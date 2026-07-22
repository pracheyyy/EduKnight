/* ==========================================================================
   EduKnight — Resources page
   Category cards + search + exam/subject filters + bookmarks + pagination.
   Depends on js/app-shell.js.
   ========================================================================== */

let activeType = 'all';
let activeExam = '';
let activeSubject = '';
let searchQuery = '';
let bookmarkedOnly = false;
let currentPage = 1;
let searchDebounce = null;
let examStructureCache = null;

const SUBJECTS_BY_EXAM = {
  NEET: [{ code: 'physics', name: 'Physics' }, { code: 'chemistry', name: 'Chemistry' }, { code: 'botany', name: 'Botany' }, { code: 'zoology', name: 'Zoology' }],
  JEE: [{ code: 'physics', name: 'Physics' }, { code: 'chemistry', name: 'Chemistry' }, { code: 'mathematics', name: 'Mathematics' }],
  'MHT-CET': [{ code: 'physics', name: 'Physics' }, { code: 'chemistry', name: 'Chemistry' }, { code: 'mathematics', name: 'Mathematics' }, { code: 'biology', name: 'Biology' }],
};

document.addEventListener('DOMContentLoaded', () => {
  initToolbar();
  loadResources();
});

function initToolbar() {
  document.getElementById('resSearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadResources, 350);
  });

  document.getElementById('resExamSelect').addEventListener('change', (e) => {
    activeExam = e.target.value;
    activeSubject = '';
    populateSubjectDropdown();
    currentPage = 1;
    loadResources();
  });

  document.getElementById('resSubjectSelect').addEventListener('change', (e) => {
    activeSubject = e.target.value;
    currentPage = 1;
    loadResources();
  });

  document.getElementById('bookmarkedOnlyBtn').addEventListener('click', (e) => {
    bookmarkedOnly = !bookmarkedOnly;
    e.currentTarget.classList.toggle('active', bookmarkedOnly);
    currentPage = 1;
    loadResources();
  });
}

function populateSubjectDropdown() {
  const select = document.getElementById('resSubjectSelect');
  const subjects = SUBJECTS_BY_EXAM[activeExam] || [];
  select.innerHTML = `<option value="">All Subjects</option>` + subjects.map(s => `<option value="${s.code}">${s.name}</option>`).join('');
}

async function loadResources() {
  const grid = document.getElementById('resourceGrid');
  grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-hourglass-split"></i>Loading resources…</div>`;

  try {
    const qs = new URLSearchParams({ page: currentPage });
    if (activeType !== 'all') qs.set('type', activeType);
    if (activeExam) qs.set('exam', activeExam);
    if (activeSubject) qs.set('subject', activeSubject);
    if (searchQuery) qs.set('search', searchQuery);
    if (bookmarkedOnly) qs.set('bookmarked', 'true');

    const res = await fetch(`${API_BASE_URL}/resources?${qs.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Could not load resources.');
    const { data } = await res.json();

    renderCategoryGrid(data.categories);
    renderResourceGrid(data.resources);
    renderPagination(data.pagination);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-exclamation-triangle"></i>Could not load resources. Log in and make sure the backend has been seeded (node utils/seedResources.js).</div>`;
  }
}

function renderCategoryGrid(categories) {
  const grid = document.getElementById('categoryGrid');
  const allCard = `
    <div class="res-category-card ${activeType === 'all' ? 'active' : ''}" data-type="all">
      <span class="rcc-icon">🗂️</span><h4>All Resources</h4><span>${categories.reduce((s, c) => s + c.count, 0)} items</span>
    </div>`;
  const cards = categories.map(c => `
    <div class="res-category-card ${activeType === c.type ? 'active' : ''}" data-type="${c.type}">
      <span class="rcc-icon">${c.emoji}</span><h4>${c.label}</h4><span>${c.count} items</span>
    </div>`).join('');

  grid.innerHTML = allCard + cards;
  grid.querySelectorAll('.res-category-card').forEach(card => {
    card.addEventListener('click', () => {
      activeType = card.dataset.type;
      currentPage = 1;
      loadResources();
    });
  });
}

function renderResourceGrid(resources) {
  const grid = document.getElementById('resourceGrid');
  if (!resources.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-collection"></i>No resources match your filters.</div>`;
    return;
  }

  grid.innerHTML = resources.map(r => `
    <div class="res-card">
      <div class="rc-thumb">
        ${r.thumbnailEmoji}
        <div class="rc-bookmark ${r.bookmarked ? 'active' : ''}" data-id="${r.id}" title="Bookmark">
          <i class="bi ${r.bookmarked ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>
        </div>
      </div>
      <div class="rc-body">
        <span class="rc-type-tag rc-type-${r.type}">${r.type.replace('-', ' ')}</span>
        <h4>${r.title}</h4>
        <p>${r.description}</p>
        <div class="rc-footer">
          <span>${r.source || r.examCode}</span>
          <a href="${r.url}" target="_blank" rel="noopener">Open <i class="bi bi-box-arrow-up-right"></i></a>
        </div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.rc-bookmark').forEach(btn => {
    btn.addEventListener('click', () => toggleBookmark(btn.dataset.id, btn));
  });
}

async function toggleBookmark(resourceId, btnEl) {
  try {
    const res = await fetch(`${API_BASE_URL}/resources/${resourceId}/bookmark`, { method: 'PATCH', credentials: 'include' });
    if (!res.ok) throw new Error();
    const { data } = await res.json();
    btnEl.classList.toggle('active', data.bookmarked);
    btnEl.querySelector('i').className = data.bookmarked ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
    showToast(data.bookmarked ? 'Resource bookmarked.' : 'Bookmark removed.', 'success');
    if (bookmarkedOnly && !data.bookmarked) loadResources(); // remove it from view immediately in the Bookmarked filter
  } catch (err) {
    showToast('Could not update bookmark. Are you logged in?', 'error');
  }
}

function renderPagination({ page, totalPages }) {
  const el = document.getElementById('resPagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let buttons = `<button class="res-page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}"><i class="bi bi-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      buttons += `<button class="res-page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (Math.abs(i - page) === 2) {
      buttons += `<span style="color:var(--text-muted);padding:0 4px;">…</span>`;
    }
  }
  buttons += `<button class="res-page-btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}"><i class="bi bi-chevron-right"></i></button>`;

  el.innerHTML = buttons;
  el.querySelectorAll('.res-page-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page, 10);
      loadResources();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
