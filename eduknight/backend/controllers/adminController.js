const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/User');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Resource = require('../models/Resource');
const QuizAttempt = require('../models/QuizAttempt');
const Battle = require('../models/Battle');
const QuizSettings = require('../models/QuizSettings');

const PAGE_SIZE = 10;

/* ============================== Analytics ============================== */

/** GET /api/admin/analytics */
const getAnalytics = asyncHandler(async (req, res) => {
  const [totalStudents, totalAdmins, totalQuestions, totalResources, totalChapters, totalBattles] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'admin' }),
    Question.countDocuments(),
    Resource.countDocuments(),
    Chapter.countDocuments(),
    Battle.countDocuments(),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const signupsRaw = await User.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const quizAttemptsRaw = await QuizAttempt.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, avgAccuracy: { $avg: '$accuracy' } } },
    { $sort: { _id: 1 } },
  ]);

  // Fill in the last 7 days so the chart doesn't have gaps on quiet days.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const signupsByDay = days.map((d) => signupsRaw.find((r) => r._id === d)?.count || 0);
  const attemptsByDay = days.map((d) => quizAttemptsRaw.find((r) => r._id === d)?.count || 0);

  const examDistribution = await User.aggregate([{ $group: { _id: '$targetExam', count: { $sum: 1 } } }]);
  const avgAccuracyOverall = await QuizAttempt.aggregate([{ $group: { _id: null, avg: { $avg: '$accuracy' } } }]);

  res.json({
    success: true,
    data: {
      totals: { totalStudents, totalAdmins, totalQuestions, totalResources, totalChapters, totalBattles },
      last7Days: { labels: days.map((d) => d.slice(5)), signups: signupsByDay, quizAttempts: attemptsByDay },
      examDistribution: examDistribution.map((e) => ({ exam: e._id, count: e.count })),
      avgAccuracy: Math.round(avgAccuracyOverall[0]?.avg || 0),
    },
  });
});

/* ============================== Questions ============================== */

/** GET /api/admin/questions?exam=&subject=&chapterId=&difficulty=&search=&page= */
const getQuestionsAdmin = asyncHandler(async (req, res) => {
  const { exam, subject, chapterId, difficulty, search, page } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (exam) filter.examCode = exam;
  if (subject) filter.subjectCode = subject;
  if (chapterId) filter.chapter = chapterId;
  if (difficulty) filter.difficulty = difficulty;
  if (search) filter.questionText = { $regex: search, $options: 'i' };

  const total = await Question.countDocuments(filter);
  const questions = await Question.find(filter)
    .populate('chapter', 'name')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  res.json({
    success: true,
    data: {
      questions,
      pagination: { page: pageNum, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) },
    },
  });
});

/** GET /api/admin/chapters?exam=&subject=  (for question form dropdowns) */
const getChaptersAdmin = asyncHandler(async (req, res) => {
  const { exam, subject } = req.query;
  const filter = {};
  if (exam) filter.examCode = exam;
  if (subject) filter.subjectCode = subject;
  const chapters = await Chapter.find(filter).select('name examCode subjectCode').sort({ order: 1 });
  res.json({ success: true, data: chapters });
});

/** POST /api/admin/questions */
const createQuestion = asyncHandler(async (req, res) => {
  const { chapter, questionText, options, correctOptionIndex, explanation, difficulty, isPYQ, pyqYear } = req.body;

  const chapterDoc = await Chapter.findById(chapter);
  if (!chapterDoc) return res.status(404).json({ success: false, message: 'Chapter not found.' });

  const question = await Question.create({
    chapter, examCode: chapterDoc.examCode, subjectCode: chapterDoc.subjectCode,
    questionText, options, correctOptionIndex, explanation, difficulty, isPYQ: !!isPYQ, pyqYear: pyqYear || null,
    isSeedContent: false,
  });

  await Chapter.findByIdAndUpdate(chapter, {
    $inc: { totalQuestions: 1, [`difficultyBreakdown.${difficulty}`]: 1 },
  });

  res.status(201).json({ success: true, data: question });
});

/** PATCH /api/admin/questions/:id */
const updateQuestion = asyncHandler(async (req, res) => {
  const allowed = ['questionText', 'options', 'correctOptionIndex', 'explanation', 'difficulty', 'isPYQ', 'pyqYear'];
  const updates = {};
  for (const f of allowed) if (req.body[f] !== undefined) updates[f] = req.body[f];

  const question = await Question.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
  res.json({ success: true, data: question });
});

/** DELETE /api/admin/questions/:id */
const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });

  await Chapter.findByIdAndUpdate(question.chapter, {
    $inc: { totalQuestions: -1, [`difficultyBreakdown.${question.difficulty}`]: -1 },
  });

  res.json({ success: true, message: 'Question deleted.' });
});

