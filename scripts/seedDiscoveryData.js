/**
 * Seed Discovery Data Script
 * 
 * This script creates discoverable affiliates with full discovery data for testing the Discovery feature.
 * These affiliates will NOT be associated with any merchant stores, so they will appear in the discovery page.
 * 
 * Usage: node server/scripts/seedDiscoveryData.js
 * 
 * Make sure to set your MongoDB connection string in .env or environment variables
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Affiliate = require('../models/affiliate');
const { hashPassword } = require('../utils/password');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

// Sample discovery data for different affiliate types
const discoveryProfiles = [
  {
    username: 'techblogger',
    email: 'techblogger@example.com',
    bio: 'Tech enthusiast and gadget reviewer with 5+ years of experience',
    niche: 'Technology & Electronics',
    categories: ['blogger', 'technology', 'electronics'],
    website: 'https://techblogger.example.com',
    domain: 'techblogger.example.com',
    description: 'Latest tech reviews, gadget comparisons, and technology news',
    monthlyVisitors: 45000,
    monthlyPageViews: 120000,
    trafficSources: { organic: 60, social: 25, paid: 10, direct: 5 },
    socialFollowers: { twitter: 12000, instagram: 8500, youtube: 25000, facebook: 5000 },
    engagementRate: 4.2,
    totalClicks: 8500,
    totalOrders: 340,
    verified: true,
    qualityScore: 85
  },
  {
    username: 'fashionista',
    email: 'fashionista@example.com',
    bio: 'Fashion influencer and style blogger',
    niche: 'Fashion & Apparel',
    categories: ['instagram', 'fashion', 'blogger'],
    website: 'https://fashionista.example.com',
    domain: 'fashionista.example.com',
    description: 'Daily fashion inspiration, outfit ideas, and style tips',
    monthlyVisitors: 125000,
    monthlyPageViews: 380000,
    trafficSources: { organic: 40, social: 50, paid: 5, direct: 5 },
    socialFollowers: { instagram: 85000, twitter: 15000, pinterest: 25000, facebook: 12000 },
    engagementRate: 6.8,
    totalClicks: 22000,
    totalOrders: 1100,
    verified: true,
    qualityScore: 92
  },
  {
    username: 'healthguru',
    email: 'healthguru@example.com',
    bio: 'Health and wellness expert sharing fitness tips and nutrition advice',
    niche: 'Health & Beauty',
    categories: ['blogger', 'health-beauty', 'youtube'],
    website: 'https://healthguru.example.com',
    domain: 'healthguru.example.com',
    description: 'Fitness routines, healthy recipes, and wellness tips',
    monthlyVisitors: 68000,
    monthlyPageViews: 195000,
    trafficSources: { organic: 55, social: 30, paid: 10, direct: 5 },
    socialFollowers: { youtube: 45000, instagram: 32000, facebook: 15000, twitter: 8000 },
    engagementRate: 5.5,
    totalClicks: 15000,
    totalOrders: 750,
    verified: true,
    qualityScore: 88
  },
  {
    username: 'couponking',
    email: 'couponking@example.com',
    bio: 'Best deals and coupon codes for online shopping',
    niche: 'Deals & Coupons',
    categories: ['coupon-site', 'blogger'],
    website: 'https://couponking.example.com',
    domain: 'couponking.example.com',
    description: 'Daily deals, exclusive coupon codes, and shopping discounts',
    monthlyVisitors: 200000,
    monthlyPageViews: 650000,
    trafficSources: { organic: 70, social: 20, paid: 5, direct: 5 },
    socialFollowers: { twitter: 25000, facebook: 18000, instagram: 12000 },
    engagementRate: 3.2,
    totalClicks: 45000,
    totalOrders: 1800,
    verified: true,
    qualityScore: 90
  },
  {
    username: 'travelwanderer',
    email: 'travelwanderer@example.com',
    bio: 'Travel blogger exploring the world one destination at a time',
    niche: 'Travel & Tourism',
    categories: ['blogger', 'travel', 'instagram'],
    website: 'https://travelwanderer.example.com',
    domain: 'travelwanderer.example.com',
    description: 'Travel guides, destination reviews, and adventure stories',
    monthlyVisitors: 95000,
    monthlyPageViews: 280000,
    trafficSources: { organic: 50, social: 40, paid: 5, direct: 5 },
    socialFollowers: { instagram: 65000, youtube: 28000, facebook: 20000, twitter: 12000 },
    engagementRate: 7.1,
    totalClicks: 18000,
    totalOrders: 720,
    verified: true,
    qualityScore: 87
  },
  {
    username: 'foodiechef',
    email: 'foodiechef@example.com',
    bio: 'Home chef sharing delicious recipes and cooking tips',
    niche: 'Food & Beverage',
    categories: ['blogger', 'food-beverage', 'youtube'],
    website: 'https://foodiechef.example.com',
    domain: 'foodiechef.example.com',
    description: 'Easy recipes, cooking tutorials, and food photography',
    monthlyVisitors: 55000,
    monthlyPageViews: 165000,
    trafficSources: { organic: 45, social: 45, paid: 5, direct: 5 },
    socialFollowers: { youtube: 35000, instagram: 28000, pinterest: 40000, facebook: 10000 },
    engagementRate: 5.8,
    totalClicks: 12000,
    totalOrders: 480,
    verified: false,
    qualityScore: 75
  },
  {
    username: 'fitnesspro',
    email: 'fitnesspro@example.com',
    bio: 'Personal trainer and fitness coach',
    niche: 'Sports & Fitness',
    categories: ['youtube', 'sports-fitness', 'instagram'],
    website: 'https://fitnesspro.example.com',
    domain: 'fitnesspro.example.com',
    description: 'Workout routines, fitness tips, and motivation',
    monthlyVisitors: 75000,
    monthlyPageViews: 220000,
    trafficSources: { organic: 40, social: 50, paid: 5, direct: 5 },
    socialFollowers: { youtube: 55000, instagram: 42000, tiktok: 30000, facebook: 15000 },
    engagementRate: 6.5,
    totalClicks: 16000,
    totalOrders: 640,
    verified: true,
    qualityScore: 86
  },
  {
    username: 'homeimprover',
    email: 'homeimprover@example.com',
    bio: 'DIY home improvement and interior design enthusiast',
    niche: 'Home & Garden',
    categories: ['blogger', 'home-garden', 'pinterest'],
    website: 'https://homeimprover.example.com',
    domain: 'homeimprover.example.com',
    description: 'Home renovation projects, DIY tutorials, and design inspiration',
    monthlyVisitors: 42000,
    monthlyPageViews: 125000,
    trafficSources: { organic: 60, social: 30, paid: 5, direct: 5 },
    socialFollowers: { pinterest: 60000, instagram: 25000, youtube: 15000, facebook: 8000 },
    engagementRate: 4.8,
    totalClicks: 9000,
    totalOrders: 360,
    verified: false,
    qualityScore: 72
  },
  {
    username: 'financeexpert',
    email: 'financeexpert@example.com',
    bio: 'Financial advisor sharing money management tips',
    niche: 'Finance & Insurance',
    categories: ['blogger', 'finance', 'linkedin'],
    website: 'https://financeexpert.example.com',
    domain: 'financeexpert.example.com',
    description: 'Personal finance advice, investment tips, and money management',
    monthlyVisitors: 38000,
    monthlyPageViews: 110000,
    trafficSources: { organic: 65, social: 25, paid: 5, direct: 5 },
    socialFollowers: { linkedin: 15000, twitter: 12000, facebook: 8000, youtube: 10000 },
    engagementRate: 3.9,
    totalClicks: 7500,
    totalOrders: 300,
    verified: true,
    qualityScore: 80
  },
  {
    username: 'gamingstreamer',
    email: 'gamingstreamer@example.com',
    bio: 'Gaming content creator and Twitch streamer',
    niche: 'Entertainment',
    categories: ['twitch', 'youtube', 'entertainment'],
    website: 'https://gamingstreamer.example.com',
    domain: 'gamingstreamer.example.com',
    description: 'Gaming streams, reviews, and esports content',
    monthlyVisitors: 150000,
    monthlyPageViews: 450000,
    trafficSources: { organic: 30, social: 60, paid: 5, direct: 5 },
    socialFollowers: { twitch: 85000, youtube: 120000, twitter: 35000, instagram: 28000 },
    engagementRate: 8.2,
    totalClicks: 35000,
    totalOrders: 1400,
    verified: true,
    qualityScore: 94
  }
];

// Main seed function
const seedDiscoveryData = async () => {
  try {
    console.log('🌱 Starting discovery data seed process...\n');

    // Clear existing discovery affiliates (optional - comment out if you want to keep them)
    console.log('🧹 Clearing existing discovery affiliates...');
    await Affiliate.deleteMany({ 
      'discovery.discoverable': true,
      stores: { $size: 0 } // Only delete affiliates with no store associations
    });
    console.log('✅ Cleared existing discovery affiliates\n');

    let createdCount = 0;
    let skippedCount = 0;

    for (const profile of discoveryProfiles) {
      try {
        // Check if user already exists
        let user = await User.findOne({ email: profile.email });
        
        if (!user) {
          // Create new user
          const hashedPassword = await hashPassword('password123');
          user = new User({
            username: profile.username,
            email: profile.email,
            password: hashedPassword,
            role: 'affiliate',
            emailVerified: true
          });
          await user.save();
          console.log(`✅ Created user: ${profile.username}`);
        } else {
          console.log(`ℹ️  User already exists: ${profile.username}`);
        }

        // Check if affiliate profile already exists
        let affiliate = await Affiliate.findOne({ user: user._id });
        
        if (!affiliate) {
          // Create affiliate profile with discovery data
          affiliate = new Affiliate({
            user: user._id,
            referralCode: `AFF${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            status: 'approved',
            profile: {
              website: profile.website,
              bio: profile.bio,
              niche: profile.niche
            },
            discovery: {
              categories: profile.categories,
              websiteInfo: {
                url: profile.website,
                domain: profile.domain,
                description: profile.description,
                platform: 'wordpress',
                sslStatus: true
              },
              trafficMetrics: {
                monthlyVisitors: profile.monthlyVisitors,
                monthlyPageViews: profile.monthlyPageViews,
                trafficSources: profile.trafficSources,
                topCountries: [
                  { country: 'US', percentage: 45 },
                  { country: 'UK', percentage: 20 },
                  { country: 'CA', percentage: 15 },
                  { country: 'AU', percentage: 10 },
                  { country: 'Other', percentage: 10 }
                ]
              },
              engagementMetrics: {
                socialFollowers: profile.socialFollowers,
                engagementRate: profile.engagementRate,
                averagePostReach: profile.monthlyVisitors * 0.3,
                emailListSize: Math.floor(profile.monthlyVisitors * 0.1)
              },
              networkStats: {
                totalPrograms: Math.floor(Math.random() * 10) + 1,
                activePrograms: Math.floor(Math.random() * 5) + 1,
                totalClicks: profile.totalClicks,
                totalConversions: profile.totalOrders,
                totalCommissions: profile.totalOrders * 25, // Average $25 commission
                averageConversionRate: (profile.totalOrders / profile.totalClicks) * 100,
                averageOrderValue: 75
              },
              discoverable: true,
              publicProfile: true,
              contactPreferences: {
                allowInvitations: true,
                allowDirectContact: false
              }
            },
            verification: {
              verified: profile.verified,
              verifiedAt: profile.verified ? new Date() : null,
              qualityScore: profile.qualityScore,
              badges: profile.verified ? ['verified'] : []
            },
            stats: {
              totalClicks: profile.totalClicks,
              totalOrders: profile.totalOrders,
              totalRevenue: profile.totalOrders * 75,
              totalEarnings: profile.totalOrders * 25,
              totalPaid: profile.totalOrders * 20,
              totalPending: profile.totalOrders * 5
            },
            stores: [] // Empty stores array - not associated with any merchant
          });
          
          await affiliate.save();
          createdCount++;
          console.log(`✅ Created discoverable affiliate: ${profile.username} (${profile.niche})`);
        } else {
          // Update existing affiliate with discovery data if missing
          if (!affiliate.discovery || !affiliate.discovery.categories || affiliate.discovery.categories.length === 0) {
            affiliate.discovery = {
              categories: profile.categories,
              websiteInfo: {
                url: profile.website,
                domain: profile.domain,
                description: profile.description,
                platform: 'wordpress',
                sslStatus: true
              },
              trafficMetrics: {
                monthlyVisitors: profile.monthlyVisitors,
                monthlyPageViews: profile.monthlyPageViews,
                trafficSources: profile.trafficSources,
                topCountries: [
                  { country: 'US', percentage: 45 },
                  { country: 'UK', percentage: 20 },
                  { country: 'CA', percentage: 15 },
                  { country: 'AU', percentage: 10 },
                  { country: 'Other', percentage: 10 }
                ]
              },
              engagementMetrics: {
                socialFollowers: profile.socialFollowers,
                engagementRate: profile.engagementRate,
                averagePostReach: profile.monthlyVisitors * 0.3,
                emailListSize: Math.floor(profile.monthlyVisitors * 0.1)
              },
              networkStats: {
                totalPrograms: Math.floor(Math.random() * 10) + 1,
                activePrograms: Math.floor(Math.random() * 5) + 1,
                totalClicks: profile.totalClicks,
                totalConversions: profile.totalOrders,
                totalCommissions: profile.totalOrders * 25,
                averageConversionRate: (profile.totalOrders / profile.totalClicks) * 100,
                averageOrderValue: 75
              },
              discoverable: true,
              publicProfile: true,
              contactPreferences: {
                allowInvitations: true,
                allowDirectContact: false
              }
            };
            affiliate.verification = {
              verified: profile.verified,
              verifiedAt: profile.verified ? new Date() : null,
              qualityScore: profile.qualityScore,
              badges: profile.verified ? ['verified'] : []
            };
            await affiliate.save();
            console.log(`✅ Updated affiliate with discovery data: ${profile.username}`);
            createdCount++;
          } else {
            skippedCount++;
            console.log(`⏭️  Skipped (already has discovery data): ${profile.username}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error creating ${profile.username}:`, error.message);
      }
    }

    console.log(`\n✅ Discovery data seeding completed!`);
    console.log(`📊 Created/Updated: ${createdCount} affiliates`);
    console.log(`⏭️  Skipped: ${skippedCount} affiliates`);
    console.log(`\n💡 These affiliates will appear in the Discovery page`);
    console.log(`   They are NOT associated with any merchant stores`);
    console.log(`   Default password for all accounts: password123\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding discovery data:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed
connectDB().then(() => {
  seedDiscoveryData();
});

