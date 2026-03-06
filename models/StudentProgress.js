const mongoose = require('mongoose');

const studentProgressSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    },
    completedVideos: [{
        videoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Video'
        },
        completedAt: Date,
        watchTime: Number // seconds watched
    }],
    lastWatchedVideo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video'
    },
    lastWatchedSection: {
        type: mongoose.Schema.Types.ObjectId
    },
    watchTime: {
        type: Number,
        default: 0 // total seconds watched
    },
    progress: {
        type: Number,
        default: 0, // percentage
        min: 0,
        max: 100
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    completedAt: Date,
    certificateIssued: {
        type: Boolean,
        default: false
    },
    certificateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Certificate'
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    notes: [{
        videoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Video'
        },
        content: String,
        timestamp: Number, // video timestamp
        createdAt: Date
    }],
    quizzes: [{
        quizId: String,
        score: Number,
        passed: Boolean,
        attempts: Number,
        completedAt: Date
    }]
});

// Update progress before save
studentProgressSchema.pre('save', function(next) {
    this.lastAccessed = Date.now();
    next();
});

module.exports = mongoose.model('StudentProgress', studentProgressSchema);