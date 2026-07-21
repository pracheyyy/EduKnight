const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getQuizSession, getDailyQuiz, submitQuiz } = require('../controllers/quizController');

const router = express.Router();

router.get('/session', protect, getQuizSession);
router.get('/daily', protect, getDailyQuiz);
router.post('/submit', protect, submitQuiz);

module.exports = router;