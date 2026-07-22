require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const examRoutes = require('./routes/examRoutes');
const quizRoutes = require('./routes/quizRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const initBattleSocket = require('./sockets/battleSocket');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

connectDB();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ success: true, message: 'EduKnight API is running.' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

// ---- HTTP + Socket.IO (Socket.IO needs the raw http server, not just Express) ----
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
initBattleSocket(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[EduKnight] API + Socket.IO listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = { app, httpServer, io };
