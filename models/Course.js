const mongoose = require('mongoose');

const courseSectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    order: {
        type: Number,
        required: true
    },
    videos: [{
        title: String,
        description: String,
        videoUrl: String, // Path to local video file
        duration: Number, // in seconds
        order: Number,
        isPublished: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    resources: [{
        title: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        maxLength: 200
    },
    category: {
        type: String,
        required: true,
        enum: ['programming', 'business', 'design', 'marketing', 'data-science', 'other']
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'all-levels'],
        default: 'beginner'
    },
    duration: {
        type: Number, // Total duration in minutes
        default: 0
    },
    thumbnail: {
        type: String // Path to thumbnail image
    },
    coverImage: {
        type: String // Path to cover image
    },
    price: {
        type: Number,
        default: 0
    },
    isFree: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTeachers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    sections: [courseSectionSchema],
    enrolledStudents: [{
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        enrolledAt: {
            type: Date,
            default: Date.now
        },
        progress: {
            type: Number,
            default: 0
        },
        completedVideos: [String], // Video IDs
        lastAccessed: Date,
        isCompleted: {
            type: Boolean,
            default: false
        },
        completedAt: Date
    }],
    prerequisites: [{
        type: String
    }],
    learningOutcomes: [{
        type: String
    }],
    requirements: [{
        type: String
    }],
    tags: [{
        type: String
    }],
    views: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update slug before save
courseSchema.pre('save', function(next) {
    this.slug = this.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');
    this.updatedAt = Date.now();
    next();
});

// Calculate total duration
courseSchema.methods.calculateDuration = function() {
    let total = 0;
    this.sections.forEach(section => {
        section.videos.forEach(video => {
            total += video.duration || 0;
        });
    });
    this.duration = Math.round(total / 60); // Convert to minutes
};

module.exports = mongoose.model('Course', courseSchema);