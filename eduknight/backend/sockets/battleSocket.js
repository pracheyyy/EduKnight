const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const User = require('../models/User');
const Question = require('../models/Question');
const Battle = require('../models/Battle');

/**
 * In-memory room state. Fine for a single Node process (this project's
 * scope) — a production deployment running multiple instances would need
 * a shared store (e.g. Redis + the socket.io-redis adapter) instead, since
 * rooms here only exist in this process's memory.
 *
 * rooms: Map<roomCode, {
 *   code, examCode, status: 'waiting'|'countdown'|'active'|'finished',
 *   players: [{ userId, socketId, name, ready, correctCount, totalAnswered,
 *               finished, finishedAtMs, answeredQuestionIds: Set }],
 *   questions: [full Question docs] | null,
 *   startedAt: number | null,
 *   timeLimitSeconds: number,
 *   timeoutHandle: NodeJS.Timeout | null,
 * }>
 */
const rooms = new Map();
const TIME_LIMIT_SECONDS = 90;
const QUESTIONS_PER_BATTLE = 5;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function publicRoomState(room) {
  return {
    code: room.code,
    examCode: room.examCode,
    status: room.status,
    players: room.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      ready: p.ready,
      correctCount: p.correctCount,
      totalAnswered: p.totalAnswered,
      finished: p.finished,
    })),
  };
}

function sanitizeQuestion(q) {
  return { id: q._id.toString(), questionText: q.questionText, options: q.options, difficulty: q.difficulty };
}

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return null;
}

function initBattleSocket(io) {
  // ---- Auth: verify the same JWT cookie used by the REST API ----
  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) return next(new Error('Not authenticated.'));
      const parsed = cookie.parse(rawCookie);
      const token = parsed.eduknight_token;
      if (!token) return next(new Error('Not authenticated.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Not authenticated.'));
    }
  });

  io.on('connection', async (socket) => {
    const user = await User.findById(socket.userId).select('name xp coins battleWins battleLosses targetExam');
    if (!user) {
      socket.disconnect();
      return;
    }
    socket.userData = { id: user._id.toString(), name: user.name, targetExam: user.targetExam };

    // ---- Create room ----
    socket.on('battle:create', ({ examCode } = {}) => {
      const code = generateRoomCode();
      const room = {
        code,
        examCode: examCode || socket.userData.targetExam || 'NEET',
        status: 'waiting',
        players: [{
          userId: socket.userData.id, socketId: socket.id, name: socket.userData.name,
          ready: false, correctCount: 0, totalAnswered: 0, finished: false, finishedAtMs: null,
          answeredQuestionIds: new Set(),
        }],
        questions: null,
        startedAt: null,
        timeLimitSeconds: TIME_LIMIT_SECONDS,
        timeoutHandle: null,
      };
      rooms.set(code, room);
      socket.join(code);
      socket.emit('battle:created', publicRoomState(room));
    });

    // ---- Join room ----
    socket.on('battle:join', ({ code } = {}) => {
      const room = rooms.get((code || '').toUpperCase());
      if (!room) return socket.emit('battle:error', { message: 'Room not found. Check the code and try again.' });
      if (room.status !== 'waiting') return socket.emit('battle:error', { message: 'This battle has already started.' });
      if (room.players.length >= 2) return socket.emit('battle:error', { message: 'This room is full.' });
      if (room.players.some((p) => p.userId === socket.userData.id)) return socket.emit('battle:error', { message: 'You are already in this room.' });

      room.players.push({
        userId: socket.userData.id, socketId: socket.id, name: socket.userData.name,
        ready: false, correctCount: 0, totalAnswered: 0, finished: false, finishedAtMs: null,
        answeredQuestionIds: new Set(),
      });
      socket.join(room.code);
      io.to(room.code).emit('battle:room-update', publicRoomState(room));
    });

    // ---- Ready up ----
    socket.on('battle:ready', ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;
      player.ready = true;
      io.to(room.code).emit('battle:room-update', publicRoomState(room));

      if (room.players.length === 2 && room.players.every((p) => p.ready) && room.status === 'waiting') {
        startCountdown(io, room);
      }
    });

    // ---- Submit an answer ----
    socket.on('battle:answer', async ({ code, questionId, selectedIndex } = {}) => {
      const room = rooms.get(code);
      if (!room || room.status !== 'active') return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.finished) return;
      if (player.answeredQuestionIds.has(questionId)) return; // no double-counting

      const question = room.questions.find((q) => q._id.toString() === questionId);
      if (!question) return;

      player.answeredQuestionIds.add(questionId);
      player.totalAnswered++;
      if (selectedIndex === question.correctOptionIndex) player.correctCount++;

      io.to(room.code).emit('battle:score-update', {
        scores: room.players.map((p) => ({ userId: p.userId, correctCount: p.correctCount, totalAnswered: p.totalAnswered })),
      });

      if (player.totalAnswered >= room.questions.length) {
        player.finished = true;
        player.finishedAtMs = Date.now();
        io.to(room.code).emit('battle:player-finished', { userId: player.userId });

        if (room.players.every((p) => p.finished)) {
          await finishBattle(io, room, 'completed');
        }
      }
    });

    // ---- Leave / disconnect ----
    socket.on('battle:leave', ({ code } = {}) => handleLeave(io, code, socket));
    socket.on('disconnect', () => {
      const room = findRoomBySocket(socket.id);
      if (room) handleLeave(io, room.code, socket);
    });
  });
}

