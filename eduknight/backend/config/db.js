const mongoose = require('mongoose');

/**
 * Connects to MongoDB using Mongoose.
 * Called once from server.js on boot.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[EduKnight] MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`[EduKnight] MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
