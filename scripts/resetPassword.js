/**
 * Password Reset Script
 * Resets password for a user account (useful when email system is not set up)
 * 
 * Usage: node server/scripts/resetPassword.js <email> <newPassword>
 * Example: node server/scripts/resetPassword.js merchant@test.com password123
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const { hashPassword } = require('../utils/password');

const resetPassword = async () => {
  try {
    // Get email and new password from command line arguments
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
      console.error('❌ Usage: node server/scripts/resetPassword.js <email> <newPassword>');
      console.error('   Example: node server/scripts/resetPassword.js merchant@test.com password123');
      process.exit(1);
    }

    if (newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`\n📧 Found user: ${user.email}`);
    console.log(`👤 Username: ${user.username}`);
    console.log(`🔑 Role: ${user.role}`);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    user.password = hashedPassword;
    await user.save();

    console.log(`\n✅ Password reset successfully!`);
    console.log(`📝 New password: ${newPassword}`);
    console.log(`\n⚠️  Remember to change this password after logging in for security.`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

resetPassword();

