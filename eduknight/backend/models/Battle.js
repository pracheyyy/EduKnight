const mongoose = require('mongoose');

/**
 * Persisted once a battle finishes (final result only — the live back-and-forth
 * during play happens entirely over Socket.IO / in-memory room state in
 * sockets/battleSocket.js, not written to Mongo turn-by-turn).
 */
const battleSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true },
    examCode: { type: String, enum: ['NEET', 'JEE', 'MHT-CET'], required: true },

    players: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        correctCount: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 0 },
        timeTakenSeconds: { type: Number, default: 0 },
        xpEarned: { type: Number, default: 0 },
        coinsEarned: { type: Number, default: 0 },
      },
    ],

    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = draw
    status: { type: String, enum: ['completed', 'forfeited'], default: 'completed' },

    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Battle', battleSchema);
