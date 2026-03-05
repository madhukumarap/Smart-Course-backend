const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
    certificateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Certificate',
        required: false
    },
    certificateHash: {
        type: String,
        required: true,
        index: true
    },
    verifierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    verifierAddress: {
        type: String,
        sparse: true
    },
    isValid: {
        type: Boolean,
        required: true,
        default: false
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    blockchainVerified: {
        type: Boolean,
        default: false
    },
    mockVerification: {
        type: Boolean,
        default: false
    },
    failureReason: {
        type: String
    },
    verifiedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
verificationLogSchema.index({ verifierId: 1, verifiedAt: -1 });
verificationLogSchema.index({ certificateHash: 1 });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);