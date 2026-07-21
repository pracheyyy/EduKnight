/* ==========================================================================
   EduKnight — Exams page (exam tabs -> subject grid)
   Depends on js/app-shell.js being loaded first (theme/sidebar/cmdk/logout).
   ========================================================================== */

let examData = null;
let activeExam = 'NEET';

document.addEventListener('DOMContentLoaded', loadExams);

async function loadExams() {
  try {
    const res = await fetch(`${API_BASE_URL}/exams`, { credentials: 'include' });
    if (!res.ok) throw new Error('Could not load exams.');
    const { data } = await res.json();
    examData = data;
    renderExamTabs();
    renderSubjects(activeExam);
  } catch (err) {
    document.getElementById('subjectGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-exclamation-triangle"></i>Could not load exams. Make sure you're logged in and the backend is running.</div>`;
    showToast('Could not load exam data.', 'error');
  }
}

function renderExamTabs() {
  const tabsEl = document.getElementById('examTabs');
  const exams = Object.keys(examData);
  tabsEl.innerHTML = exams.map(code => `<button class="exam-select-tab ${code === activeExam ? 'active' : ''}" data-exam="${code}">${examData[code].label}</button>`).join('');
  tabsEl.querySelectorAll('.exam-select-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeExam = btn.dataset.exam;
      tabsEl.querySelectorAll('.exam-select-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderSubjects(activeExam);
    });
  });
}

function renderSubjects(examCode) {
  const grid = document.getElementById('subjectGrid');
  const subjects = examData[examCode]?.subjects || [];

  if (!subjects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="bi bi-journal-x"></i>No subjects found. Run the backend seed script (node utils/seedContent.js).</div>`;
    return;
  }

  grid.innerHTML = subjects.map(s => `
    <div class="subject-tile" data-exam="${examCode}" data-subject="${s.code}">
      <span class="st-emoji">${s.emoji}</span>
      <h3>${s.name}</h3>
      <span class="st-meta">${s.chapterCount} chapters · ${s.totalQuestions} questions</span>
      <div class="bar"><i style="width:${s.progressPercent}%"></i></div>
      <span class="st-percent">${s.progressPercent}% complete</span>
    </div>`).join('');

  grid.querySelectorAll('.subject-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      window.location.href = `chapters.html?exam=${encodeURIComponent(tile.dataset.exam)}&subject=${encodeURIComponent(tile.dataset.subject)}`;
    });
  });
}