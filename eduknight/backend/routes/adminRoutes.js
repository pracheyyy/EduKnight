const express = require('express');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAnalytics,
  getQuestionsAdmin, getChaptersAdmin, createQuestion, updateQuestion, deleteQuestion,
  getQuizSettingsAdmin, updateQuizSettingsAdmin, getQuizAttemptsAdmin,
  getResourcesAdmin, createResource, updateResource, deleteResource,
  getStudentsAdmin, updateStudentRole, deleteStudent,
} = require('../controllers/adminController');

const router = express.Router();

// Every route below requires a logged-in admin.
router.use(protect, restrictTo('admin'));

router.get('/analytics', getAnalytics);

router.get('/questions', getQuestionsAdmin);
router.post('/questions', createQuestion);
router.patch('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);
router.get('/chapters', getChaptersAdmin);

router.get('/quiz-settings', getQuizSettingsAdmin);
router.patch('/quiz-settings', updateQuizSettingsAdmin);
router.get('/quiz-attempts', getQuizAttemptsAdmin);

router.get('/resources', getResourcesAdmin);
router.post('/resources', createResource);
router.patch('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);

router.get('/students', getStudentsAdmin);
router.patch('/students/:id/role', updateStudentRole);
router.delete('/students/:id', deleteStudent);

module.exports = router;
