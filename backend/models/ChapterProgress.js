const mongoose = require('mongoose');

/**
 * One document per (user, chapter) pair. Tracks bookmark state and
 * cumulative practice stats — separate from Question/Chapter so those
 * stay clean, shareable content collections.
 */
const chapterProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    bookmarked: { type: Boolean, default: false },
    questionsAttempted: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    lastPracticedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

chapterProgressSchema.index({ user: 1, chapter: 1 }, { unique: true });

module.exports = mongoose.model('ChapterProgress', chapterProgressSchema);