function startCountdown(io, room) {
  room.status = 'countdown';
  io.to(room.code).emit('battle:countdown', { seconds: 3 });

  setTimeout(async () => {
    const chapters = require('../models/Chapter');
    const chapterDocs = await chapters.find({ examCode: room.examCode }).select('_id');
    const chapterIds = chapterDocs.map((c) => c._id);
    const pool = await Question.find({ chapter: { $in: chapterIds } });
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_BATTLE);

    if (!shuffled.length) {
      io.to(room.code).emit('battle:error', { message: 'No questions available for this exam yet. Run the seed script.' });
      rooms.delete(room.code);
      return;
    }

    room.questions = shuffled;
    room.status = 'active';
    room.startedAt = Date.now();

    io.to(room.code).emit('battle:start', {
      questions: shuffled.map(sanitizeQuestion),
      timeLimitSeconds: room.timeLimitSeconds,
    });

    room.timeoutHandle = setTimeout(() => finishBattle(io, room, 'timeout'), room.timeLimitSeconds * 1000);
  }, 3000);
}

async function finishBattle(io, room, reason) {
  if (room.status === 'finished') return; // guard against double-fire (timeout race + both-finished race)
  room.status = 'finished';
  if (room.timeoutHandle) clearTimeout(room.timeoutHandle);

  const [p1, p2] = room.players;
  const endedAt = Date.now();
  const timeSecondsFor = (p) => (p.finishedAtMs ? Math.round((p.finishedAtMs - room.startedAt) / 1000) : room.timeLimitSeconds);

  let winnerPlayer = null;
  if (p2) {
    if (p1.correctCount !== p2.correctCount) {
      winnerPlayer = p1.correctCount > p2.correctCount ? p1 : p2;
    } else {
      // Tiebreaker: whoever finished faster. If neither finished (timeout draw), it's a real draw.
      if (p1.finishedAtMs && p2.finishedAtMs) winnerPlayer = p1.finishedAtMs < p2.finishedAtMs ? p1 : p2;
    }
  }

  const rewardFor = (p) => {
    if (!p2) return { xp: 0, coins: 0 }; // opponent left before battle started — no game played
    if (!winnerPlayer) return { xp: 60, coins: 20 }; // draw
    return p.userId === winnerPlayer.userId ? { xp: 100, coins: 40 } : { xp: 30, coins: 10 };
  };

  const playerResults = [];
  for (const p of room.players) {
    const { xp, coins } = rewardFor(p);
    const user = await User.findById(p.userId);
    if (user) {
      user.xp += xp;
      user.coins += coins;
      if (winnerPlayer && p.userId === winnerPlayer.userId) user.battleWins += 1;
      else if (winnerPlayer) user.battleLosses += 1;
      await user.save();
    }
    playerResults.push({
      userId: p.userId, name: p.name, correctCount: p.correctCount, totalQuestions: room.questions.length,
      timeTakenSeconds: timeSecondsFor(p), xpEarned: xp, coinsEarned: coins,
    });
  }

  if (p2) {
    await Battle.create({
      roomCode: room.code,
      examCode: room.examCode,
      players: playerResults.map((r) => ({
        user: r.userId, name: r.name, correctCount: r.correctCount, totalQuestions: r.totalQuestions,
        timeTakenSeconds: r.timeTakenSeconds, xpEarned: r.xpEarned, coinsEarned: r.coinsEarned,
      })),
      winner: winnerPlayer ? winnerPlayer.userId : null,
      status: reason === 'forfeit' ? 'forfeited' : 'completed',
      startedAt: new Date(room.startedAt || endedAt),
      endedAt: new Date(endedAt),
    });
  }

  io.to(room.code).emit('battle:finished', {
    reason,
    winnerId: winnerPlayer ? winnerPlayer.userId : null,
    players: playerResults,
    correctAnswers: (room.questions || []).map((q) => ({ id: q._id.toString(), correctOptionIndex: q.correctOptionIndex, explanation: q.explanation })),
  });

  setTimeout(() => rooms.delete(room.code), 15000); // grace period in case a client reconnects/re-renders
}

function handleLeave(io, code, socket) {
  const room = rooms.get(code);
  if (!room) return;

  const leavingPlayer = room.players.find((p) => p.socketId === socket.id);
  socket.leave(code);

  if (room.status === 'active' || room.status === 'countdown') {
    // Mid-battle disconnect = forfeit; opponent wins by default if present.
    const remaining = room.players.filter((p) => p.socketId !== socket.id);
    if (remaining.length > 0 && leavingPlayer) {
      remaining[0].finished = true;
      remaining[0].finishedAtMs = remaining[0].finishedAtMs || Date.now();
      finishBattle(io, room, 'forfeit');
      return;
    }
  }

  room.players = room.players.filter((p) => p.socketId !== socket.id);
  if (room.players.length === 0) {
    if (room.timeoutHandle) clearTimeout(room.timeoutHandle);
    rooms.delete(code);
  } else {
    io.to(code).emit('battle:room-update', publicRoomState(room));
    io.to(code).emit('battle:opponent-left', {});
  }
}

module.exports = initBattleSocket;
