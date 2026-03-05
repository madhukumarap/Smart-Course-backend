const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const resetPassword = async () => {
    try {
        // Connect MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Find user
        const user = await User.findOne({ email: 'superadmin@example.com' });

        if (!user) {
            console.log('❌ Super admin not found');
            process.exit(1);
        }

        console.log('✅ Super admin found:', user.email);

        // New password
        const newPassword = 'Admin123!';

        // Assign plain password (model will hash automatically)
        user.password = newPassword;

        await user.save();

        console.log('\n✅ Password reset successfully!');
        console.log('====================================');
        console.log('📧 Email: superadmin@example.com');
        console.log('🔑 New Password: Admin123!');
        console.log('====================================');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

resetPassword();