/* ============================== Quiz Management ============================== */

/** GET /api/admin/quiz-settings */
const getQuizSettingsAdmin = asyncHandler(async (req, res) => {
  const settings = await QuizSettings.getSingleton();
  res.json({ success: true, data: settings });
});

/** PATCH /api/admin/quiz-settings */
const updateQuizSettingsAdmin = asyncHandler(async (req, res) => {
  const { dailyQuizQuestionCount, dailyQuizXpReward, dailyQuizCoinsReward } = req.body;
  const settings = await QuizSettings.getSingleton();
  if (dailyQuizQuestionCount !== undefined) settings.dailyQuizQuestionCount = dailyQuizQuestionCount;
  if (dailyQuizXpReward !== undefined) settings.dailyQuizXpReward = dailyQuizXpReward;
  if (dailyQuizCoinsReward !== undefined) settings.dailyQuizCoinsReward = dailyQuizCoinsReward;
  await settings.save();
  res.json({ success: true, data: settings });
});

/** GET /api/admin/quiz-attempts?mode=&exam=&page= */
const getQuizAttemptsAdmin = asyncHandler(async (req, res) => {
  const { mode, exam, page } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (mode) filter.mode = mode;
  if (exam) filter.examCode = exam;

  const total = await QuizAttempt.countDocuments(filter);
  const attempts = await QuizAttempt.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  res.json({
    success: true,
    data: { attempts, pagination: { page: pageNum, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) } },
  });
});

/* ============================== Resources ============================== */

/** GET /api/admin/resources?type=&exam=&search=&page= */
const getResourcesAdmin = asyncHandler(async (req, res) => {
  const { type, exam, search, page } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (type) filter.type = type;
  if (exam) filter.examCode = exam;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const total = await Resource.countDocuments(filter);
  const resources = await Resource.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE);

  res.json({
    success: true,
    data: { resources, pagination: { page: pageNum, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) } },
  });
});

/** POST /api/admin/resources */
const createResource = asyncHandler(async (req, res) => {
  const { title, type, examCode, subjectCode, description, url, thumbnailEmoji, source, tags } = req.body;
  const resource = await Resource.create({
    title, type, examCode, subjectCode, description, url,
    thumbnailEmoji: thumbnailEmoji || '📄', source, tags: tags || [], isSeedContent: false,
  });
  res.status(201).json({ success: true, data: resource });
});

/** PATCH /api/admin/resources/:id */
const updateResource = asyncHandler(async (req, res) => {
  const allowed = ['title', 'type', 'examCode', 'subjectCode', 'description', 'url', 'thumbnailEmoji', 'source', 'tags'];
  const updates = {};
  for (const f of allowed) if (req.body[f] !== undefined) updates[f] = req.body[f];

  const resource = await Resource.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!resource) return res.status(404).json({ success: false, message: 'Resource not found.' });
  res.json({ success: true, data: resource });
});

/** DELETE /api/admin/resources/:id */
const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndDelete(req.params.id);
  if (!resource) return res.status(404).json({ success: false, message: 'Resource not found.' });
  res.json({ success: true, message: 'Resource deleted.' });
});

/* ============================== Students ============================== */

/** GET /api/admin/students?exam=&role=&search=&page= */
const getStudentsAdmin = asyncHandler(async (req, res) => {
  const { exam, role, search, page } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (exam) filter.targetExam = exam;
  if (role) filter.role = role;
  if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];

  const total = await User.countDocuments(filter);
  const students = await User.find(filter)
    .select('name email targetExam role xp coins level streakCount battleWins battleLosses isEmailVerified createdAt')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  res.json({
    success: true,
    data: { students, pagination: { page: pageNum, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) } },
  });
});

/** PATCH /api/admin/students/:id/role  { role: 'admin'|'student' } */
const updateStudentRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['student', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });

  if (req.params.id === req.user._id.toString() && role === 'student') {
    return res.status(400).json({ success: false, message: "You can't demote yourself." });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('name email role');
  if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });
  res.json({ success: true, data: user });
});

/** DELETE /api/admin/students/:id */
const deleteStudent = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "You can't delete your own account here." });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });
  res.json({ success: true, message: 'Student account deleted.' });
});

module.exports = {
  getAnalytics,
  getQuestionsAdmin, getChaptersAdmin, createQuestion, updateQuestion, deleteQuestion,
  getQuizSettingsAdmin, updateQuizSettingsAdmin, getQuizAttemptsAdmin,
  getResourcesAdmin, createResource, updateResource, deleteResource,
  getStudentsAdmin, updateStudentRole, deleteStudent,
};
