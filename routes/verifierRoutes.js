const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const verifierController = require('../controllers/verifierController');
const roleChecker = require('../middleware/roleCheck');

router.use(protect, roleChecker.hasPermission('verify_certificates'));

router.post('/verify', verifierController.verifyCertificate);
router.get('/verify/:hash', verifierController.getVerificationResult);
router.get('/logs', verifierController.getMyVerificationLogs);

module.exports = router;