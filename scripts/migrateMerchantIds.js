/**
 * Migration script to generate merchant IDs for existing merchants/advertisers
 * Run this once to add merchantId to existing users
 * 
 * Usage: node server/scripts/migrateMerchantIds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

const generateMerchantId = () => {
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MERCH-${randomPart}`;
};

const migrateMerchantIds = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/affiliateNetwork', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all merchants/advertisers without merchantId
    const merchants = await User.find({
      $or: [
        { role: 'advertiser' },
        { role: 'admin' }
      ],
      $or: [
        { merchantId: { $exists: false } },
        { merchantId: null },
        { merchantId: '' }
      ]
    });

    console.log(`Found ${merchants.length} merchants/advertisers without merchantId`);

    let updated = 0;
    let errors = 0;

    for (const merchant of merchants) {
      try {
        // Generate unique merchant ID
        let merchantId;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
          merchantId = generateMerchantId();
          const existing = await User.findOne({ merchantId });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          console.error(`Failed to generate unique merchantId for user ${merchant._id} after 10 attempts`);
          errors++;
          continue;
        }

        merchant.merchantId = merchantId;
        await merchant.save();
        updated++;
        console.log(`✓ Generated merchantId ${merchantId} for user ${merchant.username} (${merchant._id})`);
      } catch (error) {
        console.error(`✗ Error updating user ${merchant._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${merchants.length}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

// Run migration
migrateMerchantIds();

