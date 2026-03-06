const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirs = () => {
    const dirs = [
        'uploads/courses/thumbnails',
        'uploads/courses/covers',
        'uploads/courses/videos',
        'uploads/courses/resources'
    ];
    
    dirs.forEach(dir => {
        const fullPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
};

createUploadDirs();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/courses/';
        
        if (file.fieldname === 'thumbnail') {
            uploadPath += 'thumbnails';
        } else if (file.fieldname === 'coverImage') {
            uploadPath += 'covers';
        } else if (file.fieldname === 'video') {
            uploadPath += 'videos';
        } else {
            uploadPath += 'resources';
        }
        
        cb(null, path.join(__dirname, '..', uploadPath));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'thumbnail' || file.fieldname === 'coverImage') {
        // Allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for thumbnails and covers'), false);
        }
    } else if (file.fieldname === 'video') {
        // Allow videos
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only MP4, WebM, and OGG video formats are allowed'), false);
        }
    } else {
        cb(new Error('Unexpected field'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit for videos
    }
});

module.exports = upload;