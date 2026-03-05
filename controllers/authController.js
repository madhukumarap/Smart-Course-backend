const User = require('../models/User');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Get the role from roles collection
        let roleDoc;
        if (role) {
            roleDoc = await Role.findOne({ slug: role });
        }
        
        // Default to student if no role specified or role not found
        if (!roleDoc) {
            roleDoc = await Role.findOne({ slug: 'student' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'student', // Keep old field for backward compatibility
            roleId: roleDoc._id // New field for RBAC
        });

        const token = generateToken(user._id);

        // Get populated user
        const populatedUser = await User.findById(user._id)
            .populate('roleId', 'name slug permissions level');

        res.status(201).json({
            _id: populatedUser._id,
            name: populatedUser.name,
            email: populatedUser.email,
            role: populatedUser.role,
            roleData: populatedUser.roleId,
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email })
            .populate('roleId', 'name slug permissions level');
        console.log(user,"user")
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if user is active
        if (user.isActive === false) {
            return res.status(401).json({ message: 'Account is deactivated. Contact super admin.' });
        }

        const isMatch = await user.comparePassword(password);
        console.log(isMatch,"ahjkhdksa")
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            roleData: user.roleId,
            walletAddress: user.walletAddress,
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('roleId', 'name slug permissions level')
            .select('-password');
        
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            roleData: user.roleId,
            walletAddress: user.walletAddress,
            phone: user.phone,
            address: user.address,
            department: user.department,
            bio: user.bio,
            github: user.github,
            linkedin: user.linkedin,
            twitter: user.twitter,
            isActive: user.isActive,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};