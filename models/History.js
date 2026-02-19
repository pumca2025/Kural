const mongoose = require('mongoose');

const scriptLineSchema = new mongoose.Schema(
    {
        startTime: String,
        endTime: String,
        person: String,
        emotion: String,
        originalMeaning: String,
        actionDescription: String,
        dialogue: String,
        versions: {
            spoken: String,
            tanglish: String,
            syncShort: String,
        },
    },
    { _id: false }
);

const historySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        videoName: {
            type: String,
            required: true,
            trim: true,
        },
        videoSize: {
            type: Number, // bytes
            default: 0,
        },
        videoType: {
            type: String,
            default: 'video/mp4',
        },
        format: {
            type: String,
            enum: ['tamil', 'tanglish'],
            default: 'tamil',
        },
        script: {
            type: [scriptLineSchema],
            default: [],
        },
        totalLines: {
            type: Number,
            default: 0,
        },
        duration: {
            type: String, // e.g., "2:34"
            default: null,
        },
        status: {
            type: String,
            enum: ['completed', 'failed', 'processing'],
            default: 'completed',
        },
        errorMessage: {
            type: String,
            default: null,
        },
        exportedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Auto-set totalLines from script array
historySchema.pre('save', function (next) {
    if (this.script) {
        this.totalLines = this.script.length;
    }
    next();
});

module.exports = mongoose.model('History', historySchema);
