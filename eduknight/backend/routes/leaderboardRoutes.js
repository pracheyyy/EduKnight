const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getLeaderboard, searchUsers, addFriend, removeFriend } = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/', protect, getLeaderboard);
router.get('/search-users', protect, searchUsers);
router.post('/friends/:userId', protect, addFriend);
router.delete('/friends/:userId', protect, removeFriend);

module.exports = router;
