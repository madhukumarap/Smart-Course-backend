const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    certificateId: {
        type: String,
        required: true,
        unique: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    studentEmail: {
        type: String,
        required: true
    },
    courseName: {
        type: String,
        required: true
    },
    issueDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiryDate: {
        type: Date
    },
    grade: {
        type: String
    },
    certificateHash: {
        type: String,
        required: true,
        unique: true
    },
    blockchainTxHash: {
        type: String
    },
    isRevoked: {
        type: Boolean,
        default: false
    },
    qrCode: {
        type: String
    },
    metadata: {
        type: Map,
        of: String
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Certificate', certificateSchema);