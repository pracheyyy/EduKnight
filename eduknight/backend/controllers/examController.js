const asyncHandler = require('../middleware/asyncHandler');
const Chapter = require('../models/Chapter');
const ChapterProgress = require('../models/ChapterProgress');
const { EXAM_STRUCTURE } = require('../config/examStructure');

/**
 * GET /api/exams
 * Returns the fixed exam/subject structure, each subject annotated with
 * real chapter counts and the logged-in user's aggregate progress.
 */
const getExams = asyncHandler(async (req, res) => {
  const examCodes = Object.keys(EXAM_STRUCTURE);
  const result = {};

  for (const examCode of examCodes) {
    const subjects = [];
    for (const subject of EXAM_STRUCTURE[examCode].subjects) {
      const chapters = await Chapter.find({ examCode, subjectCode: subject.code }).select('_id totalQuestions');
      const chapterIds = chapters.map((c) => c._id);
      const totalQuestions = chapters.reduce((sum, c) => sum + (c.totalQuestions || 0), 0);

      const progressDocs = await ChapterProgress.find({ user: req.user._id, chapter: { $in: chapterIds } });
      const attempted = progressDocs.reduce((sum, p) => sum + p.questionsAttempted, 0);
      const percent = totalQuestions > 0 ? Math.min(Math.round((attempted / totalQuestions) * 100), 100) : 0;

      subjects.push({
        code: subject.code,
        name: subject.name,
        emoji: subject.emoji,
        chapterCount: chapters.length,
        totalQuestions,
        progressPercent: percent,
      });
    }
    result[examCode] = { label: EXAM_STRUCTURE[examCode].label, subjects };
  }

  res.json({ success: true, data: result });
});

/**
 * GET /api/exams/:examCode/:subjectCode/chapters
 * Chapter list for one subject, joined with this user's bookmark + progress.
 */
const getChapters = asyncHandler(async (req, res) => {
  const { examCode, subjectCode } = req.params;

  const chapters = await Chapter.find({ examCode, subjectCode }).sort({ order: 1 });
  const chapterIds = chapters.map((c) => c._id);
  const progressDocs = await ChapterProgress.find({ user: req.user._id, chapter: { $in: chapterIds } });
  const progressMap = new Map(progressDocs.map((p) => [p.chapter.toString(), p]));

  const data = chapters.map((ch) => {
    const progress = progressMap.get(ch._id.toString());
    const attempted = progress ? progress.questionsAttempted : 0;
    const percent = ch.totalQuestions > 0 ? Math.min(Math.round((attempted / ch.totalQuestions) * 100), 100) : 0;
    return {
      id: ch._id,
      name: ch.name,
      totalQuestions: ch.totalQuestions,
      difficultyBreakdown: ch.difficultyBreakdown,
      bookmarked: progress ? progress.bookmarked : false,
      progressPercent: percent,
      questionsAttempted: attempted,
    };
  });

  res.json({ success: true, data });
});

/**
 * PATCH /api/exams/chapters/:chapterId/bookmark
 * Toggles bookmark state; creates the ChapterProgress doc on first touch.
 */
const toggleBookmark = asyncHandler(async (req, res) => {
  const { chapterId } = req.params;

  let progress = await ChapterProgress.findOne({ user: req.user._id, chapter: chapterId });
  if (!progress) {
    progress = await ChapterProgress.create({ user: req.user._id, chapter: chapterId, bookmarked: true });
  } else {
    progress.bookmarked = !progress.bookmarked;
    await progress.save();
  }

  res.json({ success: true, data: { bookmarked: progress.bookmarked } });
});

/**
 * GET /api/exams/:examCode/:subjectCode/mock-tests
 * Mock tests are just a curated set spanning multiple chapters, generated
 * on the fly from the subject's chapter list (no separate MockTest
 * collection needed — each "test" is a deterministic slice of chapters).
 */
const getMockTests = asyncHandler(async (req, res) => {
  const { examCode, subjectCode } = req.params;
  const chapters = await Chapter.find({ examCode, subjectCode }).sort({ order: 1 });

  if (!chapters.length) return res.json({ success: true, data: [] });

  const testCount = Math.min(3, Math.max(1, Math.floor(chapters.length / 3)));
  const tests = Array.from({ length: testCount }, (_, i) => {
    const slice = chapters.slice(i * 3, i * 3 + 3).length ? chapters.slice(i * 3, i * 3 + 3) : chapters;
    return {
      id: `${examCode}-${subjectCode}-mock-${i + 1}`,
      title: `${EXAM_STRUCTURE[examCode].label} ${EXAM_STRUCTURE[examCode].subjects.find((s) => s.code === subjectCode)?.name} Mock Test ${i + 1}`,
      chapterIds: slice.map((c) => c._id),
      chapterNames: slice.map((c) => c.name),
      questionCount: Math.min(25, slice.reduce((s, c) => s + c.totalQuestions, 0)) || 25,
      durationMinutes: 30,
    };
  });

  res.json({ success: true, data: tests });
});

module.exports = { getExams, getChapters, toggleBookmark, getMockTests };
