const Course = require('../models/Course');
const Video = require('../models/Video');
const StudentProgress = require('../models/StudentProgress');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// ==================== COURSE MANAGEMENT ====================

// Create course
exports.createCourse = async (req, res) => {
    try {
        const {
            title,
            description,
            shortDescription,
            category,
            level,
            price,
            isFree,
            prerequisites,
            learningOutcomes,
            requirements,
            tags
        } = req.body;

        // Check if course with same title exists
        const existingCourse = await Course.findOne({ 
            slug: title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-')
        });

        if (existingCourse) {
            return res.status(400).json({ message: 'Course with this title already exists' });
        }

        // Handle thumbnail upload
        let thumbnail = '';
        if (req.files?.thumbnail) {
            const file = req.files.thumbnail[0];
            thumbnail = `/uploads/courses/thumbnails/${file.filename}`;
        }

        // Handle cover image upload
        let coverImage = '';
if (req.files?.coverImage) {
    const file = req.files.coverImage[0];
    coverImage = `/uploads/courses/covers/${file.filename}`;
}
        const course = new Course({
            title,
            slug: title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'),
            description,
            shortDescription,
            category,
            level,
            price: isFree ? 0 : price,
            isFree,
            thumbnail,
            coverImage,
            prerequisites: prerequisites ? JSON.parse(prerequisites) : [],
            learningOutcomes: learningOutcomes ? JSON.parse(learningOutcomes) : [],
            requirements: requirements ? JSON.parse(requirements) : [],
            tags: tags ? JSON.parse(tags) : [],
            teacherId: req.user._id,
            createdBy: req.user._id
        });

        await course.save();

        res.status(201).json({
            message: 'Course created successfully',
            course
        });
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ message: 'Error creating course', error: error.message });
    }
};

// Get all courses
exports.getAllCourses = async (req, res) => {
    try {
        const { category, level, search, teacher } = req.query;
        let query = {};

        if (category) query.category = category;
        if (level) query.level = level;
        if (teacher) query.teacherId = teacher;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const courses = await Course.find(query)
            .populate('teacherId', 'name email')
            .populate('assignedTeachers', 'name email')
            .sort('-createdAt');

        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Error fetching courses', error: error.message });
    }
};

// Get single course
exports.getCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('teacherId', 'name email')
            .populate('assignedTeachers', 'name email')
            .populate('sections.videos');

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Increment views
        course.views += 1;
        await course.save();

        res.json(course);
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ message: 'Error fetching course', error: error.message });
    }
};

// Update course
exports.updateCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if user is authorized to update
        if (course.teacherId.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not authorized to update this course' });
        }

        const updateData = { ...req.body };

        // Handle file uploads
        if (req.files) {
            if (req.files.thumbnail) {
                const file = req.files.thumbnail;
                const fileName = `course-${Date.now()}-${file.name}`;
                const uploadPath = path.join(__dirname, '../../uploads/courses/thumbnails', fileName);
                
                await file.mv(uploadPath);
                updateData.thumbnail = `/uploads/courses/thumbnails/${fileName}`;
            }

            if (req.files.coverImage) {
                const file = req.files.coverImage;
                const fileName = `course-cover-${Date.now()}-${file.name}`;
                const uploadPath = path.join(__dirname, '../../uploads/courses/covers', fileName);
                
                await file.mv(uploadPath);
                updateData.coverImage = `/uploads/courses/covers/${fileName}`;
            }
        }

        // Parse JSON fields
        if (updateData.prerequisites) updateData.prerequisites = JSON.parse(updateData.prerequisites);
        if (updateData.learningOutcomes) updateData.learningOutcomes = JSON.parse(updateData.learningOutcomes);
        if (updateData.requirements) updateData.requirements = JSON.parse(updateData.requirements);
        if (updateData.tags) updateData.tags = JSON.parse(updateData.tags);

        Object.assign(course, updateData);
        await course.save();

        res.json({
            message: 'Course updated successfully',
            course
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ message: 'Error updating course', error: error.message });
    }
};

// Delete course
exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if user is authorized to delete
        if (course.teacherId.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not authorized to delete this course' });
        }

        // Delete associated videos from filesystem
        const videos = await Video.find({ courseId: course._id });
        videos.forEach(video => {
            const videoPath = path.join(__dirname, '../../', video.filePath);
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        });

        // Delete from database
        await Video.deleteMany({ courseId: course._id });
        await StudentProgress.deleteMany({ courseId: course._id });
        await course.deleteOne();

        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ message: 'Error deleting course', error: error.message });
    }
};

// ==================== SECTION MANAGEMENT ====================

