const mongoose = require('mongoose');

/**
 * Single question bank shared across every quiz-taking surface:
 * chapter practice, timed tests, PYQs, mock tests, and the daily quiz.
 * `isPYQ` + `pyqYear` let the PYQ tab filter this same collection instead
 * of needing a separate PreviousYearQuestion model.
 */
const questionSchema = new mongoose.Schema(
  {
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    examCode: { type: String, enum: ['NEET', 'JEE', 'MHT-CET'], required: true },
    subjectCode: { type: String, required: true },

    questionText: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: { validator: (v) => v.length === 4, message: 'Exactly 4 options are required.' },
    },
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: '' },

    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    isPYQ: { type: Boolean, default: false },
    pyqYear: { type: Number, default: null },

    // Demo/seed content is flagged so it's obvious in the admin panel (Module 10)
    // which questions still need to be replaced with a real authored bank.
    isSeedContent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

questionSchema.index({ chapter: 1, difficulty: 1 });
questionSchema.index({ examCode: 1, subjectCode: 1, isPYQ: 1 });

module.exports = mongoose.model('Question', questionSchema);