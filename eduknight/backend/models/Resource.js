const mongoose = require('mongoose');

/**
 * A single curated resource. `type` covers the four categories from the
 * brief; `url` points off-platform (YouTube, a hosted PDF, etc.) — this
 * app curates and organizes links, it doesn't host the files itself.
 */
const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['youtube', 'notes', 'formula-sheet', 'pyq-paper'], required: true, index: true },
    examCode: { type: String, enum: ['NEET', 'JEE', 'MHT-CET'], required: true, index: true },
    subjectCode: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    url: { type: String, required: true },
    thumbnailEmoji: { type: String, default: '📄' }, // lightweight stand-in for a real thumbnail image
    source: { type: String, default: '' }, // e.g. channel/author name shown on the card
    tags: [{ type: String }],

    // Flags demo/placeholder entries the same way seedContent.js flags demo
    // questions — real curated links get added via the Admin Panel (Module 10).
    isSeedContent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

resourceSchema.index({ examCode: 1, subjectCode: 1, type: 1 });
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
