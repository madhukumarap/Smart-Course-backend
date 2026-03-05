const express = require('express');
const router = express.Router();
const { protect, } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { body } = require('express-validator');
const  roleChecker  = require('../middleware/roleCheck');

router.use(protect, roleChecker.admin);

// Certificate routes
router.post('/issue-certificate', [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('courseName').notEmpty().withMessage('Course name is required'),
    body('grade').optional(),
    body('expiryDate').optional().isISO8601()
], adminController.issueCertificate);

router.get('/certificates', adminController.getAllCertificates);
router.get('/certificate/:id', adminController.getCertificate);
router.put('/revoke-certificate/:id', adminController.revokeCertificate);
router.get('/download-certificate/:id', adminController.downloadCertificate);
// Student management routes
router.get('/students', adminController.getStudents);
router.post('/add-student', [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional(),
    body('address').optional(),
    body('department').optional(),
    body('enrollmentDate').optional().isISO8601()
], adminController.addStudent);

// Verifier management
router.post('/add-verifier', adminController.addVerifier);

// Logs
router.get('/verification-logs', adminController.getVerificationLogs);

// Stats
router.get('/stats', adminController.getStats);
// Add this line with your other routes
router.get('/analytics', adminController.getAnalytics);
// Add these with your other routes
router.get('/realtime-stats', adminController.getRealTimeStats);
router.get('/certificate-analytics', adminController.getCertificateAnalytics);
module.exports = router;