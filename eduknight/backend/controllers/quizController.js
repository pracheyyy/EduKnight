const asyncHandler = require('../middleware/asyncHandler');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const ChapterProgress = require('../models/ChapterProgress');
const QuizAttempt = require('../models/QuizAttempt');
const QuizSettings = require('../models/QuizSettings');
const User = require('../models/User');
const { EXAM_STRUCTURE } = require('../config/examStructure');

function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', server-local UTC day
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Strip answer-revealing fields before sending questions to the client. */
function sanitizeQuestion(q) {
  return {
    id: q._id,
    questionText: q.questionText,
    options: q.options,
    difficulty: q.difficulty,
    isPYQ: q.isPYQ,
    pyqYear: q.pyqYear,
  };
}

/**
 * GET /api/quiz/session
 * Query params: mode=practice|timed|pyq|mock, examCode, subjectCode,
 * chapterId (practice/timed/pyq), testId (mock), difficulty (practice only)
 * Builds a question set + session metadata for the universal quiz runner.
 */
const getQuizSession = asyncHandler(async (req, res) => {
  const { mode, examCode, subjectCode, chapterId, difficulty, testId } = req.query;

  if (!['practice', 'timed', 'pyq', 'mock'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid quiz mode.' });
  }

  let questionFilter = {};
  let sessionMeta = { mode, examCode, subjectCode: subjectCode || null, chapterId: chapterId || null };
  let timeLimitSeconds = null;
  let chapterNameForTitle = '';

  if (mode === 'mock') {
    // Mock tests span the chapters encoded in testId's on-the-fly definition
    // (see getMockTests) — the client re-requests the same subject's
    // chapters here since we don't persist a MockTest document.
    const chapters = await Chapter.find({ examCode, subjectCode }).sort({ order: 1 });
    if (!chapters.length) return res.json({ success: true, data: { questions: [], sessionMeta, timeLimitSeconds: 1800 } });
    const parts = (testId || '').split('-mock-');
    const testIndex = parseInt(parts[1], 10) - 1 || 0;
    const slice = chapters.slice(testIndex * 3, testIndex * 3 + 3);
    const chapterIds = (slice.length ? slice : chapters).map((c) => c._id);
    questionFilter = { chapter: { $in: chapterIds } };
    timeLimitSeconds = 30 * 60;
    sessionMeta.testId = testId;
  } else {
    if (!chapterId) return res.status(400).json({ success: false, message: 'chapterId is required for this mode.' });
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found.' });
    chapterNameForTitle = chapter.name;
    questionFilter = { chapter: chapterId };
    if (mode === 'pyq') questionFilter.isPYQ = true;
    if (mode === 'practice' && difficulty && difficulty !== 'all') questionFilter.difficulty = difficulty;
    if (mode === 'timed') timeLimitSeconds = 20 * 60;
  }

  const pool = await Question.find(questionFilter);
  const questionCount = mode === 'mock' ? 25 : mode === 'timed' ? 15 : 10;
  const selected = shuffle(pool).slice(0, questionCount);

  res.json({
    success: true,
    data: {
      title: mode === 'mock' ? sessionMeta.testId : `${chapterNameForTitle} — ${mode === 'pyq' ? 'Previous Year Questions' : mode === 'timed' ? 'Timed Test' : 'Practice'}`,
      questions: selected.map(sanitizeQuestion),
      timeLimitSeconds,
      sessionMeta,
    },
  });
});

/**
 * GET /api/quiz/daily
 * Returns today's 10-question set for the user's target exam, or the
 * already-completed result if they've already taken it today.
 */
const getDailyQuiz = asyncHandler(async (req, res) => {
  const key = todayKey();
  const existing = await QuizAttempt.findOne({ user: req.user._id, mode: 'daily', dailyQuizDate: key });

  if (existing) {
    return res.json({
      success: true,
      data: {
        completed: true,
        result: {
          totalQuestions: existing.totalQuestions,
          correctCount: existing.correctCount,
          accuracy: existing.accuracy,
          xpEarned: existing.xpEarned,
          coinsEarned: existing.coinsEarned,
        },
      },
    });
  }

  const settings = await QuizSettings.getSingleton();
  const chapters = await Chapter.find({ examCode: req.user.targetExam }).select('_id');
  const chapterIds = chapters.map((c) => c._id);
  const pool = await Question.find({ chapter: { $in: chapterIds } });
  const selected = shuffle(pool).slice(0, settings.dailyQuizQuestionCount);

  res.json({
    success: true,
    data: {
      completed: false,
      title: `Daily Quiz — ${req.user.targetExam}`,
      questions: selected.map(sanitizeQuestion),
      timeLimitSeconds: 10 * 60,
      sessionMeta: { mode: 'daily', examCode: req.user.targetExam },
      xpReward: settings.dailyQuizXpReward,
      coinsReward: settings.dailyQuizCoinsReward,
    },
  });
});

/**
 * POST /api/quiz/submit
 * Universal grader for every mode. Body: { mode, examCode, subjectCode,
 * chapterId, testId, answers: [{ questionId, selectedIndex }], timeTakenSeconds }
 */
const submitQuiz = asyncHandler(async (req, res) => {
  const { mode, examCode, subjectCode, chapterId, answers, timeTakenSeconds } = req.body;

  if (!Array.isArray(answers) || !answers.length) {
    return res.status(400).json({ success: false, message: 'No answers submitted.' });
  }
  if (mode === 'daily') {
    const key = todayKey();
    const already = await QuizAttempt.findOne({ user: req.user._id, mode: 'daily', dailyQuizDate: key });
    if (already) return res.status(400).json({ success: false, message: 'Daily quiz already completed today.' });
  }

  const questionIds = answers.map((a) => a.questionId);
  const questions = await Question.find({ _id: { $in: questionIds } });
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

  let correctCount = 0;
  const gradedAnswers = answers.map((a) => {
    const q = questionMap.get(a.questionId);
    const isCorrect = !!q && a.selectedIndex === q.correctOptionIndex;
    if (isCorrect) correctCount++;
    return { question: a.questionId, selectedIndex: a.selectedIndex ?? null, isCorrect };
  });

  const total = answers.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // XP/coin rules: daily quiz has a flat reward; practice modes scale with accuracy.
  let xpEarned, coinsEarned;
  if (mode === 'daily') {
    const settings = await QuizSettings.getSingleton();
    xpEarned = settings.dailyQuizXpReward;
    coinsEarned = settings.dailyQuizCoinsReward;
  } else {
    xpEarned = Math.round(correctCount * 8 * (mode === 'timed' || mode === 'mock' ? 1.5 : 1));
    coinsEarned = Math.round(correctCount * 3);
  }

  const attempt = await QuizAttempt.create({
    user: req.user._id,
    mode,
    examCode,
    subjectCode: subjectCode || null,
    chapter: chapterId || null,
    dailyQuizDate: mode === 'daily' ? todayKey() : null,
    totalQuestions: total,
    correctCount,
    accuracy,
    timeTakenSeconds: timeTakenSeconds || 0,
    xpEarned,
    coinsEarned,
    answers: gradedAnswers,
  });

  // Update chapter progress (skip for daily/mock, which span many/no single chapters)
  if (chapterId && (mode === 'practice' || mode === 'timed' || mode === 'pyq')) {
    const progress = await ChapterProgress.findOneAndUpdate(
      { user: req.user._id, chapter: chapterId },
      { $inc: { questionsAttempted: total, questionsCorrect: correctCount }, $set: { lastPracticedAt: new Date() } },
      { upsert: true, new: true }
    );
  }

  // Update user XP/coins + streak
  const user = await User.findById(req.user._id);
  user.xp += xpEarned;
  user.coins += coinsEarned;

  const todayStr = todayKey();
  const lastActiveStr = user.lastActiveDate ? user.lastActiveDate.toISOString().slice(0, 10) : null;
  if (lastActiveStr !== todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = lastActiveStr === yesterday.toISOString().slice(0, 10);
    user.streakCount = wasYesterday ? user.streakCount + 1 : 1;
    user.lastActiveDate = new Date();
  }
  await user.save();

  res.json({
    success: true,
    data: {
      attemptId: attempt._id,
      totalQuestions: total,
      correctCount,
      accuracy,
      xpEarned,
      coinsEarned,
      newXpTotal: user.xp,
      newStreak: user.streakCount,
      // Include correct answers + explanations now that grading is done,
      // so the results screen can show a review.
      review: questions.map((q) => ({
        id: q._id,
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        selectedIndex: gradedAnswers.find((a) => a.question.toString() === q._id.toString())?.selectedIndex ?? null,
      })),
    },
  });
});

module.exports = { getQuizSession, getDailyQuiz, submitQuiz };
