/* ==========================================================================
   EduKnight — Universal Quiz Runner
   Powers Practice, Timed Test, PYQ, Mock Test (Module 5) AND Daily Quiz
   (Module 6) from one engine, driven by ?mode= in the URL.
   Depends on js/app-shell.js.
   ========================================================================== */

const qParams = new URLSearchParams(window.location.search);
const MODE = qParams.get('mode') || 'daily';
const EXAM_CODE = qParams.get('exam');
const SUBJECT_CODE = qParams.get('subject');
const CHAPTER_ID = qParams.get('chapterId');
const TEST_ID = qParams.get('testId');

let session = null;       // { title, questions, timeLimitSeconds, sessionMeta, xpReward, coinsReward }
let currentIndex = 0;
let userAnswers = {};     // questionId -> selectedIndex
let dailyRevealed = {};   // questionId -> true once instantly revealed (daily mode only)
let timeRemaining = null;
let timerInterval = null;
let startedAt = null;

document.addEventListener('DOMContentLoaded', loadSession);

async function loadSession() {
  try {
    let res;
    if (MODE === 'daily') {
      res = await fetch(`${API_BASE_URL}/quiz/daily`, { credentials: 'include' });
    } else {
      const qs = new URLSearchParams({ mode: MODE, examCode: EXAM_CODE || '', subjectCode: SUBJECT_CODE || '' });
      if (CHAPTER_ID) qs.set('chapterId', CHAPTER_ID);
      if (TEST_ID) qs.set('testId', TEST_ID);
      res = await fetch(`${API_BASE_URL}/quiz/session?${qs.toString()}`, { credentials: 'include' });
    }
    if (!res.ok) throw new Error('Could not load quiz.');
    const { data } = await res.json();

    if (MODE === 'daily' && data.completed) {
      renderAlreadyCompleted(data.result);
      return;
    }
    if (!data.questions || !data.questions.length) {
      renderEmptyState();
      return;
    }

    session = data;
    session.sessionMeta = session.sessionMeta || { mode: MODE, examCode: EXAM_CODE, subjectCode: SUBJECT_CODE, chapterId: CHAPTER_ID, testId: TEST_ID };
    timeRemaining = session.timeLimitSeconds;
    startedAt = Date.now();

    renderQuizShell();
    renderQuestion();
    if (timeRemaining) startTimer();
  } catch (err) {
    document.getElementById('quizRunnerShell').innerHTML =
      `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Could not load this quiz. Make sure you're logged in and the backend has been seeded.</div>`;
  }
}

function renderEmptyState() {
  document.getElementById('quizRunnerShell').innerHTML = `
    <div class="empty-state">
      <i class="bi bi-journal-x"></i>
      No questions available for this selection yet. Run the backend seed script (node utils/seedContent.js) to populate demo content.
    </div>`;
}

function renderAlreadyCompleted(result) {
  document.getElementById('quizRunnerShell').innerHTML = `
    <div class="quiz-question-card quiz-results-card">
      <h2>You've already done today's quiz 🎉</h2>
      <p>Score: <strong>${result.correctCount}/${result.totalQuestions}</strong> (${result.accuracy}% accuracy) · +${result.xpEarned} XP · +${result.coinsEarned} coins</p>
      <a href="dashboard.html" class="btn btn-primary">Back to Dashboard</a>
    </div>`;
}

function renderQuizShell() {
  document.getElementById('quizRunnerShell').innerHTML = `
    <div class="quiz-runner-topbar">
      <span class="qr-title">${session.title || 'Quiz'}</span>
      ${session.timeLimitSeconds ? `<div class="quiz-timer" id="quizTimer"><i class="bi bi-stopwatch"></i> <span id="timerText">--:--</span></div>` : ''}
    </div>
    <div class="quiz-progress-bar"><i id="quizProgressBar" style="width:0%"></i></div>
    <div id="questionContainer"></div>
    <div class="quiz-nav-row">
      <button class="btn btn-outline" id="prevBtn"><i class="bi bi-arrow-left"></i> Previous</button>
      <button class="btn btn-primary" id="nextBtn">Next <i class="bi bi-arrow-right"></i></button>
    </div>
  `;
  document.getElementById('prevBtn').addEventListener('click', () => goTo(currentIndex - 1));
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentIndex === session.questions.length - 1) submitQuiz();
    else goTo(currentIndex + 1);
  });
}

function goTo(index) {
  if (index < 0 || index >= session.questions.length) return;
  currentIndex = index;
  renderQuestion();
}

