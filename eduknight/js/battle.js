/* ==========================================================================
   EduKnight — 1v1 Battle client
   Connects to the Socket.IO server (auth via the same httpOnly JWT cookie
   REST calls use) and drives the lobby -> waiting room -> countdown ->
   active battle -> winner screen state machine.
   Depends on js/app-shell.js.
   ========================================================================== */

const SOCKET_URL = 'http://localhost:5000';

let socket = null;
let myUserId = null;
let myName = 'You';
let currentRoomCode = null;
let battleQuestions = [];
let currentBattleIndex = 0;
let battleTimerInterval = null;
let battleTimeRemaining = 0;
let myAnswered = 0;
let oppAnswered = 0;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await loadSidebarUser();
  if (user) { myUserId = user.id; myName = user.name; }
  connectSocket();
  wireLobbyButtons();
});

function connectSocket() {
  socket = io(SOCKET_URL, { withCredentials: true });

  socket.on('connect_error', (err) => {
    showToast('Could not connect to the battle server. Make sure the backend is running.', 'error');
  });

  socket.on('battle:created', (room) => showWaitingRoom(room));
  socket.on('battle:room-update', (room) => showWaitingRoom(room));
  socket.on('battle:error', ({ message }) => showToast(message, 'error'));
  socket.on('battle:countdown', ({ seconds }) => runCountdown(seconds));
  socket.on('battle:start', ({ questions, timeLimitSeconds }) => startBattle(questions, timeLimitSeconds));
  socket.on('battle:score-update', ({ scores }) => updateLiveScores(scores));
  socket.on('battle:player-finished', ({ userId }) => {
    if (userId !== myUserId) showToast('Your opponent finished all questions!', 'info');
  });
  socket.on('battle:opponent-left', () => showToast('Your opponent left the room.', 'error'));
  socket.on('battle:finished', (result) => showWinnerScreen(result));
}

