const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getExams, getChapters, toggleBookmark, getMockTests } = require('../controllers/examController');

const router = express.Router();

router.get('/', protect, getExams);
router.get('/:examCode/:subjectCode/chapters', protect, getChapters);
router.get('/:examCode/:subjectCode/mock-tests', protect, getMockTests);
router.patch('/chapters/:chapterId/bookmark', protect, toggleBookmark);

module.exports = router;