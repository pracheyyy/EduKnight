const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Battle = require('../models/Battle');

const TOP_N = 50;

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as week start
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Sums XP gained since `since` for every user, combining two sources:
 * QuizAttempt.xpEarned (practice/timed/pyq/mock/daily) and
 * Battle.players[].xpEarned (1v1 battles). Returns a Map<userId, points>.
 * Two separate aggregations merged in JS — simpler to reason about than a
 * cross-collection $unionWith pipeline, and this project's data volume
 * doesn't need the performance either would give.
 */
async function getPeriodXpMap(since) {
  const quizGains = await QuizAttempt.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$user', points: { $sum: '$xpEarned' } } },
  ]);

  const battleGains = await Battle.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $unwind: '$players' },
    { $group: { _id: '$players.user', points: { $sum: '$players.xpEarned' } } },
  ]);

  const map = new Map();
  for (const g of quizGains) map.set(g._id.toString(), (map.get(g._id.toString()) || 0) + g.points);
  for (const g of battleGains) map.set(g._id.toString(), (map.get(g._id.toString()) || 0) + g.points);
  return map;
}

function medalFor(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

/**
 * GET /api/leaderboard?scope=global|weekly|monthly|friends&search=
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const scope = req.query.scope || 'global';
  const search = (req.query.search || '').trim();
  const me = req.user;

  let entries = [];
  let myRank = null;

  if (scope === 'global') {
    const filter = search ? { name: { $regex: search, $options: 'i' } } : {};
    const users = await User.find(filter).sort({ xp: -1 }).limit(TOP_N).select('name avatarUrl xp rankTier level');
    entries = users.map((u) => ({ userId: u._id, name: u.name, avatarUrl: u.avatarUrl, points: u.xp, rankTier: u.rankTier, level: u.level }));

    const higherCount = await User.countDocuments({ xp: { $gt: me.xp } });
    myRank = higherCount + 1;
  }

  if (scope === 'friends') {
    const ids = [...(me.friends || []), me._id];
    const filter = { _id: { $in: ids } };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const users = await User.find(filter).sort({ xp: -1 }).select('name avatarUrl xp rankTier level');
    entries = users.map((u) => ({ userId: u._id, name: u.name, avatarUrl: u.avatarUrl, points: u.xp, rankTier: u.rankTier, level: u.level }));
    myRank = entries.findIndex((e) => e.userId.toString() === me._id.toString()) + 1 || null;
  }

  if (scope === 'weekly' || scope === 'monthly') {
    const since = scope === 'weekly' ? startOfWeek() : startOfMonth();
    const xpMap = await getPeriodXpMap(since);

    let userIds = [...xpMap.keys()];
    let userFilter = { _id: { $in: userIds } };
    if (search) userFilter.name = { $regex: search, $options: 'i' };

    const users = await User.find(userFilter).select('name avatarUrl rankTier level');
    entries = users
      .map((u) => ({ userId: u._id, name: u.name, avatarUrl: u.avatarUrl, points: xpMap.get(u._id.toString()) || 0, rankTier: u.rankTier, level: u.level }))
      .sort((a, b) => b.points - a.points)
      .slice(0, TOP_N);

    const myPoints = xpMap.get(me._id.toString()) || 0;
    const allSorted = [...xpMap.entries()].sort((a, b) => b[1] - a[1]);
    myRank = allSorted.findIndex(([id]) => id === me._id.toString()) + 1 || (myPoints === 0 ? null : allSorted.length);
  }

  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1, medal: medalFor(i + 1) }));

  res.json({
    success: true,
    data: {
      scope,
      entries: ranked,
      myRank,
      myPoints: scope === 'global' ? me.xp : (ranked.find((e) => e.userId.toString() === me._id.toString())?.points ?? null),
    },
  });
});

/**
 * GET /api/leaderboard/search-users?q=
 * Powers the "add a friend" search box — separate from the leaderboard's
 * own search filter, which only searches within the current scope's list.
 */
const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, data: [] });

  const users = await User.find({ name: { $regex: q, $options: 'i' }, _id: { $ne: req.user._id } })
    .limit(15)
    .select('name avatarUrl rankTier xp');

  const friendIds = new Set((req.user.friends || []).map((id) => id.toString()));
  res.json({
    success: true,
    data: users.map((u) => ({ userId: u._id, name: u.name, avatarUrl: u.avatarUrl, rankTier: u.rankTier, xp: u.xp, isFriend: friendIds.has(u._id.toString()) })),
  });
});

/** POST /api/leaderboard/friends/:userId */
const addFriend = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user._id.toString()) return res.status(400).json({ success: false, message: "You can't add yourself." });

  const targetExists = await User.exists({ _id: userId });
  if (!targetExists) return res.status(404).json({ success: false, message: 'User not found.' });

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: userId } });
  res.json({ success: true, message: 'Friend added.' });
});

/** DELETE /api/leaderboard/friends/:userId */
const removeFriend = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await User.findByIdAndUpdate(req.user._id, { $pull: { friends: userId } });
  res.json({ success: true, message: 'Friend removed.' });
});

module.exports = { getLeaderboard, searchUsers, addFriend, removeFriend };
