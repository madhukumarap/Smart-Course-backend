const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { superAdmin } = require('../middleware/roleCheck');
const superAdminController = require('../controllers/superAdminController');
const { body } = require('express-validator');

// All routes require super admin access
router.use(protect, superAdmin);

// ==================== ROLE ROUTES ====================
router.get('/roles', superAdminController.getAllRoles);
router.get('/roles/:id', superAdminController.getRole);
router.post('/roles', [
    body('name').notEmpty().withMessage('Role name is required'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('level').optional().isInt({ min: 1, max: 100 })
], superAdminController.createRole);
router.put('/roles/:id', superAdminController.updateRole);
router.delete('/roles/:id', superAdminController.deleteRole);

// ==================== ADMIN MANAGEMENT ROUTES ====================
router.get('/admins', superAdminController.getAllAdmins);
router.post('/admins', [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], superAdminController.createAdmin);
router.put('/admins/:id', superAdminController.updateAdmin);
router.delete('/admins/:id', superAdminController.deleteAdmin);

// ==================== PERMISSION ROUTES ====================
router.get('/permissions', superAdminController.getAllPermissions);

// ==================== SYSTEM ROUTES ====================
router.post('/initialize', superAdminController.initializeSystem);
router.get('/stats', superAdminController.getSystemStats);

module.exports = router;