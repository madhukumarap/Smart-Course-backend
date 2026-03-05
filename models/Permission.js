const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    module: {
        type: String,
        enum: [
            'users', 
            'roles', 
            'certificates', 
            'verifiers', 
            'analytics', 
            'logs', 
            'profile', 
            'dashboard',
            'applications', 
            'progress',
            'system'  // Added for system-wide permissions
        ],
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Permission', permissionSchema);