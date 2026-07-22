const mongoose = require('mongoose');

/**
 * Singleton settings document (there's only ever one, with a fixed _id).
 * Lets the Admin Panel actually control daily quiz behavior instead of it
 * being hardcoded — quizController.js reads from this instead of literals.
 */
const quizSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    dailyQuizQuestionCount: { type: Number, default: 10, min: 5, max: 25 },
    dailyQuizXpReward: { type: Number, default: 50, min: 0 },
    dailyQuizCoinsReward: { type: Number, default: 20, min: 0 },
  },
  { timestamps: true }
);

quizSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findById('singleton');
  if (!settings) settings = await this.create({ _id: 'singleton' });
  return settings;
};

module.exports = mongoose.model('QuizSettings', quizSettingsSchema);
