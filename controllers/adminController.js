const Certificate = require('../models/Certificate');
const User = require('../models/User');
const VerificationLog = require('../models/VerificationLog');
const blockchainService = require('../utils/blockchain');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Issue Certificate
exports.issueCertificate = async (req, res) => {
    try {
        const { studentId, courseName, grade, expiryDate } = req.body;

        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Generate unique certificate hash
        const certificateHash = crypto
            .createHash('sha256')
            .update(`${studentId}-${courseName}-${Date.now()}`)
            .digest('hex');

        // Generate QR code
        const qrCodeData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${certificateHash}`;
        const qrCode = await QRCode.toDataURL(qrCodeData);

        // Issue on blockchain
        const txReceipt = await blockchainService.issueCertificate(
            student.name,
            courseName,
            new Date().toISOString(),
            certificateHash
        );

        // Save to database
        const certificate = await Certificate.create({
            certificateId: `CERT-${Date.now()}`,
            studentId: student._id,
            studentName: student.name,
            studentEmail: student.email,
            courseName,
            grade,
            expiryDate,
            certificateHash,
            blockchainTxHash: txReceipt.transactionHash,
            qrCode,
            issuedBy: req.user._id
        });

        res.status(201).json({
            message: 'Certificate issued successfully',
            certificate
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error issuing certificate', error: error.message });
    }
};

// Get all certificates
exports.getAllCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find()
            .populate('studentId', 'name email')
            .populate('issuedBy', 'name email')
            .sort('-createdAt');
        
        res.json(certificates);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching certificates', error: error.message });
    }
};

// Get single certificate
exports.getCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id)
            .populate('studentId', 'name email')
            .populate('issuedBy', 'name email');
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }
        
        res.json(certificate);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching certificate', error: error.message });
    }
};

// Revoke certificate
exports.revokeCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Check if already revoked
        if (certificate.isRevoked) {
            return res.status(400).json({ message: 'Certificate is already revoked' });
        }

        let blockchainResult = null;
        let blockchainError = null;

        // Try to revoke on blockchain, but don't fail if it doesn't work
        try {
            blockchainResult = await blockchainService.revokeCertificate(certificate.certificateHash);
            console.log('Blockchain revocation result:', blockchainResult);
        } catch (error) {
            blockchainError = error.message;
            console.error('Blockchain revocation failed (continuing with database revocation):', error.message);
        }

        // Update database regardless of blockchain success
        certificate.isRevoked = true;
        certificate.revokedAt = new Date();
        certificate.revokedBy = req.user._id;
        certificate.revocationReason = req.body.reason || 'Revoked by administrator';
        
        // Store blockchain transaction hash if available
        if (blockchainResult && blockchainResult.transactionHash) {
            certificate.blockchainRevokeTxHash = blockchainResult.transactionHash;
        }

        await certificate.save();

        // Create audit log
        await VerificationLog.create({
            certificateId: certificate._id,
            certificateHash: certificate.certificateHash,
            verifierId: req.user._id,
            action: 'REVOKE',
            isValid: false,
            details: {
                blockchainSuccess: !blockchainError,
                blockchainError: blockchainError,
                reason: req.body.reason || 'Revoked by administrator'
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            message: blockchainError 
                ? 'Certificate revoked in database only (blockchain revocation failed)'
                : 'Certificate revoked successfully',
            certificate: {
                id: certificate._id,
                certificateId: certificate.certificateId,
                isRevoked: certificate.isRevoked,
                revokedAt: certificate.revokedAt
            },
            blockchain: blockchainResult || { error: blockchainError, mock: true }
        });

    } catch (error) {
        console.error('Error revoking certificate:', error);
        res.status(500).json({ 
            message: 'Error revoking certificate', 
            error: error.message 
        });
    }
};

// Get all students
exports.getStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching students', error: error.message });
    }
};

// Add new student
exports.addStudent = async (req, res) => {
    try {
        const { name, email, password, phone, address, department, enrollmentDate } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create new student
        const student = await User.create({
            name,
            email,
            password: password || 'Welcome123', // Default password if not provided
            role: 'student',
            phone,
            address,
            department,
            enrollmentDate: enrollmentDate || Date.now()
        });

        // Remove password from response
        const studentResponse = student.toObject();
        delete studentResponse.password;

        res.status(201).json({
            message: 'Student added successfully',
            student: studentResponse
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding student', error: error.message });
    }
};

// Add verifier
exports.addVerifier = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.role = 'verifier';
        await user.save();

        res.json({ message: 'Verifier added successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding verifier', error: error.message });
    }
};

// Get verification logs
exports.getVerificationLogs = async (req, res) => {
    try {
        const logs = await VerificationLog.find()
            .populate('certificateId')
            .populate('verifierId', 'name email')
            .sort('-verifiedAt');
        
        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching logs', error: error.message });
    }
};

// Get dashboard stats
exports.getStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalCertificates = await Certificate.countDocuments();
        const activeCertificates = await Certificate.countDocuments({ isRevoked: false });
        const revokedCertificates = await Certificate.countDocuments({ isRevoked: true });
        
        // Get today's verifications
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const verificationsToday = await VerificationLog.countDocuments({
            verifiedAt: { $gte: today }
        });

        res.json({
            totalStudents,
            totalCertificates,
            activeCertificates,
            revokedCertificates,
            verificationsToday
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats', error: error.message });
    }
};

// Download certificate (admin version)
exports.downloadCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Generate PDF certificate
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            layout: 'landscape',
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificate-${certificate.certificateId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add decorative border
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#4f46e5', 2);

        // Add certificate content
        doc.fontSize(30)
           .font('Helvetica-Bold')
           .fillColor('#4f46e5')
           .text('CERTIFICATE OF COMPLETION', { align: 'center' })
           .moveDown(1.5);

        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#374151')
           .text('This is to certify that', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(32)
           .font('Helvetica-Bold')
           .fillColor('#111827')
           .text(certificate.studentName, { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#374151')
           .text('has successfully completed the course', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor('#4f46e5')
           .text(certificate.courseName, { align: 'center' })
           .moveDown(1);

        if (certificate.grade) {
            doc.fontSize(16)
               .font('Helvetica')
               .fillColor('#374151')
               .text(`with Grade: ${certificate.grade}`, { align: 'center' })
               .moveDown(0.5);
        }

        doc.moveDown(1);

        // Issue date
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#6B7280')
           .text(`Issue Date: ${new Date(certificate.issueDate).toLocaleDateString()}`, { align: 'center' });

        if (certificate.expiryDate) {
            doc.text(`Expiry Date: ${new Date(certificate.expiryDate).toLocaleDateString()}`, { align: 'center' });
        }

        doc.moveDown(2);

        // Certificate details
        doc.fontSize(10)
           .font('Helvetica-Oblique')
           .fillColor('#9CA3AF')
           .text(`Certificate ID: ${certificate.certificateId}`, { align: 'center' })
           .text(`Hash: ${certificate.certificateHash.substring(0, 20)}...`, { align: 'center' });

        // Add signature line
        doc.moveDown(2);
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#111827')
           .text('Authorized Signature', 100, doc.page.height - 150)
           .moveTo(100, doc.page.height - 140)
           .lineTo(250, doc.page.height - 140)
           .stroke('#4f46e5');

        // Add seal/stamp
        doc.circle(doc.page.width - 150, doc.page.height - 150, 40)
           .fillAndStroke('#f3f4f6', '#4f46e5');
        doc.fontSize(10)
           .fillColor('#4f46e5')
           .text('OFFICIAL SEAL', doc.page.width - 170, doc.page.height - 160, { width: 60, align: 'center' });

        // Finalize the PDF
        doc.end();

        // Log the download action
        console.log(`Certificate ${certificate.certificateId} downloaded by admin ${req.user._id}`);
        
    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({ message: 'Error downloading certificate', error: error.message });
    }
};

// Add this method to your existing adminController
exports.getAnalytics = async (req, res) => {
    try {
        const { range } = req.query; // week, month, quarter, year
        
        // Get date range based on query parameter
        const endDate = new Date();
        let startDate = new Date();
        
        switch(range) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(startDate.getMonth() - 1); // default to month
        }

        // Fetch all required data in parallel
        const [
            totalStudents,
            totalCertificates,
            activeCertificates,
            revokedCertificates,
            issuanceTrend,
            verificationActivity,
            topCourses,
            departmentStats,
            peakHours,
            performanceMetrics
        ] = await Promise.all([
            // Total students count
            User.countDocuments({ role: 'student' }),
            
            // Total certificates count
            Certificate.countDocuments(),
            
            // Active certificates count
            Certificate.countDocuments({ isRevoked: false }),
            
            // Revoked certificates count
            Certificate.countDocuments({ isRevoked: true }),
            
            // Issuance trend (group by month)
            Certificate.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        certificates: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1 }
                },
                {
                    $project: {
                        month: {
                            $concat: [
                                { $toString: '$_id.year' },
                                '-',
                                { $toString: '$_id.month' }
                            ]
                        },
                        certificates: 1,
                        _id: 0
                    }
                }
            ]),
            
            // Verification activity
            VerificationLog.aggregate([
                {
                    $match: {
                        verifiedAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$verifiedAt' },
                            month: { $month: '$verifiedAt' },
                            day: { $dayOfMonth: '$verifiedAt' }
                        },
                        verifications: { $sum: 1 },
                        validVerifications: {
                            $sum: { $cond: ['$isValid', 1, 0] }
                        }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                }
            ]),
            
            // Top courses
            Certificate.aggregate([
                {
                    $group: {
                        _id: '$courseName',
                        count: { $sum: 1 },
                        avgGrade: { $avg: '$grade' }
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $limit: 10
                }
            ]),
            
            // Department statistics
            User.aggregate([
                {
                    $match: { role: 'student' }
                },
                {
                    $lookup: {
                        from: 'certificates',
                        localField: '_id',
                        foreignField: 'studentId',
                        as: 'studentCertificates'
                    }
                },
                {
                    $group: {
                        _id: '$department',
                        studentCount: { $sum: 1 },
                        totalCertificates: { $sum: { $size: '$studentCertificates' } },
                        avgGrade: { $avg: '$studentCertificates.grade' }
                    }
                }
            ]),
            
            // Peak hours (for the last 30 days)
            VerificationLog.aggregate([
                {
                    $match: {
                        verifiedAt: {
                            $gte: new Date(new Date().setDate(new Date().getDate() - 30))
                        }
                    }
                },
                {
                    $group: {
                        _id: { $hour: '$verifiedAt' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id': 1 }
                }
            ]),
            
            // Performance metrics
            Promise.all([
                Certificate.aggregate([
                    {
                        $group: {
                            _id: null,
                            avgGrade: { $avg: '$grade' },
                            maxGrade: { $max: '$grade' },
                            minGrade: { $min: '$grade' }
                        }
                    }
                ]),
                VerificationLog.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalVerifications: { $sum: 1 },
                            validVerifications: {
                                $sum: { $cond: ['$isValid', 1, 0] }
                            }
                        }
                    }
                ])
            ])
        ]);

        // Format the response
        const analyticsData = {
            summary: {
                totalStudents,
                totalCertificates,
                activeCertificates,
                revokedCertificates,
                activePercentage: totalCertificates > 0 
                    ? ((activeCertificates / totalCertificates) * 100).toFixed(1)
                    : 0
            },
            issuanceTrend: issuanceTrend.map(item => ({
                month: item.month,
                certificates: item.certificates
            })),
            verificationActivity: verificationActivity.map(item => ({
                date: `${item._id.year}-${item._id.month}-${item._id.day}`,
                total: item.verifications,
                valid: item.validVerifications,
                invalid: item.verifications - item.validVerifications
            })),
            topCourses: topCourses.map((course, index) => ({
                name: course._id,
                count: course.count,
                avgGrade: course.avgGrade?.toFixed(1) || 'N/A',
                rank: index + 1
            })),
            departmentStats: departmentStats.map(dept => ({
                department: dept._id || 'Not Specified',
                students: dept.studentCount,
                certificates: dept.totalCertificates,
                avgGrade: dept.avgGrade?.toFixed(1) || 'N/A'
            })),
            peakHours: peakHours.map(hour => ({
                hour: `${hour._id}:00`,
                verifications: hour.count
            })),
            performanceMetrics: {
                grades: performanceMetrics[0][0] || {
                    avgGrade: 0,
                    maxGrade: 0,
                    minGrade: 0
                },
                verifications: performanceMetrics[1][0] || {
                    totalVerifications: 0,
                    validVerifications: 0
                },
                successRate: performanceMetrics[1][0] 
                    ? ((performanceMetrics[1][0].validVerifications / performanceMetrics[1][0].totalVerifications) * 100).toFixed(1)
                    : 0
            }
        };

        res.json(analyticsData);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ 
            message: 'Error fetching analytics data', 
            error: error.message 
        });
    }
};

exports.getRealTimeStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's statistics
    const [
      newCertificatesToday,
      verificationsToday,
      newStudentsToday,
      activeSessions,
      totalStudents,
      totalCertificates,
      activeCertificates,
      averageGrade,
      topPerformer,
      recentActivities
    ] = await Promise.all([
      // New certificates issued today
      Certificate.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      
      // Verifications today
      VerificationLog.countDocuments({
        verifiedAt: { $gte: today, $lt: tomorrow }
      }),
      
      // New students registered today
      User.countDocuments({
        role: 'student',
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      
      // Active sessions (users who logged in within last 15 minutes)
      // You'll need to implement session tracking in your auth system
      0, // Placeholder for now
      
      // Total students
      User.countDocuments({ role: 'student' }),
      
      // Total certificates
      Certificate.countDocuments(),
      
      // Active certificates
      Certificate.countDocuments({ isRevoked: false }),
      
      // Average grade across all certificates
      Certificate.aggregate([
        {
          $match: { grade: { $exists: true, $ne: null } }
        },
        {
          $group: {
            _id: null,
            avgGrade: { $avg: '$grade' }
          }
        }
      ]),
      
      // Top performing student
      User.aggregate([
        {
          $match: { role: 'student' }
        },
        {
          $lookup: {
            from: 'certificates',
            localField: '_id',
            foreignField: 'studentId',
            as: 'certificates'
          }
        },
        {
          $addFields: {
            certificateCount: { $size: '$certificates' },
            avgGrade: { $avg: '$certificates.grade' }
          }
        },
        {
          $match: {
            certificateCount: { $gt: 0 }
          }
        },
        {
          $sort: { avgGrade: -1, certificateCount: -1 }
        },
        {
          $limit: 1
        },
        {
          $project: {
            name: 1,
            email: 1,
            department: 1,
            certificateCount: 1,
            avgGrade: 1,
            achievements: { $slice: ['$certificates', 3] }
          }
        }
      ]),
      
      // Recent activities
      VerificationLog.find()
        .sort({ verifiedAt: -1 })
        .limit(5)
        .populate('certificateId', 'certificateId courseName')
        .populate('verifierId', 'name')
    ]);

    // Calculate completion rate (certificates issued vs total students)
    const completionRate = totalStudents > 0 
      ? ((totalCertificates / totalStudents) * 100).toFixed(1) 
      : 0;

    // Calculate retention rate (active certificates vs total)
    const retentionRate = totalCertificates > 0
      ? ((activeCertificates / totalCertificates) * 100).toFixed(1)
      : 0;

    // Get average grade
    const avgGradeValue = averageGrade.length > 0 
      ? parseFloat(averageGrade[0].avgGrade).toFixed(1) 
      : 0;

    // Format top performer data
    const performer = topPerformer.length > 0 ? topPerformer[0] : null;

    res.json({
      summary: {
        today: {
          newCertificates: newCertificatesToday,
          verifications: verificationsToday,
          newStudents: newStudentsToday,
          activeSessions: activeSessions
        },
        quickStats: {
          averageGrade: avgGradeValue,
          completionRate: completionRate,
          retentionRate: retentionRate,
          satisfaction: 4.8 // You can calculate this from feedback system
        },
        topPerformer: performer ? {
          initials: performer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
          name: performer.name,
          department: performer.department || 'Not Specified',
          certificates: performer.certificateCount,
          averageGrade: performer.avgGrade ? parseFloat(performer.avgGrade).toFixed(1) : 'N/A',
          achievements: performer.achievements.length
        } : {
          initials: 'NA',
          name: 'No Data',
          department: 'N/A',
          certificates: 0,
          averageGrade: 'N/A',
          achievements: 0
        },
        recentActivities: recentActivities.map(activity => ({
          id: activity._id,
          type: activity.isValid ? 'verification' : 'failed',
          message: `Certificate ${activity.certificateId?.certificateId || 'unknown'} ${activity.isValid ? 'verified' : 'verification failed'}`,
          time: activity.verifiedAt,
          verifier: activity.verifierId?.name || 'Unknown'
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching real-time stats:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
};

// Get certificate analytics
exports.getCertificateAnalytics = async (req, res) => {
  try {
    const { range = 'month' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch(range) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // Get certificate status distribution
    const statusDistribution = await Certificate.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$isRevoked', true] },
              'Revoked',
              {
                $cond: [
                  { $and: [
                    { $ne: ['$expiryDate', null] },
                    { $lt: ['$expiryDate', new Date()] }
                  ]},
                  'Expired',
                  'Active'
                ]
              }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly trend
    const monthlyTrend = await Certificate.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get top courses
    const topCourses = await Certificate.aggregate([
      {
        $group: {
          _id: '$courseName',
          count: { $sum: 1 },
          avgGrade: { $avg: '$grade' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      statusDistribution,
      monthlyTrend,
      topCourses
    });
  } catch (error) {
    console.error('Error fetching certificate analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};