// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// const connectDB = require('./config/db');
// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// connectDB();

// const app = express();

// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// app.use(express.json());
// app.use(cookieParser());

// // ---- Routes ----
// app.get('/api/health', (req, res) => res.json({ success: true, message: 'EduKnight API is running.' }));
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

// // Future modules mount here the same way, e.g.:
// // app.use('/api/exams', require('./routes/examRoutes'));
// // app.use('/api/quiz', require('./routes/quizRoutes'));
// // app.use('/api/battles', require('./routes/battleRoutes'));

// app.use(notFound);
// app.use(errorHandler);

// const PORT = process.env.PORT || 5000;
// const server = app.listen(PORT, () => {
//   console.log(`[EduKnight] API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
// });

// module.exports = { app, server };

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const examRoutes = require('./routes/examRoutes');
const quizRoutes = require('./routes/quizRoutes');
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

// Future modules mount here the same way, e.g.:
// app.use('/api/battles', require('./routes/battleRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`[EduKnight] API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = { app, server };