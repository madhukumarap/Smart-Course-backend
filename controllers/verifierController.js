const Certificate = require('../models/Certificate');
const VerificationLog = require('../models/VerificationLog');
const blockchainService = require('../utils/blockchain');

exports.verifyCertificate = async (req, res) => {
    try {
        const { certificateHash } = req.body;

        // Validate hash format
        if (!certificateHash || typeof certificateHash !== 'string') {
            return res.status(400).json({ 
                isValid: false, 
                message: 'Invalid certificate hash format' 
            });
        }

        // Check database first
        const certificate = await Certificate.findOne({ certificateHash });
        
        if (!certificate) {
            // Log the failed verification attempt
            await VerificationLog.create({
                certificateHash,
                verifierId: req.user._id,
                isValid: false,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                failureReason: 'Certificate not found in database'
            });

            return res.json({
                isValid: false,
                message: 'Certificate not found in database',
                blockchainVerification: null
            });
        }

        // Check if certificate is revoked
        if (certificate.isRevoked) {
            await VerificationLog.create({
                certificateId: certificate._id,
                certificateHash,
                verifierId: req.user._id,
                isValid: false,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                failureReason: 'Certificate has been revoked'
            });

            return res.json({
                isValid: false,
                message: 'Certificate has been revoked',
                certificate: {
                    studentName: certificate.studentName,
                    courseName: certificate.courseName,
                    issueDate: certificate.issueDate,
                    grade: certificate.grade
                },
                blockchainVerification: null
            });
        }

        // Verify on blockchain with error handling
        let blockchainVerification = {
            isValid: false,
            message: 'Blockchain verification skipped',
            mock: true
        };

        try {
            blockchainVerification = await blockchainService.verifyCertificate(certificateHash);
        } catch (blockchainError) {
            console.error('Blockchain verification error:', blockchainError.message);
            // Continue with database verification only
            blockchainVerification = {
                isValid: true, // Assume valid for database-only verification
                message: 'Using database verification only',
                error: blockchainError.message,
                mock: true
            };
        }

        // Determine overall validity
        const isValid = !certificate.isRevoked && 
                       (blockchainVerification.isValid || blockchainVerification.mock);

        // Create verification log
        await VerificationLog.create({
            certificateId: certificate._id,
            certificateHash,
            verifierId: req.user._id,
            verifierAddress: req.user.walletAddress,
            isValid: isValid,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            blockchainVerified: blockchainVerification.isValid && !blockchainVerification.mock,
            mockVerification: blockchainVerification.mock || false
        });

        res.json({
            isValid: isValid,
            message: isValid ? 'Certificate is valid' : 'Certificate verification failed',
            certificate: {
                studentName: certificate.studentName,
                courseName: certificate.courseName,
                issueDate: certificate.issueDate,
                grade: certificate.grade,
                certificateId: certificate.certificateId,
                isRevoked: certificate.isRevoked
            },
            blockchainVerification: {
                isValid: blockchainVerification.isValid,
                message: blockchainVerification.message,
                mock: blockchainVerification.mock || false
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        
        // Log the error but don't expose internal details
        res.status(500).json({ 
            isValid: false,
            message: 'Error verifying certificate',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getVerificationResult = async (req, res) => {
    try {
        const { hash } = req.params;
        
        if (!hash) {
            return res.status(400).json({ isValid: false, message: 'Hash is required' });
        }

        const certificate = await Certificate.findOne({ certificateHash: hash });
        
        if (!certificate) {
            return res.json({ 
                isValid: false, 
                message: 'Certificate not found' 
            });
        }

        res.json({
            isValid: !certificate.isRevoked,
            message: !certificate.isRevoked ? 'Certificate is valid' : 'Certificate has been revoked',
            certificate: {
                studentName: certificate.studentName,
                courseName: certificate.courseName,
                issueDate: certificate.issueDate,
                grade: certificate.grade,
                certificateId: certificate.certificateId
            }
        });
    } catch (error) {
        console.error('Error fetching verification:', error);
        res.status(500).json({ 
            isValid: false,
            message: 'Error fetching verification',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getMyVerificationLogs = async (req, res) => {
    try {
        const logs = await VerificationLog.find({ verifierId: req.user._id })
            .populate('certificateId', 'studentName courseName certificateId')
            .sort('-verifiedAt')
            .limit(100); // Limit to last 100 logs
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ 
            message: 'Error fetching logs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};