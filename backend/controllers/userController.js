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

module.exports = { getDashboardData };