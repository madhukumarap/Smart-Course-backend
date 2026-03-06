const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const bcrypt = require('bcryptjs');

// ==================== ROLE MANAGEMENT ====================

// Get all roles
exports.getAllRoles = async (req, res) => {
    try {
        const roles = await Role.find()
            .populate('createdBy', 'name email')
            .sort('-createdAt');
        res.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error fetching roles', error: error.message });
    }
};

// Get single role
exports.getRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id)
            .populate('createdBy', 'name email');
        
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        
        res.json(role);
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ message: 'Error fetching role', error: error.message });
    }
};

// Create new role
exports.createRole = async (req, res) => {
    try {
        const { name, description, permissions, level } = req.body;

        // Check if role already exists
        const existingRole = await Role.findOne({ 
            $or: [
                { name },
                { slug: name.toLowerCase().replace(/\s+/g, '_') }
            ]
        });
        
        if (existingRole) {
            return res.status(400).json({ message: 'Role already exists' });
        }

        const role = new Role({
            name,
            slug: name.toLowerCase().replace(/\s+/g, '_'),
            description,
            permissions,
            level: level || 50,
            createdBy: req.user._id
        });

        await role.save();

        res.status(201).json({
            message: 'Role created successfully',
            role
        });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ message: 'Error creating role', error: error.message });
    }
};

// Update role
exports.updateRole = async (req, res) => {
    try {
        const { name, description, permissions, level, isActive } = req.body;
        
        const role = await Role.findById(req.params.id);
        
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        // Don't allow modification of system roles
        if (role.isSystem) {
            return res.status(403).json({ message: 'Cannot modify system roles' });
        }

        if (name) {
            role.name = name;
            role.slug = name.toLowerCase().replace(/\s+/g, '_');
        }
        if (description) role.description = description;
        if (permissions) role.permissions = permissions;
        if (level) role.level = level;

        await role.save();

        res.json({
            message: 'Role updated successfully',
            role
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ message: 'Error updating role', error: error.message });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        // Don't allow deletion of system roles
        if (role.isSystem) {
            return res.status(403).json({ message: 'Cannot delete system roles' });
        }

        // Check if role is assigned to any users
        const usersWithRole = await User.countDocuments({ roleId: role._id });
        if (usersWithRole > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete role that is assigned to users',
                userCount: usersWithRole
            });
        }

        await role.deleteOne();

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ message: 'Error deleting role', error: error.message });
    }
};

// ==================== ADMIN MANAGEMENT ====================

// Get all admins
exports.getAllAdmins = async (req, res) => {
    try {
        const adminRole = await Role.findOne({ slug: 'admin' });
        
        const admins = await User.find({ 
            roleId: adminRole?._id,
            _id: { $ne: req.user._id } // Exclude super admin
        })
        .populate('roleId', 'name permissions level')
        .populate('createdBy', 'name email')
        .select('-password')
        .sort('-createdAt');

        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Error fetching admins', error: error.message });
    }
};

