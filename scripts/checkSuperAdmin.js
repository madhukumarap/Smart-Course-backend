const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');

dotenv.config();

const checkSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Check all users
        const users = await User.find().populate('roleId');
        console.log(`\n📊 Total users: ${users.length}`);
        
        users.forEach((user, index) => {
            console.log(`\n👤 User ${index + 1}:`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Role ID: ${user.roleId?.name || 'Not set'}`);
            console.log(`   Active: ${user.isActive}`);
        });

        // Check specifically for super admin
        const superAdmin = await User.findOne({ 
            $or: [
                { email: 'superadmin@example.com' },
                { role: 'super_admin' }
            ]
        }).populate('roleId');

        if (superAdmin) {
            console.log('\n✅ Super Admin found:');
            console.log(`   Email: ${superAdmin.email}`);
            console.log(`   Password hash: ${superAdmin.password.substring(0, 20)}...`);
            console.log(`   Role: ${superAdmin.roleId?.name}`);
        } else {
            console.log('\n❌ Super Admin not found!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

checkSuperAdmin();