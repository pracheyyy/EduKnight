const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User collection.
 * Gamification fields (xp, coins, streak, rank tier) live here so the
 * dashboard/profile/leaderboard modules can read straight off the user doc
 * without a join to a separate stats collection.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned by default queries
    },
    avatarUrl: { type: String, default: '' },

    targetExam: {
      type: String,
      enum: ['NEET', 'JEE', 'MHT-CET'],
      default: 'NEET',
    },

    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },

    // ---- Gamification ----
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    rankTier: {
      type: String,
      enum: ['Pawn', 'Bishop', 'Knight', 'Rook', 'Queen', 'King'],
      default: 'Pawn',
    },
    streakCount: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },

    // ---- Battle stats ----
    battleWins: { type: Number, default: 0 },
    battleLosses: { type: Number, default: 0 },

    // ---- Social (Leaderboard's Friends tab) ----
    // Deliberately simple: a direct, non-mutual "who I'm tracking" list rather
    // than a full request/accept friend-graph — that's a bigger feature than
    // this module needs. Adding someone shows them on your Friends leaderboard;
    // it doesn't require them to accept.
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ---- Resources (Module 9) ----
    bookmarkedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],

    // ---- Auth/verification state ----
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before saving, only if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare a plaintext password against the stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Instance method: generate a random reset token, store its hash, return the raw token
userSchema.methods.generatePasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return rawToken;
};

// Instance method: generate a 6-digit email verification code
userSchema.methods.generateEmailVerificationCode = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  this.emailVerificationCode = code;
  this.emailVerificationExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return code;
};

module.exports = mongoose.model('User', userSchema);