// Add section
exports.addSection = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const { title, description } = req.body;
        const order = course.sections.length;

        course.sections.push({
            title,
            description,
            order,
            videos: []
        });

        await course.save();

        res.json({
            message: 'Section added successfully',
            section: course.sections[course.sections.length - 1]
        });
    } catch (error) {
        console.error('Error adding section:', error);
        res.status(500).json({ message: 'Error adding section', error: error.message });
    }
};

// Update section
exports.updateSection = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const section = course.sections.id(req.params.sectionId);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }

        section.title = req.body.title || section.title;
        section.description = req.body.description || section.description;
        section.updatedAt = Date.now();

        await course.save();

        res.json({
            message: 'Section updated successfully',
            section
        });
    } catch (error) {
        console.error('Error updating section:', error);
        res.status(500).json({ message: 'Error updating section', error: error.message });
    }
};

// Delete section
exports.deleteSection = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const section = course.sections.id(req.params.sectionId);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }

        // Delete associated videos from filesystem
        section.videos.forEach(video => {
            const videoPath = path.join(__dirname, '../../', video.videoUrl);
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        });

        // Remove section
        section.remove();
        await course.save();

        // Reorder remaining sections
        course.sections.forEach((sec, index) => {
            sec.order = index;
        });
        await course.save();

        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.status(500).json({ message: 'Error deleting section', error: error.message });
    }
};

// ==================== VIDEO MANAGEMENT ====================

// Upload video
exports.uploadVideo = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const section = course.sections.id(req.params.sectionId);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }

        if (!req.files || !req.files.video) {
            return res.status(400).json({ message: 'No video file uploaded' });
        }

        const videoFile = req.files.video;
        const { title, description } = req.body;

        // Validate video file
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (!allowedTypes.includes(videoFile.mimetype)) {
            return res.status(400).json({ message: 'Invalid video format. Only MP4, WebM, and OGG are allowed.' });
        }

        // Check file size (max 500MB)
        const maxSize = 500 * 1024 * 1024; // 500MB in bytes
        if (videoFile.size > maxSize) {
            return res.status(400).json({ message: 'Video file too large. Maximum size is 500MB.' });
        }

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../uploads/courses/videos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(videoFile.name);
        const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);
        const relativePath = `/uploads/courses/videos/${fileName}`;

        // Move file to upload directory
        await videoFile.mv(filePath);

        // Get video duration using ffmpeg (optional)
        let duration = 0;
        try {
            const metadata = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata);
                });
            });
            duration = metadata.format.duration;
        } catch (err) {
            console.warn('Could not get video duration:', err);
        }

        // Create video record
        const video = {
            title: title || videoFile.name,
            description,
            videoUrl: relativePath,
            duration: Math.round(duration),
            order: section.videos.length,
            fileSize: videoFile.size,
            mimeType: videoFile.mimetype
        };

        section.videos.push(video);
        await course.save();

        // Update course duration
        course.calculateDuration();
        await course.save();

        // Save to Video collection
        const videoDoc = new Video({
            title: video.title,
            description: video.description,
            fileName: videoFile.name,
            filePath: relativePath,
            fileSize: videoFile.size,
            duration: video.duration,
            mimeType: videoFile.mimetype,
            courseId: course._id,
            sectionId: section._id,
            uploadedBy: req.user._id
        });
        await videoDoc.save();

        res.status(201).json({
            message: 'Video uploaded successfully',
            video: section.videos[section.videos.length - 1]
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ message: 'Error uploading video', error: error.message });
    }
};

// Delete video
exports.deleteVideo = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const section = course.sections.id(req.params.sectionId);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }

        const video = section.videos.id(req.params.videoId);
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        // Delete video file from filesystem
        const videoPath = path.join(__dirname, '../../', video.videoUrl);
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }

        // Remove video
        video.remove();
        await course.save();

        // Reorder remaining videos
        section.videos.forEach((vid, index) => {
            vid.order = index;
        });
        await course.save();

        // Update course duration
        course.calculateDuration();
        await course.save();

        // Delete from Video collection
        await Video.deleteOne({ _id: video._id });

        res.json({ message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ message: 'Error deleting video', error: error.message });
    }
};

// ==================== TEACHER MANAGEMENT ====================

// Assign teacher to course
exports.assignTeacher = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const { teacherId } = req.body;
        const teacher = await User.findById(teacherId);

        if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
            return res.status(400).json({ message: 'Invalid teacher' });
        }

        if (!course.assignedTeachers.includes(teacherId)) {
            course.assignedTeachers.push(teacherId);
            await course.save();
        }

        res.json({
            message: 'Teacher assigned successfully',
            course
        });
    } catch (error) {
        console.error('Error assigning teacher:', error);
        res.status(500).json({ message: 'Error assigning teacher', error: error.message });
    }
};