function wireLobbyButtons() {
  document.getElementById('createRoomBtn').addEventListener('click', () => {
    const examCode = document.getElementById('createExamSelect').value;
    socket.emit('battle:create', { examCode });
  });

  document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    if (code.length !== 6) return showToast('Enter the 6-character room code.', 'error');
    currentRoomCode = code;
    socket.emit('battle:join', { code });
  });

  document.getElementById('joinCodeInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

function showPanel(id) {
  ['battleLobby', 'battleWaitingRoom', 'battleCountdown', 'battleActive', 'battleWinnerScreen'].forEach(pid => {
    document.getElementById(pid).style.display = pid === id ? 'block' : 'none';
  });
}

function showWaitingRoom(room) {
  currentRoomCode = room.code;
  showPanel('battleWaitingRoom');
  document.getElementById('roomCodeText').textContent = room.code;

  const [p1, p2] = room.players;
  const slot1 = document.getElementById('slotPlayer1');
  const slot2 = document.getElementById('slotPlayer2');

  if (p1) {
    slot1.classList.remove('empty');
    slot1.querySelector('.vps-avatar').textContent = initials(p1.name);
    slot1.querySelector('h4').textContent = p1.name;
    const status1 = slot1.querySelector('.vps-status');
    status1.textContent = p1.ready ? 'Ready ✓' : 'Not ready';
    status1.classList.toggle('ready', p1.ready);
  }

  if (p2) {
    slot2.classList.remove('empty');
    slot2.querySelector('.vps-avatar').innerHTML = initials(p2.name);
    slot2.querySelector('h4').textContent = p2.name;
    const status2 = slot2.querySelector('.vps-status');
    status2.textContent = p2.ready ? 'Ready ✓' : 'Not ready';
    status2.classList.toggle('ready', p2.ready);
  } else {
    slot2.classList.add('empty');
    slot2.querySelector('.vps-avatar').innerHTML = '<i class="bi bi-person"></i>';
    slot2.querySelector('h4').textContent = 'Waiting for opponent';
    slot2.querySelector('.vps-status').textContent = 'Share the room code';
  }

  const readyBtn = document.getElementById('readyBtn');
  readyBtn.onclick = () => socket.emit('battle:ready', { code: currentRoomCode });
  readyBtn.disabled = !p2;
  readyBtn.innerHTML = !p2 ? 'Waiting for opponent…' : '<i class="bi bi-check-circle"></i> I\'m Ready';

  document.getElementById('copyCodeBtn').onclick = () => {
    navigator.clipboard.writeText(room.code);
    showToast('Room code copied!', 'success');
  };
}

function runCountdown(seconds) {
  showPanel('battleCountdown');
  let n = seconds;
  const numEl = document.getElementById('countdownNumber');
  numEl.textContent = n;
  const interval = setInterval(() => {
    n--;
    if (n <= 0) { clearInterval(interval); numEl.textContent = 'GO!'; return; }
    numEl.textContent = n;
    numEl.style.animation = 'none';
    void numEl.offsetWidth; // restart the CSS pulse animation each tick
    numEl.style.animation = '';
  }, 1000);
}

function startBattle(questions, timeLimitSeconds) {
  showPanel('battleActive');
  battleQuestions = questions;
  currentBattleIndex = 0;
  myAnswered = 0;
  oppAnswered = 0;
  battleTimeRemaining = timeLimitSeconds;

  document.getElementById('youAvatar').textContent = initials(myName);
  document.getElementById('youName').textContent = myName;
  document.getElementById('battleQTotal').textContent = questions.length;

  renderBattleQuestion();
  startBattleTimer();
}

function renderBattleQuestion() {
  const q = battleQuestions[currentBattleIndex];
  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('battleQNum').textContent = currentBattleIndex + 1;
  document.getElementById('battleProgressBar').style.width = `${Math.round((currentBattleIndex / battleQuestions.length) * 100)}%`;

  document.getElementById('battleQuestionContainer').innerHTML = `
    <div class="quiz-question-card">
      <div class="qq-text">${q.questionText}</div>
      <div class="qq-options" id="battleOptions">
        ${q.options.map((opt, i) => `<div class="qq-option" data-index="${i}"><span class="qq-letter">${letters[i]}</span><span>${opt}</span></div>`).join('')}
      </div>
    </div>`;

  document.querySelectorAll('#battleOptions .qq-option').forEach(opt => {
    opt.addEventListener('click', () => submitBattleAnswer(q.id, parseInt(opt.dataset.index, 10)));
  });
}

function submitBattleAnswer(questionId, selectedIndex) {
  document.querySelectorAll('#battleOptions .qq-option').forEach(el => el.style.pointerEvents = 'none');
  document.querySelector(`#battleOptions .qq-option[data-index="${selectedIndex}"]`)?.classList.add('selected');

  socket.emit('battle:answer', { code: currentRoomCode, questionId, selectedIndex });
  myAnswered++;
  document.getElementById('youProgress').textContent = `${myAnswered}/${battleQuestions.length}`;

  setTimeout(() => {
    if (currentBattleIndex < battleQuestions.length - 1) {
      currentBattleIndex++;
      renderBattleQuestion();
    } else {
      document.getElementById('battleQuestionContainer').innerHTML = `
        <div class="quiz-question-card" style="text-align:center;">
          <i class="bi bi-hourglass-split" style="font-size:28px;color:var(--text-muted);margin-bottom:12px;display:block;"></i>
          <p>Waiting for your opponent to finish...</p>
        </div>`;
    }
  }, 450);
}

function updateLiveScores(scores) {
  const opp = scores.find(s => s.userId !== myUserId);
  const me = scores.find(s => s.userId === myUserId);
  if (opp) {
    oppAnswered = opp.totalAnswered;
    document.getElementById('oppProgress').textContent = `${opp.totalAnswered}/${battleQuestions.length}`;
  }
  if (me) {
    document.getElementById('youProgress').textContent = `${me.totalAnswered}/${battleQuestions.length}`;
  }
}

function startBattleTimer() {
  updateBattleTimerDisplay();
  battleTimerInterval = setInterval(() => {
    battleTimeRemaining--;
    updateBattleTimerDisplay();
    if (battleTimeRemaining <= 0) clearInterval(battleTimerInterval);
  }, 1000);
}

function updateBattleTimerDisplay() {
  const el = document.getElementById('battleTimerText');
  const wrap = document.getElementById('battleTimer');
  if (!el) return;
  const m = Math.floor(battleTimeRemaining / 60).toString().padStart(2, '0');
  const s = (battleTimeRemaining % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
  wrap.classList.toggle('low-time', battleTimeRemaining <= 20);
}

function showWinnerScreen(result) {
  if (battleTimerInterval) clearInterval(battleTimerInterval);
  showPanel('battleWinnerScreen');

  const me = result.players.find(p => p.userId === myUserId);
  const opp = result.players.find(p => p.userId !== myUserId);
  const iWon = result.winnerId === myUserId;
  const isDraw = !result.winnerId;

  let headline = isDraw ? "It's a draw! 🤝" : iWon ? 'Victory! 👑' : 'Good fight! 🛡️';

  document.getElementById('battleWinnerScreen').innerHTML = `
    <div class="dcard winner-screen">
      <div class="winner-crown">${isDraw ? '🤝' : iWon ? '👑' : '⚔️'}</div>
      <h2>${headline}</h2>
      <p class="ws-sub">${result.reason === 'forfeit' ? 'Your opponent left the battle.' : 'Battle complete — results below.'}</p>

      <div class="ws-compare-row">
        <div class="ws-player-card ${iWon ? 'winner' : ''}">
          <div class="avatar-sm" style="margin:0 auto 10px;width:52px;height:52px;font-size:18px;">${initials(me?.name)}</div>
          <strong>${me?.name || 'You'}</strong>
          <div class="ws-score">${me?.correctCount ?? 0}/${me?.totalQuestions ?? 0}</div>
          <div class="ws-reward">+${me?.xpEarned ?? 0} XP · +${me?.coinsEarned ?? 0} coins</div>
        </div>
        <div class="ws-vs-divider">VS</div>
        <div class="ws-player-card ${!iWon && !isDraw ? 'winner' : ''}">
          <div class="avatar-sm" style="margin:0 auto 10px;width:52px;height:52px;font-size:18px;">${initials(opp?.name)}</div>
          <strong>${opp?.name || 'Opponent'}</strong>
          <div class="ws-score">${opp?.correctCount ?? 0}/${opp?.totalQuestions ?? 0}</div>
          <div class="ws-reward">+${opp?.xpEarned ?? 0} XP · +${opp?.coinsEarned ?? 0} coins</div>
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:center;">
        <a href="dashboard.html" class="btn btn-outline">Back to Dashboard</a>
        <button class="btn btn-primary" id="rematchBtn">Battle Again</button>
      </div>
    </div>`;

  document.getElementById('rematchBtn').addEventListener('click', () => {
    showPanel('battleLobby');
    document.getElementById('joinCodeInput').value = '';
  });

  if (iWon && window.confetti) {
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 }, colors: ['#2563EB', '#10B981', '#F59E0B'] });
  }
}
