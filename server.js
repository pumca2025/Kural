require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Route imports
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────

// CORS - allow frontend origins
app.use(cors());
// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (dev only)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting - global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many auth attempts. Please try again in 15 minutes.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'KuralDub API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found.`,
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error.',
    });
});

// ─── Database Connection ──────────────────────────────────────────────────

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

// ─── Start Server ─────────────────────────────────────────────────────────

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 KuralDub API running on http://localhost:${PORT}`);
        console.log(`📋 Environment: ${process.env.NODE_ENV}`);
        console.log(`\n📌 Available endpoints:`);
        console.log(`   POST   /api/auth/register`);
        console.log(`   POST   /api/auth/login`);
        console.log(`   GET    /api/auth/me`);
        console.log(`   PUT    /api/auth/update-profile`);
        console.log(`   PUT    /api/auth/change-password`);
        console.log(`   POST   /api/history`);
        console.log(`   GET    /api/history`);
        console.log(`   GET    /api/history/:id`);
        console.log(`   PATCH  /api/history/:id/export`);
        console.log(`   DELETE /api/history/:id`);
        console.log(`   DELETE /api/history`);
        console.log(`   GET    /api/admin/dashboard`);
        console.log(`   GET    /api/admin/users`);
        console.log(`   GET    /api/admin/users/:id`);
        console.log(`   PUT    /api/admin/users/:id`);
        console.log(`   DELETE /api/admin/users/:id`);
        console.log(`   PATCH  /api/admin/users/:id/toggle-status`);
        console.log(`   GET    /api/admin/history`);
        console.log(`   DELETE /api/admin/history/:id`);
        console.log(`   GET    /api/health\n`);
    });
});


