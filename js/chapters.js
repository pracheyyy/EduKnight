/* ==========================================================================
   EduKnight — Chapters page (chapter list, PYQ, mock tests)
   Depends on js/app-shell.js. Reads ?exam=NEET&subject=physics from URL.
   ========================================================================== */

const params = new URLSearchParams(window.location.search);
const EXAM_CODE = params.get('exam') || 'NEET';
const SUBJECT_CODE = params.get('subject') || 'physics';

let allChapters = [];
let activeDifficulty = 'all';
let bookmarkedOnly = false;
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  initSubTabs();
  initToolbar();
  loadChapters();
  loadMockTests();
});

function initSubTabs() {
  const tabs = document.querySelectorAll('.subject-subtab');
  const panels = document.querySelectorAll('.subject-subpanel');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${tab.dataset.tab}`));
  }));
}

function initToolbar() {
  document.getElementById('chapterSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderChapters();
  });

  document.querySelectorAll('#difficultyFilters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#difficultyFilters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDifficulty = btn.dataset.diff;
      renderChapters();
    });
  });

  document.getElementById('bookmarkFilterBtn').addEventListener('click', (e) => {
    bookmarkedOnly = !bookmarkedOnly;
    e.currentTarget.classList.toggle('active', bookmarkedOnly);
    renderChapters();
  });
}

async function loadChapters() {
  try {
    const res = await fetch(`${API_BASE_URL}/exams/${EXAM_CODE}/${SUBJECT_CODE}/chapters`, { credentials: 'include' });
    if (!res.ok) throw new Error('Could not load chapters.');
    const { data } = await res.json();
    allChapters = data;

    const subjectName = SUBJECT_CODE.charAt(0).toUpperCase() + SUBJECT_CODE.slice(1);
    document.getElementById('pageTitle').textContent = `${EXAM_CODE} — ${subjectName}`;
    document.title = `${subjectName} — EduKnight`;

    renderChapters();
    renderPyqList();
  } catch (err) {
    document.getElementById('chaptersList').innerHTML =
      `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Could not load chapters. Log in and make sure the backend has been seeded (node utils/seedContent.js).</div>`;
    showToast('Could not load chapters.', 'error');
  }
}

function renderChapters() {
  const list = document.getElementById('chaptersList');
  let filtered = allChapters.filter(ch => ch.name.toLowerCase().includes(searchQuery));
  if (bookmarkedOnly) filtered = filtered.filter(ch => ch.bookmarked);
  // Difficulty filter is chapter-level here (has questions of that difficulty) —
  // fine-grained per-question difficulty filtering happens inside Practice mode itself.
  if (activeDifficulty !== 'all') {
    filtered = filtered.filter(ch => (ch.difficultyBreakdown?.[activeDifficulty] || 0) > 0);
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><i class="bi bi-journal-x"></i>No chapters match your filters.</div>`;
    return;
  }

  list.innerHTML = filtered.map((ch, i) => `
    <div class="chapter-row" data-chapter-id="${ch.id}">
      <div class="cr-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="cr-info">
        <h4>${ch.name}</h4>
        <div class="cr-meta">
          <span>${ch.totalQuestions} questions</span>
          <span class="diff-badge diff-easy">${ch.difficultyBreakdown?.easy || 0} Easy</span>
          <span class="diff-badge diff-medium">${ch.difficultyBreakdown?.medium || 0} Med</span>
          <span class="diff-badge diff-hard">${ch.difficultyBreakdown?.hard || 0} Hard</span>
        </div>
      </div>
      <div class="cr-progress">
        <div class="bar"><i style="width:${ch.progressPercent}%"></i></div>
        <span>${ch.progressPercent}% · ${ch.questionsAttempted} attempted</span>
      </div>
      <div class="cr-actions">
        <div class="bookmark-btn ${ch.bookmarked ? 'active' : ''}" data-chapter-id="${ch.id}" title="Bookmark"><i class="bi ${ch.bookmarked ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i></div>
        <a href="quiz.html?mode=practice&exam=${EXAM_CODE}&subject=${SUBJECT_CODE}&chapterId=${ch.id}" class="btn btn-outline btn-sm">Practice</a>
        <a href="quiz.html?mode=timed&exam=${EXAM_CODE}&subject=${SUBJECT_CODE}&chapterId=${ch.id}" class="btn btn-primary btn-sm">Timed Test</a>
      </div>
    </div>`).join('');

  list.querySelectorAll('.bookmark-btn').forEach(btn => btn.addEventListener('click', () => toggleBookmark(btn.dataset.chapterId, btn)));
}

async function toggleBookmark(chapterId, btnEl) {
  try {
    const res = await fetch(`${API_BASE_URL}/exams/chapters/${chapterId}/bookmark`, { method: 'PATCH', credentials: 'include' });
    if (!res.ok) throw new Error('Failed');
    const { data } = await res.json();
    btnEl.classList.toggle('active', data.bookmarked);
    btnEl.querySelector('i').className = data.bookmarked ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
    const ch = allChapters.find(c => c.id === chapterId);
    if (ch) ch.bookmarked = data.bookmarked;
    showToast(data.bookmarked ? 'Chapter bookmarked.' : 'Bookmark removed.', 'success');
  } catch (err) {
    showToast('Could not update bookmark. Are you logged in?', 'error');
  }
}

function renderPyqList() {
  const el = document.getElementById('pyqChapterList');
  el.innerHTML = allChapters.map(ch => `
    <div class="chapter-row">
      <div class="cr-info"><h4>${ch.name}</h4><div class="cr-meta"><span>${ch.totalQuestions} total questions</span></div></div>
      <div class="cr-actions">
        <a href="quiz.html?mode=pyq&exam=${EXAM_CODE}&subject=${SUBJECT_CODE}&chapterId=${ch.id}" class="btn btn-primary btn-sm"><i class="bi bi-clock-history"></i> Practice PYQs</a>
      </div>
    </div>`).join('');
}

async function loadMockTests() {
  try {
    const res = await fetch(`${API_BASE_URL}/exams/${EXAM_CODE}/${SUBJECT_CODE}/mock-tests`, { credentials: 'include' });
    if (!res.ok) throw new Error('Could not load mock tests.');
    const { data } = await res.json();
    const list = document.getElementById('mockTestsList');

    if (!data.length) {
      list.innerHTML = `<div class="empty-state"><i class="bi bi-clipboard-x"></i>No mock tests available for this subject yet.</div>`;
      return;
    }

    list.innerHTML = data.map(test => `
      <div class="mock-test-card">
        <div class="mt-icon"><i class="bi bi-clipboard-check"></i></div>
        <div class="mt-info">
          <h4>${test.title}</h4>
          <span>${test.questionCount} questions · ${test.durationMinutes} min · covers ${test.chapterNames.join(', ')}</span>
        </div>
        <a href="quiz.html?mode=mock&exam=${EXAM_CODE}&subject=${SUBJECT_CODE}&testId=${encodeURIComponent(test.id)}" class="btn btn-primary btn-sm">Start Test</a>
      </div>`).join('');
  } catch (err) {
    document.getElementById('mockTestsList').innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Could not load mock tests.</div>`;
  }
}