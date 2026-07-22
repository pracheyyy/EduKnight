/**
 * One-off CLI script to promote a user to admin. There is deliberately no
 * HTTP endpoint for this (self-serve "become admin" would be a serious
 * security hole) — this requires direct server/database access instead.
 *
 * Usage:
 *   node utils/makeAdmin.js someone@example.com
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node utils/makeAdmin.js <email>');
    process.exit(1);
  }

  await connectDB();
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role: 'admin' },
    { new: true }
  );

  if (!user) {
    console.error(`[makeAdmin] No user found with email: ${email}`);
  } else {
    console.log(`[makeAdmin] ${user.name} (${user.email}) is now an admin.`);
  }

  await mongoose.connection.close();
  process.exit(user ? 0 : 1);
}

run();