// Create new admin
exports.createAdmin = async (req, res) => {
    try {
        const { name, email, password, phone, department } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Get admin role
        const adminRole = await Role.findOne({ slug: 'admin' });
        if (!adminRole) {
            return res.status(500).json({ message: 'Admin role not found in system' });
        }

        // Create new admin
        const admin = new User({
            name,
            email,
            password,
            role: 'admin', // add this
            roleId: adminRole._id,
            phone,
            department,
            createdBy: req.user._id,
            isActive: true
        });

        await admin.save();

        // Remove password from response
        const adminResponse = admin.toObject();
        delete adminResponse.password;

        res.status(201).json({
            message: 'Admin created successfully',
            admin: adminResponse
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Error creating admin', error: error.message });
    }
};

// Update admin
exports.updateAdmin = async (req, res) => {
    try {
        const { name, email, phone, department, isActive } = req.body;
        
        const admin = await User.findById(req.params.id);
        
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Check if trying to modify super admin
        const superAdminRole = await Role.findOne({ slug: 'super_admin' });
        if (admin.roleId.toString() === superAdminRole?._id.toString()) {
            return res.status(403).json({ message: 'Cannot modify super admin' });
        }

        if (name) admin.name = name;
        if (email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ email, _id: { $ne: admin._id } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            admin.email = email;
        }
        if (phone) admin.phone = phone;
        if (department) admin.department = department;
        if (isActive !== undefined) admin.isActive = isActive;

        await admin.save();

        const updatedAdmin = await User.findById(admin._id)
            .populate('roleId', 'name permissions')
            .select('-password');

        res.json({
            message: 'Admin updated successfully',
            admin: updatedAdmin
        });
    } catch (error) {
        console.error('Error updating admin:', error);
        res.status(500).json({ message: 'Error updating admin', error: error.message });
    }
};

// Delete admin
exports.deleteAdmin = async (req, res) => {
    try {
        const admin = await User.findById(req.params.id);
        
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Check if trying to delete super admin
        const superAdminRole = await Role.findOne({ slug: 'super_admin' });
        if (admin.roleId.toString() === superAdminRole?._id.toString()) {
            return res.status(403).json({ message: 'Cannot delete super admin' });
        }

        await admin.deleteOne();

        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Error deleting admin', error: error.message });
    }
};

// ==================== PERMISSION MANAGEMENT ====================

// Get all permissions
exports.getAllPermissions = async (req, res) => {
    try {
        const permissions = await Permission.find().sort('module name');
        res.json(permissions);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Error fetching permissions', error: error.message });
    }
};

// Initialize default roles and permissions
// Initialize default roles and permissions
exports.initializeSystem = async (req, res) => {
    try {
        // Check if already initialized
        const existingRoles = await Role.countDocuments();
        if (existingRoles > 0) {
            return res.status(400).json({ message: 'System already initialized' });
        }

        // Create default permissions with updated modules
        const defaultPermissions = [
            // User management
            { name: 'Manage Users', slug: 'manage_users', module: 'users', description: 'Create, update, delete users' },
            { name: 'View Users', slug: 'view_users', module: 'users', description: 'View user list and details' },
            
            // Role management
            { name: 'Manage Roles', slug: 'manage_roles', module: 'roles', description: 'Create, update, delete roles' },
            { name: 'View Roles', slug: 'view_roles', module: 'roles', description: 'View role list and details' },
            
            // Certificate management
            { name: 'Manage Certificates', slug: 'manage_certificates', module: 'certificates', description: 'Full certificate management' },
            { name: 'Issue Certificates', slug: 'issue_certificates', module: 'certificates', description: 'Issue new certificates' },
            { name: 'Revoke Certificates', slug: 'revoke_certificates', module: 'certificates', description: 'Revoke existing certificates' },
            { name: 'View Certificates', slug: 'view_certificates', module: 'certificates', description: 'View certificates' },
            { name: 'Download Certificates', slug: 'download_certificates', module: 'certificates', description: 'Download certificate PDFs' },
            
            // Verification
            { name: 'Verify Certificates', slug: 'verify_certificates', module: 'verifiers', description: 'Verify certificate authenticity' },
            { name: 'Manage Verifiers', slug: 'manage_verifiers', module: 'verifiers', description: 'Add/remove verifiers' },
            
            // Analytics
            { name: 'View Analytics', slug: 'view_analytics', module: 'analytics', description: 'View analytics dashboard' },
            { name: 'View Logs', slug: 'view_logs', module: 'logs', description: 'View verification logs' },
            
            // Profile
            { name: 'Manage Profile', slug: 'manage_profile', module: 'profile', description: 'Update profile information' },
            { name: 'Change Password', slug: 'change_password', module: 'profile', description: 'Change account password' },
            
            // Dashboard
            { name: 'View Dashboard', slug: 'view_dashboard', module: 'dashboard', description: 'Access dashboard' },
            
            // Applications
            { name: 'Manage Applications', slug: 'manage_applications', module: 'applications', description: 'Manage job applications' },
            { name: 'View Progress', slug: 'view_progress', module: 'progress', description: 'View learning progress' }
        ];

        const permissions = await Permission.insertMany(defaultPermissions);
        
        // Create default roles
        const defaultRoles = [
            {
                name: 'Super Admin',
                slug: 'super_admin',
                description: 'Full system access with ability to manage roles and admins',
                permissions: permissions.map(p => p.slug),
                level: 100,
                isSystem: true,
                isDefault: false
            },
            {
                name: 'Admin',
                slug: 'admin',
                description: 'System administrator with certificate management capabilities',
                permissions: [
                    'manage_certificates',
                    'issue_certificates',
                    'revoke_certificates',
                    'view_certificates',
                    'download_certificates',
                    'view_analytics',
                    'view_logs',
                    'view_dashboard',
                    'view_users',
                    'manage_profile',
                    'change_password'
                ],
                level: 80,
                isSystem: true,
                isDefault: false
            },
            {
                name: 'Verifier',
                slug: 'verifier',
                description: 'Can verify certificates and view verification history',
                permissions: [
                    'verify_certificates',
                    'view_certificates',
                    'view_logs',
                    'view_dashboard',
                    'manage_profile',
                    'change_password'
                ],
                level: 60,
                isSystem: true,
                isDefault: false
            },
            {
                name: 'Student',
                slug: 'student',
                description: 'Can view and download their own certificates',
                permissions: [
                    'view_certificates',
                    'download_certificates',
                    'view_dashboard',
                    'manage_profile',
                    'change_password',
                    'view_progress',
                    'manage_applications'
                ],
                level: 40,
                isSystem: true,
                isDefault: true
            }
        ];

        const roles = await Role.insertMany(defaultRoles);

        res.json({
            message: 'System initialized successfully',
            permissions: permissions.length,
            roles: roles.length
        });
    } catch (error) {
        console.error('Error initializing system:', error);
        res.status(500).json({ message: 'Error initializing system', error: error.message });
    }
};
// Get system statistics
exports.getSystemStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalRoles,
            totalPermissions,
            usersByRole,
            activeAdmins
        ] = await Promise.all([
            User.countDocuments(),
            Role.countDocuments(),
            Permission.countDocuments(),
            User.aggregate([
                {
                    $group: {
                        _id: '$roleId',
                        count: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'roles',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'role'
                    }
                },
                {
                    $project: {
                        roleName: { $arrayElemAt: ['$role.name', 0] },
                        count: 1
                    }
                }
            ]),
            User.countDocuments({ 
                roleId: { $in: await Role.find({ slug: { $in: ['super_admin', 'admin'] } }).distinct('_id') },
                isActive: true 
            })
        ]);

        res.json({
            totalUsers,
            totalRoles,
            totalPermissions,
            usersByRole,
            activeAdmins
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ message: 'Error fetching system stats', error: error.message });
    }
};