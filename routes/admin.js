const express = require('express');
const User = require('../models/User');
const History = require('../models/History');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ─── GET /api/admin/dashboard ──────────────────────────────────────────────
// Dashboard stats
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            adminUsers,
            totalScripts,
            recentUsers,
            recentScripts,
            scriptsToday,
            usersThisMonth,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            User.countDocuments({ role: 'admin' }),
            History.countDocuments(),
            User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt isActive'),
            History.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('user', 'name email')
                .select('videoName totalLines format createdAt user'),
            History.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
            User.countDocuments({
                createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            }),
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                inactiveUsers: totalUsers - activeUsers,
                adminUsers,
                totalScripts,
                scriptsToday,
                usersThisMonth,
            },
            recentUsers,
            recentScripts,
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
    }
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────
// List all users with pagination + search
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const status = req.query.status || '';

        // Build filter
        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (role && ['user', 'admin'].includes(role)) filter.role = role;
        if (status === 'active') filter.isActive = true;
        if (status === 'inactive') filter.isActive = false;

        const [users, total] = await Promise.all([
            User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            users,
        });
    } catch (err) {
        console.error('Admin get users error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

// ─── GET /api/admin/users/:id ──────────────────────────────────────────────
// Get single user details + their history
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const histories = await History.find({ user: req.params.id })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('-script');

        res.status(200).json({ success: true, user, histories });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch user.' });
    }
});

// ─── PUT /api/admin/users/:id ──────────────────────────────────────────────
// Update user (name, role, isActive)
router.put('/users/:id', async (req, res) => {
    try {
        const { name, role, isActive } = req.body;

        // Prevent admin from deactivating themselves
        if (req.params.id === req.user._id.toString() && isActive === false) {
            return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (role !== undefined && ['user', 'admin'].includes(role)) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        const user = await User.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.status(200).json({ success: true, message: 'User updated.', user });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to update user.' });
    }
});

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────
// Delete user and all their history
router.delete('/users/:id', async (req, res) => {
    try {
        // Prevent admin from deleting themselves
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Delete all their history
        const deleted = await History.deleteMany({ user: req.params.id });

        res.status(200).json({
            success: true,
            message: `User deleted along with ${deleted.deletedCount} history records.`,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to delete user.' });
    }
});

// ─── PATCH /api/admin/users/:id/toggle-status ─────────────────────────────
// Quick toggle active/inactive
router.patch('/users/:id/toggle-status', async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot change your own status.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        user.isActive = !user.isActive;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'}.`,
            isActive: user.isActive,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ─── GET /api/admin/history ────────────────────────────────────────────────
// Get all scripts across all users (paginated)
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const userId = req.query.userId || null;

        const filter = userId ? { user: userId } : {};

        const [histories, total] = await Promise.all([
            History.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('user', 'name email')
                .select('-script'),
            History.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            histories,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch history.' });
    }
});

// ─── DELETE /api/admin/history/:id ────────────────────────────────────────
// Admin delete any history record
router.delete('/history/:id', async (req, res) => {
    try {
        const history = await History.findByIdAndDelete(req.params.id);
        if (!history) {
            return res.status(404).json({ success: false, message: 'History record not found.' });
        }
        res.status(200).json({ success: true, message: 'History record deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
