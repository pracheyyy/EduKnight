const mongoose = require('mongoose');

/**
 * A chapter belongs to one (examCode, subjectCode) pair.
 * Subjects aren't a separate collection — they're just a fixed enum per
 * exam (see EXAM_STRUCTURE in examController.js) since they never need
 * independent CRUD; only chapters and questions do.
 */
const chapterSchema = new mongoose.Schema(
  {
    examCode: { type: String, enum: ['NEET', 'JEE', 'MHT-CET'], required: true, index: true },
    subjectCode: { type: String, required: true, index: true }, // e.g. 'physics', 'botany'
    subjectName: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    order: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    difficultyBreakdown: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

chapterSchema.index({ examCode: 1, subjectCode: 1, order: 1 });

module.exports = mongoose.model('Chapter', chapterSchema);