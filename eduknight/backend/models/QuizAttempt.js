const mongoose = require('mongoose');

/**
 * One document per graded quiz session, regardless of mode. The universal
 * quiz runner (Module 5 + Module 6) posts here on submit. `mode` +
 * `dailyQuizDate` are what let the Daily Quiz enforce "once per day" and
 * what the Dashboard's activity feed / heatmap will later read from,
 * replacing the placeholder data those endpoints return today.
 */
const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['practice', 'timed', 'pyq', 'mock', 'daily'], required: true },
    examCode: { type: String, enum: ['NEET', 'JEE', 'MHT-CET'], required: true },
    subjectCode: { type: String, default: null },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', default: null },

    // Only set for mode === 'daily'; used as a per-day uniqueness key with `user`.
    dailyQuizDate: { type: String, default: null }, // 'YYYY-MM-DD'

    totalQuestions: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    accuracy: { type: Number, required: true }, // percent, 0-100
    timeTakenSeconds: { type: Number, default: 0 },

    xpEarned: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },

    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        selectedIndex: { type: Number, default: null }, // null = skipped
        isCorrect: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

quizAttemptSchema.index({ user: 1, mode: 1, dailyQuizDate: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
