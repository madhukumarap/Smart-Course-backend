const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');

dotenv.config();

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if super admin role exists
        let superAdminRole = await Role.findOne({ slug: 'super_admin' });
        
        if (!superAdminRole) {
            console.log('Creating super admin role first...');
            // You need to run the initialize endpoint first
            console.log('Please run the initialize endpoint first');
            process.exit(1);
        }

        // Check if super admin already exists
        const existingSuperAdmin = await User.findOne({ 
            roleId: superAdminRole._id 
        });

        if (existingSuperAdmin) {
            console.log('Super admin already exists');
            process.exit(0);
        }

        // Create super admin user
        const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
        
        const superAdmin = new User({
            name: 'Super Admin',
            email: 'superadmin@example.com',
            password: hashedPassword,
            roleId: superAdminRole._id,
            isActive: true
        });

        await superAdmin.save();
        console.log('Super admin created successfully');
        console.log('Email: superadmin@example.com');
        console.log('Password: SuperAdmin123!');

    } catch (error) {
        console.error('Error creating super admin:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

createSuperAdmin();