// Remove teacher from course
exports.removeTeacher = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const { teacherId } = req.params;
        
        course.assignedTeachers = course.assignedTeachers.filter(
            id => id.toString() !== teacherId
        );
        await course.save();

        res.json({
            message: 'Teacher removed successfully',
            course
        });
    } catch (error) {
        console.error('Error removing teacher:', error);
        res.status(500).json({ message: 'Error removing teacher', error: error.message });
    }
};

// Get teacher's courses
exports.getTeacherCourses = async (req, res) => {
    try {
        const courses = await Course.find({
            $or: [
                { teacherId: req.user._id },
                { assignedTeachers: req.user._id }
            ]
        })
        .populate('teacherId', 'name email')
        .populate('assignedTeachers', 'name email')
        .sort('-createdAt');

        res.json(courses);
    } catch (error) {
        console.error('Error fetching teacher courses:', error);
        res.status(500).json({ message: 'Error fetching courses', error: error.message });
    }
};

// ==================== STUDENT PROGRESS ====================

// Enroll student in course
exports.enrollStudent = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const studentId = req.user._id;

        // Check if already enrolled
        const existingEnrollment = course.enrolledStudents.find(
            e => e.studentId.toString() === studentId.toString()
        );

        if (existingEnrollment) {
            return res.status(400).json({ message: 'Already enrolled in this course' });
        }

        // Add to enrolled students
        course.enrolledStudents.push({
            studentId,
            enrolledAt: new Date()
        });
        await course.save();

        // Create progress record
        const progress = new StudentProgress({
            studentId,
            courseId: course._id,
            enrolledAt: new Date()
        });
        await progress.save();

        res.json({
            message: 'Successfully enrolled in course',
            progress
        });
    } catch (error) {
        console.error('Error enrolling student:', error);
        res.status(500).json({ message: 'Error enrolling student', error: error.message });
    }
};

// Update video progress
exports.updateVideoProgress = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        const { watchTime, completed } = req.body;

        let progress = await StudentProgress.findOne({
            studentId: req.user._id,
            courseId
        });

        if (!progress) {
            return res.status(404).json({ message: 'Progress record not found' });
        }

        // Update video completion
        const videoRecord = progress.completedVideos.find(
            v => v.videoId.toString() === videoId
        );

        if (videoRecord) {
            videoRecord.watchTime = watchTime;
            if (completed) {
                videoRecord.completedAt = new Date();
            }
        } else {
            progress.completedVideos.push({
                videoId,
                watchTime,
                completedAt: completed ? new Date() : null
            });
        }

        // Calculate overall progress
        const course = await Course.findById(courseId);
        const totalVideos = course.sections.reduce(
            (acc, section) => acc + section.videos.length, 0
        );
        
        progress.progress = (progress.completedVideos.length / totalVideos) * 100;

        if (progress.progress >= 100) {
            progress.isCompleted = true;
            progress.completedAt = new Date();
        }

        progress.lastWatchedVideo = videoId;
        progress.watchTime += watchTime;
        await progress.save();

        res.json({
            message: 'Progress updated',
            progress
        });
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ message: 'Error updating progress', error: error.message });
    }
};

// Get student progress
exports.getStudentProgress = async (req, res) => {
    try {
        const progress = await StudentProgress.find({ studentId: req.user._id })
            .populate('courseId', 'title thumbnail duration')
            .sort('-lastAccessed');

        res.json(progress);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ message: 'Error fetching progress', error: error.message });
    }
};

// Get course analytics for teacher
exports.getCourseAnalytics = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check authorization
        if (course.teacherId.toString() !== req.user._id.toString() && 
            !course.assignedTeachers.includes(req.user._id) &&
            req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const enrollments = await StudentProgress.find({ courseId })
            .populate('studentId', 'name email');

        const totalStudents = enrollments.length;
        const completedStudents = enrollments.filter(e => e.isCompleted).length;
        const averageProgress = enrollments.reduce((acc, e) => acc + e.progress, 0) / totalStudents || 0;

        // Video analytics
        const videoStats = [];
        for (const section of course.sections) {
            for (const video of section.videos) {
                const views = enrollments.reduce((acc, e) => {
                    return acc + (e.completedVideos.some(v => v.videoId.toString() === video._id.toString()) ? 1 : 0);
                }, 0);
                
                videoStats.push({
                    videoId: video._id,
                    title: video.title,
                    views,
                    completionRate: (views / totalStudents) * 100 || 0
                });
            }
        }

        res.json({
            totalStudents,
            completedStudents,
            completionRate: (completedStudents / totalStudents) * 100 || 0,
            averageProgress,
            videoStats,
            enrollments: enrollments.map(e => ({
                student: e.studentId,
                progress: e.progress,
                lastAccessed: e.lastAccessed,
                isCompleted: e.isCompleted
            }))
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ message: 'Error fetching analytics', error: error.message });
    }
};