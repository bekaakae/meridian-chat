const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Clerk } = require("@clerk/clerk-sdk-node");

// Load environment variables first
dotenv.config();

console.log('Environment variables loaded:');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Set' : 'NOT SET');

const { connectDB } = require("./config/db");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes"); // Make sure this import exists
const userRoutes = require("./routes/userRoutes");
const { socketAuthMiddleware } = require("./middleware/socketAuth");

const app = express();
const httpServer = http.createServer(app);

// Initialize Clerk
const clerk = new Clerk({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'CLERK_SECRET_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Connect to MongoDB
connectDB().catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

const allowedOrigins = [
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:5173', 
  'http://127.0.0.1:5173'
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// CORS middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Clerk authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const session = await clerk.verifyToken(token);
    req.auth = session;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check endpoint (public)
app.get("/", (req, res) => {
  res.json({
    message: "Chat API is running",
    version: "1.0.0",
    endpoints: {
      users: "/api/users",
      conversations: "/api/conversations",
      messages: "/api/messages"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is healthy",
    timestamp: new Date().toISOString()
  });
});

// FIXED: Apply auth middleware AND pass io to message routes
app.use("/api/conversations", requireAuth, conversationRoutes);
app.use("/api/users", requireAuth, userRoutes);

// IMPORTANT: This is the key fix - pass io to message routes
app.use("/api/messages", requireAuth, (req, res, next) => {
  req.io = io; // Attach io to the request object
  next();
}, messageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const response = {
    message: err.message || "Internal server error"
  };
  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }
  console.error("API error:", err);
  res.status(status).json(response);
});

const userPresence = new Map();

// Socket.io middleware with error handling
io.use((socket, next) => {
  try {
    socketAuthMiddleware(socket, next);
  } catch (error) {
    console.error('Socket auth middleware error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log('User connected:', socket.id);
  
  const { userId } = socket.data;
  if (userId) {
    userPresence.set(userId, socket.id);
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  }

  socket.on("conversation:join", (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
      console.log(`User ${userId} joined conversation: ${conversationId}`);
    }
  });

  socket.on("conversation:leave", (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
      console.log(`User ${userId} left conversation: ${conversationId}`);
    }
  });

  socket.on("message:new", ({ conversationId, message }) => {
    if (conversationId && message) {
      console.log(`New message in conversation ${conversationId} from user ${userId}`);
      socket.to(conversationId).emit("message:new", { conversationId, message });
    }
  });

  socket.on("disconnect", () => {
    console.log('User disconnected:', socket.id);
    if (userId) {
      userPresence.delete(userId);
    }
  });
});

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Chat API + Socket.IO are running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Clerk Authentication: Enabled`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});