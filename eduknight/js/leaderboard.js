/* ==========================================================================
   EduKnight — Leaderboard
   Depends on js/app-shell.js. Tabs (Global/Friends/Weekly/Monthly) each
   hit the same /api/leaderboard endpoint with a different ?scope=.
   ========================================================================== */

let activeScope = 'global';
let currentEntries = [];
let filterQuery = '';
let searchDebounce = null;

document.addEventListener('DOMContentLoaded', () => {
  initScopeTabs();
  initFilterInput();
  initFriendFinder();
  loadLeaderboard();
});

function initScopeTabs() {
  document.querySelectorAll('#scopeTabs .exam-select-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#scopeTabs .exam-select-tab').forEach(b => b.classList.toggle('active', b === btn));
      activeScope = btn.dataset.scope;
      loadLeaderboard();
    });
  });
}

function initFilterInput() {
  document.getElementById('lbFilterInput').addEventListener('input', (e) => {
    filterQuery = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadLeaderboard, 350);
  });
}

async function loadLeaderboard() {
  document.getElementById('rankList').innerHTML = `<div class="empty-state"><i class="bi bi-hourglass-split"></i>Loading rankings…</div>`;
  document.getElementById('podiumRow').innerHTML = '';
  document.getElementById('myRankCard').innerHTML = '';

  try {
    const qs = new URLSearchParams({ scope: activeScope });
    if (filterQuery) qs.set('search', filterQuery);
    const res = await fetch(`${API_BASE_URL}/leaderboard?${qs.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Could not load leaderboard.');
    const { data } = await res.json();
    currentEntries = data.entries;
    renderMyRank(data);
    renderPodium(data.entries);
    renderRankList(data.entries);
  } catch (err) {
    document.getElementById('rankList').innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>Could not load the leaderboard. Log in and try again.</div>`;
  }
}

function renderMyRank(data) {
  const card = document.getElementById('myRankCard');
  if (!data.myRank) {
    card.innerHTML = `<div class="lb-my-rank-card"><span>You're not ranked in this view yet — solve some questions to appear here.</span></div>`;
    return;
  }
  const label = { global: 'All-time XP', weekly: 'XP this week', monthly: 'XP this month', friends: 'Among your friends' }[data.scope];
  card.innerHTML = `
    <div class="lb-my-rank-card">
      <div class="lmr-rank">#${data.myRank}</div>
      <div class="avatar-sm">You</div>
      <div><strong>Your rank</strong><span>${label}</span></div>
      <div class="lmr-points">${(data.myPoints ?? 0).toLocaleString('en-IN')} pts</div>
    </div>`;
}

function renderPodium(entries) {
  const top3 = entries.slice(0, 3);
  const podium = document.getElementById('podiumRow');
  if (!top3.length) { podium.innerHTML = ''; return; }

  const classFor = ['first', 'second', 'third'];
  podium.innerHTML = top3.map((e, i) => `
    <div class="podium-card ${classFor[i]}">
      <span class="medal-emoji">${e.medal || ''}</span>
      <div class="avatar-sm">${initials(e.name)}</div>
      <strong>${e.name}</strong>
      <div class="podium-tier">${e.rankTier} tier</div>
      <div class="podium-points">${e.points.toLocaleString('en-IN')} pts</div>
    </div>`).join('');
}

function renderRankList(entries) {
  const list = document.getElementById('rankList');
  const rest = entries.slice(3);

  if (!entries.length) {
    list.innerHTML = `<div class="empty-state"><i class="bi bi-people"></i>No one here yet. ${activeScope === 'friends' ? 'Add some friends to compare progress.' : 'Be the first to earn XP!'}</div>`;
    return;
  }
  if (!rest.length) { list.innerHTML = ''; return; }

  list.innerHTML = rest.map(e => `
    <div class="lb-row">
      <div class="lb-rank-num">#${e.rank}</div>
      <div class="avatar-sm">${initials(e.name)}</div>
      <div class="lb-info"><strong>${e.name}</strong><span>${e.rankTier} tier · Level ${e.level}</span></div>
      <div class="lb-points">${e.points.toLocaleString('en-IN')}</div>
    </div>`).join('');
}

/* ---------------- Find Friends dropdown ---------------- */
function initFriendFinder() {
  const btn = document.getElementById('findFriendsBtn');
  const dropdown = document.getElementById('friendSearchResults');

  btn.addEventListener('click', () => {
    const isOpen = dropdown.classList.contains('open');
    if (isOpen) { dropdown.classList.remove('open'); return; }
    dropdown.classList.add('open');
    dropdown.innerHTML = `
      <div style="padding:12px;">
        <input type="text" id="friendSearchInput" placeholder="Search users by name..." style="width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-family:var(--font-body);font-size:13.5px;background:var(--bg);color:var(--text);outline:none;">
      </div>
      <div id="friendSearchList"></div>`;
    document.getElementById('friendSearchInput').focus();
    document.getElementById('friendSearchInput').addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      const q = e.target.value;
      searchDebounce = setTimeout(() => searchUsers(q), 300);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.friend-search-wrap')) dropdown.classList.remove('open');
  });
}

async function searchUsers(q) {
  const listEl = document.getElementById('friendSearchList');
  if (!listEl) return;
  if (q.trim().length < 2) { listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">Type at least 2 characters.</div>`; return; }

  try {
    const res = await fetch(`${API_BASE_URL}/leaderboard/search-users?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const { data } = await res.json();
    if (!data.length) { listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">No users found.</div>`; return; }

    listEl.innerHTML = data.map(u => `
      <div class="fsr-row">
        <div class="avatar-sm">${initials(u.name)}</div>
        <div style="flex:1;"><strong>${u.name}</strong><span>${u.rankTier} tier · ${u.xp} XP</span></div>
        <div class="add-friend-btn ${u.isFriend ? 'added' : ''}" data-user-id="${u.userId}" title="${u.isFriend ? 'Remove friend' : 'Add friend'}">
          <i class="bi ${u.isFriend ? 'bi-check-lg' : 'bi-plus-lg'}"></i>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.add-friend-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleFriend(btn.dataset.userId, btn));
    });
  } catch (err) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">Search failed.</div>`;
  }
}

async function toggleFriend(userId, btnEl) {
  const isAdded = btnEl.classList.contains('added');
  try {
    const res = await fetch(`${API_BASE_URL}/leaderboard/friends/${userId}`, {
      method: isAdded ? 'DELETE' : 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error();
    btnEl.classList.toggle('added', !isAdded);
    btnEl.querySelector('i').className = !isAdded ? 'bi bi-check-lg' : 'bi bi-plus-lg';
    showToast(!isAdded ? 'Friend added.' : 'Friend removed.', 'success');
    if (activeScope === 'friends') loadLeaderboard();
  } catch (err) {
    showToast('Could not update friends list.', 'error');
  }
}
