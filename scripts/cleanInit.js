const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

dotenv.config();

const fixedInit = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Drop existing collections
        console.log('🧹 Clearing existing data...');
        await Permission.deleteMany({});
        await Role.deleteMany({});
        await User.deleteMany({ role: 'super_admin' });
        
        console.log('📝 Creating permissions...');
        
        // Create default permissions
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
        console.log(`✅ Created ${permissions.length} permissions`);

        // Create a map of permission slugs for easy access
        const permissionSlugs = permissions.map(p => p.slug);
        console.log('📝 Permission slugs created:', permissionSlugs);

        console.log('📝 Creating roles...');
        
        // Create default roles with validated permissions
        const defaultRoles = [
            {
                name: 'Super Admin',
                slug: 'super_admin',
                description: 'Full system access with ability to manage roles and admins',
                permissions: permissionSlugs, // Use all permission slugs
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
                ].filter(slug => permissionSlugs.includes(slug)), // Filter to only include existing permissions
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
                ].filter(slug => permissionSlugs.includes(slug)),
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
                ].filter(slug => permissionSlugs.includes(slug)),
                level: 40,
                isSystem: true,
                isDefault: true
            }
        ];

        // Validate each role's permissions before inserting
        for (const roleData of defaultRoles) {
            console.log(`\nCreating role: ${roleData.name}`);
            console.log('Permissions count:', roleData.permissions.length);
            
            // Check if any permissions are missing
            const missingPermissions = roleData.permissions.filter(
                slug => !permissionSlugs.includes(slug)
            );
            
            if (missingPermissions.length > 0) {
                console.warn(`Warning: Missing permissions for ${roleData.name}:`, missingPermissions);
            }
        }

        const roles = await Role.insertMany(defaultRoles);
        console.log(`\n✅ Created ${roles.length} roles`);

        console.log('👤 Creating super admin user...');
        
        // Get super admin role
        const superAdminRole = await Role.findOne({ slug: 'super_admin' });

        if (!superAdminRole) {
            throw new Error('Super Admin role not found');
        }

        // Create super admin user
        // const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
        
        const superAdmin = new User({
            name: 'Super Admin',
            email: 'superadmin@example.com',
            password: 'SuperAdmin123!',
            role: 'super_admin',
            roleId: superAdminRole._id,
            isActive: true,
            phone: '+1234567890',
            department: 'System Administration',
            bio: 'System Super Administrator'
        });

        await superAdmin.save();
        
        console.log('\n✅ System initialized successfully!');
        console.log('====================================');
        console.log('📧 Email: superadmin@example.com');
        console.log('🔑 Password: SuperAdmin123!');
        console.log('====================================');
        console.log('\nYou can now login with these credentials.');

        // Display role summary
        console.log('\n📊 Role Summary:');
        for (const role of roles) {
            console.log(`  • ${role.name}: ${role.permissions.length} permissions`);
        }

    } catch (error) {
        console.error('❌ Initialization error:', error);
        
        // More detailed error logging
        if (error.errors) {
            console.error('\nValidation Errors:');
            Object.keys(error.errors).forEach(key => {
                console.error(`  ${key}:`, error.errors[key].message);
            });
        }
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

fixedInit();