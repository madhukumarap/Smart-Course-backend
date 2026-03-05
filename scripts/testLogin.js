const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Find the super admin
        const user = await User.findOne({ email: 'superadmin@example.com' });
        
        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log('✅ User found:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Password Hash: ${user.password}`);

        // Test password comparison
        const testPassword = 'SuperAdmin123!';
        const isMatch = await bcrypt.compare(testPassword, user.password);
        
        console.log(`\n🔐 Password test for "${testPassword}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

        // Try alternative common passwords in case of typo
        const alternatives = [
            'SuperAdmin123',
            'superadmin123!',
            'admin123',
            'Admin123!',
            'password123'
        ];

        console.log('\n📝 Testing alternative passwords:');
        for (const alt of alternatives) {
            const altMatch = await bcrypt.compare(alt, user.password);
            if (altMatch) {
                console.log(`   ✅ "${alt}" - MATCHES!`);
            } else {
                console.log(`   ❌ "${alt}" - no match`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

testLogin();