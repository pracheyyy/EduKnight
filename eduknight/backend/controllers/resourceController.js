const asyncHandler = require('../middleware/asyncHandler');
const Resource = require('../models/Resource');
const User = require('../models/User');
const { EXAM_STRUCTURE } = require('../config/examStructure');

const PAGE_SIZE = 12;

const TYPE_META = {
  youtube: { label: 'YouTube Playlists', icon: 'bi-youtube', emoji: '📺' },
  notes: { label: 'Notes PDFs', icon: 'bi-file-earmark-text', emoji: '📝' },
  'formula-sheet': { label: 'Formula Sheets', icon: 'bi-calculator', emoji: '📐' },
  'pyq-paper': { label: 'Previous Year Papers', icon: 'bi-file-earmark-check', emoji: '📄' },
};

/**
 * GET /api/resources?exam=&subject=&type=&search=&bookmarked=&page=
 * Category cards (counts per type) + the filtered/paginated resource list,
 * in one response so the page only needs one request per filter change.
 */
const getResources = asyncHandler(async (req, res) => {
  const { exam, subject, type, search, bookmarked, page } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const baseFilter = {};
  if (exam) baseFilter.examCode = exam;
  if (subject) baseFilter.subjectCode = subject;

  // Category card counts reflect exam/subject filters but NOT the type filter itself,
  // so switching category cards doesn't make the other cards' counts disappear.
  const categoryCounts = await Resource.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const categories = Object.keys(TYPE_META).map((t) => ({
    type: t,
    ...TYPE_META[t],
    count: categoryCounts.find((c) => c._id === t)?.count || 0,
  }));

  const listFilter = { ...baseFilter };
  if (type && type !== 'all') listFilter.type = type;
  if (search) listFilter.$text = { $search: search };

  let bookmarkedIds = [];
  if (bookmarked === 'true') {
    const user = await User.findById(req.user._id).select('bookmarkedResources');
    bookmarkedIds = user.bookmarkedResources.map((id) => id.toString());
    listFilter._id = { $in: bookmarkedIds };
  }

  const total = await Resource.countDocuments(listFilter);
  const resources = await Resource.find(listFilter)
    .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .skip((pageNum - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const userBookmarks = bookmarked === 'true'
    ? new Set(bookmarkedIds)
    : new Set((await User.findById(req.user._id).select('bookmarkedResources')).bookmarkedResources.map((id) => id.toString()));

  res.json({
    success: true,
    data: {
      categories,
      resources: resources.map((r) => ({
        id: r._id,
        title: r.title,
        type: r.type,
        examCode: r.examCode,
        subjectCode: r.subjectCode,
        description: r.description,
        url: r.url,
        thumbnailEmoji: r.thumbnailEmoji,
        source: r.source,
        tags: r.tags,
        bookmarked: userBookmarks.has(r._id.toString()),
      })),
      pagination: { page: pageNum, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) },
      examStructure: EXAM_STRUCTURE,
    },
  });
});

/** PATCH /api/resources/:resourceId/bookmark */
const toggleResourceBookmark = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const exists = await Resource.exists({ _id: resourceId });
  if (!exists) return res.status(404).json({ success: false, message: 'Resource not found.' });

  const user = await User.findById(req.user._id);
  const idx = user.bookmarkedResources.findIndex((id) => id.toString() === resourceId);
  let bookmarked;
  if (idx === -1) {
    user.bookmarkedResources.push(resourceId);
    bookmarked = true;
  } else {
    user.bookmarkedResources.splice(idx, 1);
    bookmarked = false;
  }
  await user.save();

  res.json({ success: true, data: { bookmarked } });
});

module.exports = { getResources, toggleResourceBookmark };
