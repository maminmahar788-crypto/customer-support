
import 'dotenv/config';

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import connectDB from './config/db.js';
import User from './models/User.js';
import Ticket from './models/Ticket.js';

import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || 'http://localhost:5173';

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PATCH']
  }
});

// Security middleware
app.use(helmet());

app.use(cors({
  origin: CLIENT_URL
}));

app.use(express.json({ limit: '1mb' }));

// Make Socket.IO available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API routes
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  }),
  authRoutes
);

app.use('/api/tickets', ticketRoutes);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'SupportDesk Pro',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

// Socket authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    if (!process.env.JWT_SECRET) {
      return next(new Error('Server authentication unavailable'));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded || typeof decoded !== 'object' || !decoded.id) {
      return next(new Error('Invalid token'));
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return next(new Error('Invalid user'));
    }

    socket.user = user;
    next();

  } catch (error) {
    console.error('Socket authentication failed:', error.message);
    next(new Error('Invalid socket session'));
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('ticket:join', async (ticketId) => {
    try {
      if (!mongoose.isValidObjectId(ticketId)) {
        return;
      }

      const ticket = await Ticket.findById(ticketId)
        .select('customer assignedAgent');

      if (!ticket) return;

      const isAdmin = socket.user.role === 'admin';

      const isAssignedAgent =
        socket.user.role === 'agent' &&
        String(ticket.assignedAgent) === String(socket.user._id);

      const isCustomer =
        String(ticket.customer) === String(socket.user._id);

      if (isAdmin || isAssignedAgent || isCustomer) {
        socket.join(`ticket:${ticketId}`);
        console.log(`Joined ticket room: ${ticketId}`);
      }

    } catch (error) {
      console.error('Ticket join error:', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);

  res.status(err.status || err.statusCode || 500).json({
    message:
      err.status || err.statusCode
        ? err.message
        : 'Unexpected server error.'
  });
});

// Start application
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing in .env');
    }

    await connectDB();

    server.listen(PORT, () => {
      console.log('================================');
      console.log('SupportDesk Pro API Started');
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log('================================');
    });

  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
