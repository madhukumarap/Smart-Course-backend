const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const roleChecker = require('../middleware/roleCheck');
const courseController = require('../controllers/courseController');
const upload = require('../middleware/upload');

// ==================== COURSE ROUTES ====================

// Public routes
router.get('/', courseController.getAllCourses);
router.get('/teacher', protect, roleChecker.hasPermission('manage_certificates'), courseController.getTeacherCourses);
router.get('/:id', courseController.getCourse);

// Protected routes - require authentication
router.use(protect);

// Course management (teachers, admins)
router.post('/',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 }
    ]),
    courseController.createCourse
);

router.put('/:id',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 }
    ]),
    courseController.updateCourse
);

router.delete('/:id',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    courseController.deleteCourse
);

// Section management
router.post('/:courseId/sections',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    courseController.addSection
);

router.put('/:courseId/sections/:sectionId',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    courseController.updateSection
);

router.delete('/:courseId/sections/:sectionId',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    courseController.deleteSection
);

// Video management
router.post('/:courseId/sections/:sectionId/videos',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    upload.fields([{ name: 'video', maxCount: 1 }]),
    courseController.uploadVideo
);

router.delete('/:courseId/sections/:sectionId/videos/:videoId',
    roleChecker.hasAnyPermission(['manage_certificates', 'manage_roles']),
    courseController.deleteVideo
);

// Teacher assignment
router.post('/:courseId/teachers',
    roleChecker.hasPermission('manage_roles'),
    courseController.assignTeacher
);

router.delete('/:courseId/teachers/:teacherId',
    roleChecker.hasPermission('manage_roles'),
    courseController.removeTeacher
);

// Student enrollment and progress
router.post('/:courseId/enroll',
    roleChecker.hasPermission('view_progress'),
    courseController.enrollStudent
);

router.put('/:courseId/progress/:videoId',
    roleChecker.hasPermission('view_progress'),
    courseController.updateVideoProgress
);

router.get('/progress/me',
    roleChecker.hasPermission('view_progress'),
    courseController.getStudentProgress
);

// Analytics (for teachers/admins)
router.get('/:courseId/analytics',
    roleChecker.hasAnyPermission(['manage_certificates', 'view_analytics']),
    courseController.getCourseAnalytics
);

module.exports = router;