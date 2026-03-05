const Certificate = require('../models/Certificate');
const User = require('../models/User');
const PDFDocument = require('pdfkit');

exports.getMyCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find({ studentId: req.user._id })
            .sort('-createdAt');
        
        res.json(certificates);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching certificates', error: error.message });
    }
};

exports.getCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findOne({
            _id: req.params.id,
            studentId: req.user._id
        });
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }
        
        res.json(certificate);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching certificate', error: error.message });
    }
};

exports.downloadCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findOne({
            _id: req.params.id,
            studentId: req.user._id
        });
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Generate PDF certificate
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificate-${certificate.certificateId}.pdf`);

        doc.pipe(res);

        // Add certificate content
        doc.fontSize(25).text('Certificate of Completion', { align: 'center' });
        doc.moveDown();
        doc.fontSize(18).text('This is to certify that', { align: 'center' });
        doc.moveDown();
        doc.fontSize(22).text(certificate.studentName, { align: 'center' });
        doc.moveDown();
        doc.fontSize(18).text('has successfully completed', { align: 'center' });
        doc.moveDown();
        doc.fontSize(20).text(certificate.courseName, { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Certificate ID: ${certificate.certificateId}`, { align: 'center' });
        doc.fontSize(12).text(`Hash: ${certificate.certificateHash}`, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error downloading certificate', error: error.message });
    }
};

// Update profile information
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, address, department, bio, github, linkedin, twitter } = req.body;
        
        // Find user and update
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields
        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        user.department = department || user.department;
        user.bio = bio || user.bio;
        user.github = github || user.github;
        user.linkedin = linkedin || user.linkedin;
        user.twitter = twitter || user.twitter;

        await user.save();

        // Return updated user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ 
            message: 'Profile updated successfully', 
            user: userResponse 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide current and new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        // Find user
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error changing password', error: error.message });
    }
};

// Get profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};
// Get student progress data
exports.getProgress = async (req, res) => {
    try {
        const studentId = req.user._id;
        
        // Get all certificates for this student
        const certificates = await Certificate.find({ studentId });
        
        // Calculate completed courses (total certificates)
        const completedCourses = certificates.length;
        
        // Calculate average grade from certificates that have grades
        let totalGrade = 0;
        let gradeCount = 0;
        
        certificates.forEach(cert => {
            if (cert.grade) {
                // Try to parse grade as number (remove % if present)
                const gradeValue = parseFloat(cert.grade.toString().replace('%', ''));
                if (!isNaN(gradeValue)) {
                    totalGrade += gradeValue;
                    gradeCount++;
                }
            }
        });
        
        const averageGrade = gradeCount > 0 ? (totalGrade / gradeCount).toFixed(1) : 0;
        
        // Calculate achievements based on certificates
        const achievements = [];
        
        if (completedCourses >= 1) {
            achievements.push({
                title: 'First Certificate',
                date: certificates[0]?.issueDate 
                    ? new Date(certificates[0].issueDate).toLocaleDateString() 
                    : new Date().toLocaleDateString(),
                icon: '🎓'
            });
        }
        
        if (completedCourses >= 3) {
            achievements.push({
                title: 'Triple Achievement',
                date: new Date().toLocaleDateString(),
                icon: '🏆'
            });
        }
        
        if (completedCourses >= 5) {
            achievements.push({
                title: 'Scholar',
                date: new Date().toLocaleDateString(),
                icon: '⭐'
            });
        }
        
        if (averageGrade >= 90) {
            achievements.push({
                title: 'Excellent Student',
                date: new Date().toLocaleDateString(),
                icon: '🌟'
            });
        }
        
        // Get recent activities (you can fetch from VerificationLog if needed)
        const recentActivities = certificates.slice(0, 5).map(cert => ({
            description: 'Certificate Issued',
            course: cert.courseName,
            date: new Date(cert.issueDate).toLocaleDateString(),
            type: 'success'
        }));

        res.json({
            completedCourses,
            inProgressCourses: 0, // You can add course tracking later
            totalHours: completedCourses * 40, // Estimate 40 hours per course
            averageGrade,
            achievements,
            recentActivities
        });
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ 
            message: 'Error fetching progress', 
            error: error.message 
        });
    }
};

// Get student applications (mock data for now)
exports.getApplications = async (req, res) => {
    try {
        // Mock applications data - you can connect to a real applications collection later
        const mockApplications = [
            {
                title: 'Software Engineering Intern',
                organization: 'Google',
                status: 'pending',
                appliedDate: new Date(),
                description: 'Summer internship program'
            },
            {
                title: 'Junior Developer',
                organization: 'Microsoft',
                status: 'approved',
                appliedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                description: 'Full-time position'
            },
            {
                title: 'Research Assistant',
                organization: 'University Lab',
                status: 'rejected',
                appliedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                description: 'Part-time research position'
            }
        ];
        
        res.json(mockApplications);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ message: 'Error fetching applications', error: error.message });
    }
};

// Get notifications
exports.getNotifications = async (req, res) => {
    try {
        // Mock notifications - you can create a notifications collection later
        const mockNotifications = [
            {
                type: 'certificate',
                message: 'New certificate issued',
                time: '2 hours ago'
            },
            {
                type: 'info',
                message: 'Your profile has been updated',
                time: '1 day ago'
            },
            {
                type: 'success',
                message: 'Certificate verified successfully',
                time: '2 days ago'
            }
        ];
        
        res.json(mockNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};
