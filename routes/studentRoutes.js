const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

router.use(protect);
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);
router.put('/change-password', studentController.changePassword);
router.get('/my-certificates', studentController.getMyCertificates);
router.get('/certificate/:id', studentController.getCertificate);
router.get('/download-certificate/:id', studentController.downloadCertificate);
// Add this line with your other routes
router.get('/progress', studentController.getProgress);
router.get('/applications', studentController.getApplications);
router.get('/notifications', studentController.getNotifications);
module.exports = router;