function renderQuestion() {
  const q = session.questions[currentIndex];
  const total = session.questions.length;
  const letters = ['A', 'B', 'C', 'D'];
  const selected = userAnswers[q.id];
  const revealed = MODE === 'daily' && dailyRevealed[q.id];

  document.getElementById('quizProgressBar').style.width = `${Math.round(((currentIndex) / total) * 100)}%`;

  document.getElementById('questionContainer').innerHTML = `
    <div class="quiz-question-card">
      <div class="qq-meta">
        <span class="qq-num">Question ${currentIndex + 1} of ${total}</span>
        ${q.difficulty ? `<span class="diff-badge diff-${q.difficulty}">${q.difficulty}</span>` : ''}
      </div>
      <div class="qq-text">${q.questionText}</div>
      <div class="qq-options" id="qqOptions">
        ${q.options.map((opt, i) => {
          let cls = selected === i ? 'selected' : '';
          if (revealed) {
            if (i === q.correctOptionIndex) cls = 'correct';
            else if (i === selected && selected !== q.correctOptionIndex) cls = 'incorrect';
          }
          return `<div class="qq-option ${cls}" data-index="${i}"><span class="qq-letter">${letters[i]}</span><span>${opt}</span></div>`;
        }).join('')}
      </div>
      ${revealed && q.explanation ? `<div style="margin-top:18px;padding:14px 16px;background:var(--bg);border-radius:var(--radius-sm);font-size:13px;color:var(--text-muted);"><strong style="color:var(--text);">Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>`;

  if (!revealed) {
    document.querySelectorAll('#qqOptions .qq-option').forEach(opt => {
      opt.addEventListener('click', () => selectOption(q, parseInt(opt.dataset.index, 10)));
    });
  }

  document.getElementById('prevBtn').disabled = currentIndex === 0;
  document.getElementById('nextBtn').innerHTML = currentIndex === total - 1
    ? '<i class="bi bi-check-lg"></i> Submit Quiz'
    : 'Next <i class="bi bi-arrow-right"></i>';
}

function selectOption(question, index) {
  userAnswers[question.id] = index;

  if (MODE === 'daily') {
    // Instant feedback for the daily quiz specifically (per brief).
    dailyRevealed[question.id] = true;
  }
  renderQuestion();
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timerText');
  const wrap = document.getElementById('quizTimer');
  if (!el) return;
  const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
  const s = (timeRemaining % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
  wrap.classList.toggle('low-time', timeRemaining <= 30);
}

async function submitQuiz() {
  if (timerInterval) clearInterval(timerInterval);

  const answers = session.questions.map(q => ({ questionId: q.id, selectedIndex: userAnswers[q.id] ?? null }));
  const timeTakenSeconds = Math.round((Date.now() - startedAt) / 1000);

  document.getElementById('quizRunnerShell').innerHTML = `<div class="empty-state"><i class="bi bi-hourglass-split"></i>Grading your quiz…</div>`;

  try {
    const res = await fetch(`${API_BASE_URL}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mode: MODE,
        examCode: session.sessionMeta.examCode,
        subjectCode: session.sessionMeta.subjectCode,
        chapterId: session.sessionMeta.chapterId,
        testId: session.sessionMeta.testId,
        answers,
        timeTakenSeconds,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Could not submit quiz.');
    renderResults(result.data);
  } catch (err) {
    showToast(err.message || 'Could not submit your quiz.', 'error');
    document.getElementById('quizRunnerShell').innerHTML =
      `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>${err.message || 'Something went wrong submitting your quiz.'}</div>`;
  }
}

function renderResults(result) {
  const circumference = 2 * Math.PI * 70;
  const percent = result.accuracy;

  document.getElementById('quizRunnerShell').innerHTML = `
    <div class="quiz-question-card quiz-results-card">
      <div class="qr-score-ring">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <defs><linearGradient id="resultsRingGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#10B981"/></linearGradient></defs>
          <circle class="qrs-bg" cx="80" cy="80" r="70"></circle>
          <circle class="qrs-fg" id="resultsRing" cx="80" cy="80" r="70"></circle>
        </svg>
        <div class="qrs-center"><strong>${percent}%</strong><span>accuracy</span></div>
      </div>
      <h2>${percent >= 70 ? 'Great work! 🎉' : percent >= 40 ? 'Solid effort 💪' : "Keep practicing 📚"}</h2>
      <p>You got <strong>${result.correctCount} / ${result.totalQuestions}</strong> correct.</p>
      <div class="qr-reward-row">
        <div class="qr-reward-chip"><i class="bi bi-star-fill" style="color:var(--primary);"></i> +${result.xpEarned} XP</div>
        <div class="qr-reward-chip"><i class="bi bi-coin" style="color:var(--accent);"></i> +${result.coinsEarned} coins</div>
        ${result.newStreak ? `<div class="qr-reward-chip"><i class="bi bi-fire" style="color:var(--warning);"></i> ${result.newStreak}-day streak</div>` : ''}
      </div>
      <div style="display:flex; gap:10px; justify-content:center; margin-bottom:8px;">
        <a href="dashboard.html" class="btn btn-outline">Back to Dashboard</a>
        <button class="btn btn-primary" id="reviewToggleBtn">Review Answers</button>
      </div>
      <div class="qr-review-list" id="qrReviewList" style="display:none;"></div>
    </div>`;

  requestAnimationFrame(() => {
    document.getElementById('resultsRing').style.strokeDashoffset = String(circumference * (1 - percent / 100));
  });

  document.getElementById('reviewToggleBtn').addEventListener('click', () => {
    const list = document.getElementById('qrReviewList');
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    if (isHidden && !list.dataset.rendered) {
      renderReview(result.review);
      list.dataset.rendered = 'true';
    }
  });

  if (MODE === 'daily' && percent >= 60 && window.confetti) {
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.4 }, colors: ['#2563EB', '#4F46E5', '#10B981'] });
  }
}

function renderReview(review) {
  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('qrReviewList').innerHTML = review.map((q, i) => `
    <div class="quiz-question-card" style="padding:22px;">
      <div class="qq-meta"><span class="qq-num">Question ${i + 1}</span></div>
      <div class="qq-text" style="font-size:15px;">${q.questionText}</div>
      <div class="qq-options">
        ${q.options.map((opt, idx) => {
          let cls = '';
          if (idx === q.correctOptionIndex) cls = 'correct';
          else if (idx === q.selectedIndex) cls = 'incorrect';
          return `<div class="qq-option ${cls}"><span class="qq-letter">${letters[idx]}</span><span>${opt}</span></div>`;
        }).join('')}
      </div>
      ${q.explanation ? `<div style="margin-top:14px;padding:12px 14px;background:var(--bg);border-radius:var(--radius-sm);font-size:12.5px;color:var(--text-muted);"><strong style="color:var(--text);">Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>`).join('');
}