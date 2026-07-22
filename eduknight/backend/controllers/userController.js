const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/User');

/**
 * Compute a rank tier + progress-to-next-tier from XP.
 * Same tier ladder used across the app: Pawn -> Bishop -> Knight -> Rook -> Queen -> King.
 * Kept here (not just on the schema default) so XP changes anywhere recompute tier consistently.
 */
const TIERS = [
  { name: 'Pawn', minXp: 0 },
  { name: 'Bishop', minXp: 500 },
  { name: 'Knight', minXp: 1500 },
  { name: 'Rook', minXp: 3500 },
  { name: 'Queen', minXp: 7000 },
  { name: 'King', minXp: 12000 },
];

function computeTierProgress(xp) {
  let current = TIERS[0];
  let next = TIERS[1];
  for (let i = 0; i < TIERS.length; i++) {
    if (xp >= TIERS[i].minXp) {
      current = TIERS[i];
      next = TIERS[i + 1] || null;
    }
  }
  const percent = next
    ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100)
    : 100;
  return {
    tier: current.name,
    nextTier: next ? next.name : null,
    xpIntoTier: xp - current.minXp,
    xpForNextTier: next ? next.minXp - current.minXp : 0,
    percentToNextTier: Math.min(percent, 100),
  };
}

/**
 * GET /api/users/dashboard
 * Aggregates everything the dashboard screen needs into one payload.
 *
 * NOTE: Quiz/Battle/Resource collections don't exist yet (they land in
 * Modules 6-7), so activity feed, heatmap and leaderboard preview are
 * shaped realistically from the User document today and are marked
 * `source: 'placeholder'` so the frontend can swap them for real
 * aggregation queries once those models exist, without changing the
 * response shape.
 */
const getDashboardData = asyncHandler(async (req, res) => {
  const user = req.user;
  const tierProgress = computeTierProgress(user.xp);

  // Deterministic pseudo-activity derived from the user's real stored fields,
  // so the heatmap isn't identical for every account.
  const seed = user._id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const heatmap = Array.from({ length: 84 }, (_, i) => {
    const pseudoRandom = Math.abs(Math.sin(seed + i)) ;
    let level = 0;
    if (pseudoRandom > 0.85) level = 4;
    else if (pseudoRandom > 0.7) level = 3;
    else if (pseudoRandom > 0.5) level = 2;
    else if (pseudoRandom > 0.3) level = 1;
    return { dayIndex: i, level };
  });

  res.json({
    success: true,
    data: {
      user: {
        name: user.name,
        avatarUrl: user.avatarUrl,
        targetExam: user.targetExam,
        xp: user.xp,
        coins: user.coins,
        level: user.level,
        streakCount: user.streakCount,
        battleWins: user.battleWins,
        battleLosses: user.battleLosses,
        rankTier: tierProgress.tier,
        nextRankTier: tierProgress.nextTier,
        percentToNextTier: tierProgress.percentToNextTier,
      },
      todaysProgress: {
        questionsSolved: 0,
        questionsGoal: 20,
        source: 'placeholder',
      },
      dailyQuiz: {
        completed: false,
        questionCount: 10,
        xpReward: 50,
        coinsReward: 20,
        source: 'placeholder',
      },
      recentActivity: [
        { type: 'info', text: 'Your activity feed will fill up as you practice, quiz and battle.', timeAgo: null },
      ],
      upcomingGoals: [
        { label: `Finish diagnostic quiz for ${user.targetExam}`, done: false },
        { label: 'Reach a 7-day streak', done: user.streakCount >= 7 },
        { label: 'Win your first 1v1 battle', done: user.battleWins > 0 },
      ],
      performanceTrend: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        accuracy: [0, 0, 0, 0, 0, 0, 0],
        source: 'placeholder',
      },
      heatmap,
      leaderboardPreview: {
        yourRank: null,
        top: [],
        source: 'placeholder',
      },
      battleInvitations: [],
    },
  });
});

/**
 * GET /api/users/me/profile
 * Full profile payload — everything the Profile screen needs in one call.
 * Deliberately separate from GET /api/auth/me (which stays minimal, for
 * auth-state checks) so the heavier profile aggregation doesn't run on
 * every page load.
 */
const getMyProfileData = asyncHandler(async (req, res) => {
  const user = req.user;
  const tierProgress = computeTierProgress(user.xp);
  const totalBattles = (user.battleWins || 0) + (user.battleLosses || 0);
  const winRate = totalBattles > 0 ? Math.round((user.battleWins / totalBattles) * 100) : 0;

  res.json({
    success: true,
    data: {
      user: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        targetExam: user.targetExam,
        level: user.level,
        xp: user.xp,
        coins: user.coins,
        streakCount: user.streakCount,
        battleWins: user.battleWins,
        battleLosses: user.battleLosses,
        winRate,
        rankTier: tierProgress.tier,
        nextRankTier: tierProgress.nextTier,
        percentToNextTier: tierProgress.percentToNextTier,
        memberSince: user.createdAt,
      },
      // Quiz history doesn't exist until Module 6, so accuracy/weekly/monthly
      // trends are shaped placeholders — same contract, real data drops in later.
      quizAccuracy: { overall: 0, source: 'placeholder' },
      weeklyProgress: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], questionsSolved: [0, 0, 0, 0, 0, 0, 0], source: 'placeholder' },
      monthlyProgress: { labels: ['W1', 'W2', 'W3', 'W4'], xpEarned: [0, 0, 0, 0], source: 'placeholder' },
      activityTimeline: [
        { type: 'account', text: 'Joined EduKnight', date: user.createdAt },
      ],
    },
  });
});

/**
 * PATCH /api/users/me
 * Updates editable profile fields only. Email/password are intentionally
 * excluded here — those go through dedicated, more carefully guarded
 * auth flows instead of a generic profile update.
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'targetExam', 'avatarUrl'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.name && updates.name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
  }
  if (updates.targetExam && !['NEET', 'JEE', 'MHT-CET'].includes(updates.targetExam)) {
    return res.status(400).json({ success: false, message: 'Invalid target exam.' });
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });

  res.json({
    success: true,
    message: 'Profile updated.',
    data: {
      name: user.name,
      targetExam: user.targetExam,
      avatarUrl: user.avatarUrl,
    },
  });
});

module.exports = { getDashboardData, getMyProfileData, updateMyProfile };
