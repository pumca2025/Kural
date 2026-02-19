const express = require('express');
const History = require('../models/History');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All history routes require authentication
router.use(protect);

// ─── POST /api/history ─────────────────────────────────────────────────────
// Save a new script generation to history
router.post('/', async (req, res) => {
    try {
        const { videoName, videoSize, videoType, format, script, duration } = req.body;

        if (!videoName || !script || !Array.isArray(script)) {
            return res.status(400).json({
                success: false,
                message: 'videoName and script array are required.',
            });
        }

        const history = await History.create({
            user: req.user._id,
            videoName,
            videoSize: videoSize || 0,
            videoType: videoType || 'video/mp4',
            format: format || 'tamil',
            script,
            duration: duration || null,
            status: 'completed',
        });

        // Increment user's script count
        await User.findByIdAndUpdate(req.user._id, { $inc: { scriptsGenerated: 1 } });

        res.status(201).json({
            success: true,
            message: 'Script saved to history.',
            history: {
                id: history._id,
                videoName: history.videoName,
                totalLines: history.totalLines,
                format: history.format,
                createdAt: history.createdAt,
            },
        });
    } catch (err) {
        console.error('Save history error:', err);
        res.status(500).json({ success: false, message: 'Failed to save history.' });
    }
});

// ─── GET /api/history ──────────────────────────────────────────────────────
// Get current user's history (paginated)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [histories, total] = await Promise.all([
            History.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-script'), // Don't return full script in list view
            History.countDocuments({ user: req.user._id }),
        ]);

        res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            histories,
        });
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch history.' });
    }
});

// ─── GET /api/history/:id ──────────────────────────────────────────────────
// Get a single history entry with full script
router.get('/:id', async (req, res) => {
    try {
        const history = await History.findOne({
            _id: req.params.id,
            user: req.user._id, // Ensure user owns this record
        });

        if (!history) {
            return res.status(404).json({ success: false, message: 'History record not found.' });
        }

        res.status(200).json({ success: true, history });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid history ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch history.' });
    }
});

// ─── PATCH /api/history/:id/export ────────────────────────────────────────
// Mark a history entry as exported
router.patch('/:id/export', async (req, res) => {
    try {
        const history = await History.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { exportedAt: new Date() },
            { new: true }
        );

        if (!history) {
            return res.status(404).json({ success: false, message: 'History record not found.' });
        }

        res.status(200).json({ success: true, message: 'Marked as exported.', exportedAt: history.exportedAt });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ─── DELETE /api/history/:id ───────────────────────────────────────────────
// Delete a history entry
router.delete('/:id', async (req, res) => {
    try {
        const history = await History.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!history) {
            return res.status(404).json({ success: false, message: 'History record not found.' });
        }

        res.status(200).json({ success: true, message: 'History deleted.' });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid history ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to delete history.' });
    }
});

// ─── DELETE /api/history ───────────────────────────────────────────────────
// Clear all history for current user
router.delete('/', async (req, res) => {
    try {
        const result = await History.deleteMany({ user: req.user._id });
        res.status(200).json({
            success: true,
            message: `Cleared ${result.deletedCount} history records.`,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to clear history.' });
    }
});

module.exports = router;
