/**
 * Seed Data Script
 * 
 * This script populates the database with test data for both Client (Merchant) and Publisher (Affiliate) dashboards.
 * 
 * Usage: node server/scripts/seedData.js
 * 
 * Make sure to set your MongoDB connection string in .env or environment variables
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Store = require('../models/store');
const AffiliateProgram = require('../models/affiliateProgram');
const Affiliate = require('../models/affiliate');
const Asset = require('../models/asset');
const Coupon = require('../models/coupon');
const Order = require('../models/order');
const Commission = require('../models/commission');
const Announcement = require('../models/announcement');
const PaymentMethod = require('../models/paymentMethod');
const Payout = require('../models/payout');
// Note: If TrackingLink model doesn't exist, we'll skip creating tracking links
let TrackingLink = null;
try {
  TrackingLink = require('../models/trackingLink');
} catch (e) {
  console.log('⚠️  TrackingLink model not found, skipping tracking links');
}

const Click = require('../models/click');

// Connect to MongoDB (same as app.js)
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

// Helper function to get user by email
const getUserByEmail = async (email) => {
  return await User.findOne({ email });
};

// Main seed function
const seedData = async () => {
  try {
    console.log('🌱 Starting seed data process...\n');

    // Find users automatically from database
    console.log('📧 Looking for users in database...\n');
    
    // Try to find merchant by email first (if provided), otherwise find by role
    let merchant = null;
    if (process.env.MERCHANT_EMAIL) {
      merchant = await getUserByEmail(process.env.MERCHANT_EMAIL);
    }
    if (!merchant) {
      merchant = await User.findOne({ role: 'advertiser' });
    }
    
    // Try to find affiliate by email first (if provided), otherwise find by role
    let affiliate = null;
    if (process.env.AFFILIATE_EMAIL) {
      affiliate = await getUserByEmail(process.env.AFFILIATE_EMAIL);
    }
    if (!affiliate) {
      affiliate = await User.findOne({ role: 'affiliate' });
    }

    if (!merchant) {
      console.error('❌ No merchant user found in database');
      console.log('💡 Please create a merchant user (role: "advertiser") first');
      console.log('   You can register through the Client app or create one manually\n');
      process.exit(1);
    }

    if (!affiliate) {
      console.error('❌ No affiliate user found in database');
      console.log('💡 Please create an affiliate user (role: "affiliate") first');
      console.log('   You can register through the Publisher app or create one manually\n');
      process.exit(1);
    }

    console.log(`✅ Found merchant: ${merchant.username} (${merchant.email}) - Role: ${merchant.role}`);
    console.log(`✅ Found affiliate: ${affiliate.username} (${affiliate.email}) - Role: ${affiliate.role}\n`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing seed data...');
    await Store.deleteMany({ merchant: merchant._id });
    await AffiliateProgram.deleteMany({ merchant: merchant._id });
    await Affiliate.deleteMany({ user: affiliate._id });
    await Asset.deleteMany({ merchant: merchant._id });
    await Coupon.deleteMany({ merchant: merchant._id });
    await Order.deleteMany({});
    await Commission.deleteMany({});
    await Announcement.deleteMany({ merchant: merchant._id });
    await PaymentMethod.deleteMany({ affiliate: affiliate._id });
    await Payout.deleteMany({});
    await Click.deleteMany({});
    // Note: TrackingLink deletion is handled in the creation section if model exists
    console.log('✅ Cleared existing data\n');

    // 1. Create Stores
    console.log('🏪 Creating stores...');
    const stores = await Store.insertMany([
      {
        merchant: merchant._id,
        name: 'TechStore Pro',
        domain: 'techstorepro.com',
        platform: 'woocommerce',
        status: 'active',
        description: 'Premium tech products and accessories',
        settings: {
          defaultCommissionRate: 15,
          commissionType: 'percentage',
          minimumPayout: 50,
          payoutSchedule: 'monthly',
          cookieDuration: 30
        },
        stats: {
          totalAffiliates: 1,
          totalClicks: 1250,
          totalOrders: 45,
          totalRevenue: 12500,
          totalCommissions: 1875
        }
      },
      {
        merchant: merchant._id,
        name: 'Fashion Hub',
        domain: 'fashionhub.com',
        platform: 'shopify',
        status: 'active',
        description: 'Trendy fashion and lifestyle products',
        settings: {
          defaultCommissionRate: 12,
          commissionType: 'percentage',
          minimumPayout: 50,
          payoutSchedule: 'bi-weekly',
          cookieDuration: 30
        },
        stats: {
          totalAffiliates: 1,
          totalClicks: 890,
          totalOrders: 32,
          totalRevenue: 8900,
          totalCommissions: 1068
        }
      }
    ]);

    // Generate tracking codes
    stores.forEach(store => {
      store.generateTrackingCode();
      store.save();
    });

    console.log(`✅ Created ${stores.length} stores\n`);

    // 2. Create Affiliate Programs
    console.log('📋 Creating affiliate programs...');
    const programs = await AffiliateProgram.insertMany([
      {
        merchant: merchant._id,
        store: stores[0]._id,
        name: 'TechStore Pro - General Program',
        description: 'Promote our premium tech products and earn 15% commission on every sale',
        commissionStructure: {
          type: 'percentage',
          rate: 15
        },
        terms: 'Commissions are paid monthly. Minimum payout is $50. Cookie duration is 30 days.',
        status: 'active',
        settings: {
          cookieDuration: 30,
          approvalWorkflow: 'manual',
          allowSelfReferrals: false,
          minimumPayout: 50
        },
        stats: {
          totalAffiliates: 1,
          totalClicks: 1250,
          totalConversions: 45,
          totalRevenue: 12500,
          totalCommissions: 1875
        }
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        name: 'TechStore Pro - Summer Sale',
        description: 'Special summer promotion program with increased commissions',
        commissionStructure: {
          type: 'percentage',
          rate: 20
        },
        terms: 'Limited time summer promotion. Higher commission rates apply.',
        status: 'active',
        settings: {
          cookieDuration: 30,
          approvalWorkflow: 'auto',
          allowSelfReferrals: false,
          minimumPayout: 50
        },
        stats: {
          totalAffiliates: 1,
          totalClicks: 650,
          totalConversions: 28,
          totalRevenue: 7200,
          totalCommissions: 1440
        }
      },
      {
        merchant: merchant._id,
        store: stores[1]._id,
        name: 'Fashion Hub - Main Program',
        description: 'Promote fashion and lifestyle products with 12% commission',
        commissionStructure: {
          type: 'percentage',
          rate: 12
        },
        terms: 'Commissions paid bi-weekly. Minimum payout $50.',
        status: 'active',
        settings: {
          cookieDuration: 30,
          approvalWorkflow: 'manual',
          allowSelfReferrals: false,
          minimumPayout: 50
        },
        stats: {
          totalAffiliates: 1,
          totalClicks: 890,
          totalConversions: 32,
          totalRevenue: 8900,
          totalCommissions: 1068
        }
      }
    ]);
    console.log(`✅ Created ${programs.length} programs\n`);

    // 3. Create Affiliate Profile
    console.log('👤 Creating affiliate profile...');
    let affiliateProfile = await Affiliate.findOne({ user: affiliate._id });
    
    if (!affiliateProfile) {
      affiliateProfile = new Affiliate({
        user: affiliate._id,
        referralCode: `AFF${Date.now().toString(36).toUpperCase()}`,
        status: 'approved',
        stores: [
          {
            store: stores[0]._id,
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: merchant._id,
            commissionRate: 15,
            stats: {
              clicks: 1250,
              orders: 45,
              revenue: 12500,
              commissions: 1875,
              conversions: 45
            }
          },
          {
            store: stores[1]._id,
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: merchant._id,
            commissionRate: 12,
            stats: {
              clicks: 890,
              orders: 32,
              revenue: 8900,
              commissions: 1068,
              conversions: 32
            }
          }
        ],
        stats: {
          totalClicks: 2140,
          totalOrders: 77,
          totalRevenue: 21400,
          totalEarnings: 2943,
          totalPaid: 1500,
          totalPending: 1443
        },
        profile: {
          website: 'https://myaffiliatesite.com',
          bio: 'Experienced affiliate marketer specializing in tech and fashion',
          niche: 'Technology & Fashion'
        }
      });
      await affiliateProfile.save();
    } else {
      // Update existing affiliate
      affiliateProfile.stores = [
        {
          store: stores[0]._id,
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: merchant._id,
          commissionRate: 15,
          stats: {
            clicks: 1250,
            orders: 45,
            revenue: 12500,
            commissions: 1875,
            conversions: 45
          }
        },
        {
          store: stores[1]._id,
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: merchant._id,
          commissionRate: 12,
          stats: {
            clicks: 890,
            orders: 32,
            revenue: 8900,
            commissions: 1068,
            conversions: 32
          }
        }
      ];
      await affiliateProfile.save();
    }
    console.log(`✅ Created/Updated affiliate profile: ${affiliateProfile.referralCode}\n`);

    // 4. Create Assets
    console.log('🖼️  Creating marketing assets...');
    const assets = await Asset.insertMany([
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[0]._id,
        type: 'banner',
        name: 'TechStore Pro - Main Banner',
        description: '728x90 banner for TechStore Pro',
        url: 'https://via.placeholder.com/728x90/9b87f5/ffffff?text=TechStore+Pro',
        thumbnail: 'https://via.placeholder.com/300x200/9b87f5/ffffff?text=TechStore+Pro',
        size: { width: 728, height: 90 },
        category: 'Banners',
        tags: ['tech', 'banner', '728x90'],
        isActive: true,
        usageCount: 45
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[0]._id,
        type: 'banner',
        name: 'TechStore Pro - Sidebar Banner',
        description: '300x250 banner for sidebar placement',
        url: 'https://via.placeholder.com/300x250/9b87f5/ffffff?text=TechStore+Pro',
        thumbnail: 'https://via.placeholder.com/300x250/9b87f5/ffffff?text=TechStore+Pro',
        size: { width: 300, height: 250 },
        category: 'Banners',
        tags: ['tech', 'banner', '300x250'],
        isActive: true,
        usageCount: 32
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[1]._id,
        type: 'banner',
        name: 'Summer Sale Banner',
        description: 'Special summer sale promotion banner',
        url: 'https://via.placeholder.com/728x90/ff6b6b/ffffff?text=Summer+Sale',
        thumbnail: 'https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Summer+Sale',
        size: { width: 728, height: 90 },
        category: 'Promotions',
        tags: ['summer', 'sale', 'promotion'],
        isActive: true,
        usageCount: 28
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        type: 'logo',
        name: 'TechStore Pro Logo',
        description: 'Official TechStore Pro logo',
        url: 'https://via.placeholder.com/200x100/9b87f5/ffffff?text=Logo',
        thumbnail: 'https://via.placeholder.com/200x100/9b87f5/ffffff?text=Logo',
        size: { width: 200, height: 100 },
        category: 'Branding',
        tags: ['logo', 'brand'],
        isActive: true,
        usageCount: 15
      },
      {
        merchant: merchant._id,
        store: stores[1]._id,
        program: programs[2]._id,
        type: 'banner',
        name: 'Fashion Hub - Main Banner',
        description: '728x90 banner for Fashion Hub',
        url: 'https://via.placeholder.com/728x90/ff6b9d/ffffff?text=Fashion+Hub',
        thumbnail: 'https://via.placeholder.com/300x200/ff6b9d/ffffff?text=Fashion+Hub',
        size: { width: 728, height: 90 },
        category: 'Banners',
        tags: ['fashion', 'banner'],
        isActive: true,
        usageCount: 32
      },
      {
        merchant: merchant._id,
        store: stores[1]._id,
        type: 'text-link',
        name: 'Fashion Hub Text Link',
        description: 'Simple text link for Fashion Hub',
        url: 'https://fashionhub.com?ref=AFF123',
        category: 'Links',
        tags: ['text-link', 'fashion'],
        isActive: true,
        usageCount: 25
      }
    ]);
    console.log(`✅ Created ${assets.length} assets\n`);

    // 5. Create Coupons
    console.log('🎟️  Creating coupons...');
    const coupons = await Coupon.insertMany([
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[0]._id,
        code: 'TECH15',
        name: '15% Off Tech Products',
        description: 'Get 15% off on all tech products',
        type: 'percentage',
        value: 15,
        minimumAmount: 50,
        maximumDiscount: 100,
        usageLimit: 1000,
        usedCount: 45,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[1]._id,
        code: 'SUMMER20',
        name: 'Summer Sale - 20% Off',
        description: 'Special summer promotion - 20% off',
        type: 'percentage',
        value: 20,
        minimumAmount: 30,
        usageLimit: 500,
        usedCount: 28,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true
      },
      {
        merchant: merchant._id,
        store: stores[1]._id,
        program: programs[2]._id,
        code: 'FASHION12',
        name: '12% Off Fashion Items',
        description: 'Get 12% off on fashion products',
        type: 'percentage',
        value: 12,
        minimumAmount: 40,
        usageLimit: 1000,
        usedCount: 32,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        isActive: true
      }
    ]);
    console.log(`✅ Created ${coupons.length} coupons\n`);

    // 6. Create Orders
    console.log('📦 Creating orders...');
    const orders = [];
    const orderDates = [];
    
    // Generate orders for the last 60 days
    for (let i = 0; i < 77; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      orderDates.push(orderDate);
      
      const store = i < 45 ? stores[0] : stores[1];
      const orderTotal = Math.floor(Math.random() * 500) + 50; // $50-$550
      const commissionRate = store === stores[0] ? 15 : 12;
      const commissionAmount = (orderTotal * commissionRate) / 100;

      const order = new Order({
        store: store._id,
        affiliate: affiliateProfile._id,
        externalOrderId: `EXT-${Date.now()}-${i}`,
        orderData: {
          orderNumber: `ORD-${1000 + i}`,
          customerEmail: `customer${i}@example.com`,
          customerName: `Customer ${i + 1}`,
          items: [
            {
              productId: `PROD-${i}`,
              productName: `Product ${i + 1}`,
              quantity: Math.floor(Math.random() * 3) + 1,
              price: orderTotal / 2,
              total: orderTotal / 2
            }
          ],
          subtotal: orderTotal * 0.9,
          tax: orderTotal * 0.1,
          shipping: 0,
          discount: 0,
          total: orderTotal,
          currency: 'USD',
          status: ['pending', 'confirmed', 'confirmed', 'confirmed'][Math.floor(Math.random() * 4)],
          paymentMethod: 'credit_card',
          paymentStatus: 'paid'
        },
        cookieId: `cookie-${i}`,
        referralCode: affiliateProfile.referralCode,
        commission: {
          rate: commissionRate,
          amount: commissionAmount,
          calculated: true,
          calculatedAt: orderDate
        },
        status: ['pending', 'confirmed', 'confirmed', 'confirmed'][Math.floor(Math.random() * 4)],
        orderDate: orderDate
      });
      orders.push(order);
    }

    const savedOrders = await Order.insertMany(orders);
    console.log(`✅ Created ${savedOrders.length} orders\n`);

    // 7. Create Commissions
    console.log('💰 Creating commissions...');
    const commissions = [];
    
    savedOrders.forEach((order, index) => {
      const statuses = ['pending', 'approved', 'approved', 'paid'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const paidOut = status === 'paid';
      
      const commission = new Commission({
        affiliate: affiliateProfile._id,
        store: order.store,
        order: order._id,
        amount: order.commission.amount,
        rate: order.commission.rate,
        orderTotal: order.orderData.total,
        currency: 'USD',
        status: status,
        approvedAt: status === 'approved' || status === 'paid' ? order.orderDate : null,
        approvedBy: status === 'approved' || status === 'paid' ? merchant._id : null,
        payout: paidOut ? {
          paidAt: new Date(order.orderDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          paymentMethod: 'paystack',
          transactionId: `TXN-${Date.now()}-${index}`
        } : {}
      });
      commissions.push(commission);
    });

    const savedCommissions = await Commission.insertMany(commissions);
    console.log(`✅ Created ${savedCommissions.length} commissions\n`);

    // 8. Create Announcements
    console.log('📢 Creating announcements...');
    const announcements = await Announcement.insertMany([
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[0]._id,
        title: 'Welcome to TechStore Pro Affiliate Program!',
        message: 'Thank you for joining our affiliate program. We\'re excited to work with you!',
        type: 'success',
        priority: 'medium',
        isActive: true,
        targetAffiliates: 'all',
        scheduledFor: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        merchant: merchant._id,
        store: stores[0]._id,
        program: programs[1]._id,
        title: 'Summer Sale Promotion - Increased Commissions!',
        message: 'For the next 30 days, all sales through the Summer Sale program will earn 20% commission instead of 15%!',
        type: 'important',
        priority: 'high',
        isActive: true,
        targetAffiliates: 'all',
        scheduledFor: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        merchant: merchant._id,
        store: stores[1]._id,
        program: programs[2]._id,
        title: 'New Product Line Available',
        message: 'Check out our new spring collection! New products are now available for promotion.',
        type: 'info',
        priority: 'medium',
        isActive: true,
        targetAffiliates: 'all',
        scheduledFor: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log(`✅ Created ${announcements.length} announcements\n`);

    // 9. Create Payment Methods
    console.log('💳 Creating payment methods...');
    const paymentMethods = await PaymentMethod.insertMany([
      {
        affiliate: affiliateProfile._id,
        type: 'paystack',
        isDefault: true,
        gatewayEmail: affiliate.email,
        gatewayPhone: '+1234567890',
        status: 'active',
        isVerified: true,
        verifiedAt: new Date()
      },
      {
        affiliate: affiliateProfile._id,
        type: 'bank_transfer',
        isDefault: false,
        bankName: 'First National Bank',
        accountNumber: '1234567890',
        accountName: affiliate.username,
        status: 'active',
        isVerified: true,
        verifiedAt: new Date()
      }
    ]);
    console.log(`✅ Created ${paymentMethods.length} payment methods\n`);

    // 10. Create Payouts
    console.log('💸 Creating payouts...');
    const paidCommissions = savedCommissions.filter(c => c.status === 'paid').slice(0, 3);
    if (paidCommissions.length > 0) {
      const payout = new Payout({
        affiliate: affiliateProfile._id,
        store: stores[0]._id,
        commissions: paidCommissions.map(c => c._id),
        amount: paidCommissions.reduce((sum, c) => sum + c.amount, 0),
        currency: 'USD',
        paymentMethodRef: paymentMethods[0]._id,
        paymentMethod: 'paystack',
        paymentDetails: {
          recipientEmail: affiliate.email,
          recipientPhone: '+1234567890'
        },
        status: 'completed',
        transactionId: `TXN-PAYOUT-${Date.now()}`,
        transactionReference: `REF-${Date.now()}`,
        processedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        processedBy: merchant._id
      });
      await payout.save();
      console.log(`✅ Created 1 completed payout\n`);
    }

    // 11. Create Tracking Links
    let trackingLinks = [];
    if (TrackingLink) {
      console.log('🔗 Creating tracking links...');
      trackingLinks = await TrackingLink.insertMany([
      {
        affiliate: affiliateProfile._id,
        store: stores[0]._id,
        program: programs[0]._id,
        url: `https://${stores[0].domain}?ref=${affiliateProfile.referralCode}`,
        shortCode: `TECH-${affiliateProfile.referralCode.substring(0, 6)}`,
        isActive: true
      },
      {
        affiliate: affiliateProfile._id,
        store: stores[0]._id,
        program: programs[1]._id,
        url: `https://${stores[0].domain}/summer-sale?ref=${affiliateProfile.referralCode}`,
        shortCode: `SUMMER-${affiliateProfile.referralCode.substring(0, 6)}`,
        isActive: true
      },
      {
        affiliate: affiliateProfile._id,
        store: stores[1]._id,
        program: programs[2]._id,
        url: `https://${stores[1].domain}?ref=${affiliateProfile.referralCode}`,
        shortCode: `FASHION-${affiliateProfile.referralCode.substring(0, 6)}`,
        isActive: true
      }
      ]);
      console.log(`✅ Created ${trackingLinks.length} tracking links\n`);
    } else {
      console.log('⚠️  Skipping tracking links (model not available)\n');
    }

    // 12. Create Clicks (sample)
    console.log('🖱️  Creating click tracking data...');
    const clicks = [];
    for (let i = 0; i < 100; i++) {
      const storeIndex = Math.floor(Math.random() * stores.length);
      const store = stores[storeIndex];
      const program = programs[storeIndex] || programs[0];
      const clickDate = new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
      const converted = Math.random() > 0.7; // 30% conversion rate
      
      clicks.push({
        affiliate: affiliateProfile._id,
        store: store._id,
        referralCode: affiliateProfile.referralCode,
        landingPage: `https://${store.domain}?ref=${affiliateProfile.referralCode}`,
        referer: 'https://google.com',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        cookieId: `cookie-${i}`,
        converted: converted,
        convertedAt: converted ? new Date(clickDate.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null,
        createdAt: clickDate
      });
    }
    await Click.insertMany(clicks);
    console.log(`✅ Created ${clicks.length} click records\n`);

    console.log('✅ Seed data completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Stores: ${stores.length}`);
    console.log(`   - Programs: ${programs.length}`);
    console.log(`   - Assets: ${assets.length}`);
    console.log(`   - Coupons: ${coupons.length}`);
    console.log(`   - Orders: ${savedOrders.length}`);
    console.log(`   - Commissions: ${savedCommissions.length}`);
    console.log(`   - Announcements: ${announcements.length}`);
    console.log(`   - Payment Methods: ${paymentMethods.length}`);
    if (trackingLinks.length > 0) {
      console.log(`   - Tracking Links: ${trackingLinks.length}`);
    }
    console.log(`   - Clicks: ${clicks.length}\n`);
    console.log('🎉 You can now test both Client and Publisher dashboards!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
};

// Run seed
const runSeed = async () => {
  await connectDB();
  await seedData();
  await mongoose.connection.close();
  console.log('👋 Database connection closed');
  process.exit(0);
};

runSeed();

