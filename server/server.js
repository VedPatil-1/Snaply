require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const http = require('http');
const { setupSocketIO } = require('./services/socketService');
const { startDevChatSimulator } = require('./services/devChatSimulator');
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const corsOrigins = String(process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: corsOrigins.includes('*') ? '*' : corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Snaply API' });
});

app.use('/api', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    setupSocketIO(server, corsOptions);
    startDevChatSimulator();
    server.on('error', (error) => {
      console.error('Snaply server error:', error.message);
      process.exitCode = 1;
    });
    server.listen(PORT, HOST, () => {
      console.log(`Snaply server listening on ${HOST}:${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down Snaply server.`);
      server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(0));
      });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exitCode = 1;
  }
};

startServer();

module.exports = app;
