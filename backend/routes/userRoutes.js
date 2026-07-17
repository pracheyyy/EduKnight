const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getDashboardData, getMyProfileData, updateMyProfile } = require('../controllers/userController');

const router = express.Router();

router.get('/dashboard', protect, getDashboardData);
router.get('/me/profile', protect, getMyProfileData);
router.patch('/me', protect, updateMyProfile);

module.exports = router;