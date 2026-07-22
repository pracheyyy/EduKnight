const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getResources, toggleResourceBookmark } = require('../controllers/resourceController');

const router = express.Router();

router.get('/', protect, getResources);
router.patch('/:resourceId/bookmark', protect, toggleResourceBookmark);

module.exports = router;
