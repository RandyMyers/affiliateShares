const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const fileUpload = require('express-fileupload');

// Importing route files
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const cloudinary = require('cloudinary').v2;
const app = express();

// Cloudinary Configuration
const cloudinaryConfig = require('./config/cloudinary');

// Set Cloudinary configuration as a local variable
app.use((req, res, next) => {
  cloudinary.config(cloudinaryConfig);
  next();
});

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
  });

// Middleware
app.use(cors({
  origin: '*',  // Allow requests from the frontend
  methods: ['GET', 'POST', 'PUT', 'PATCH','DELETE'],  // Adjust allowed methods as needed
  allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers if needed
}));
app.use(bodyParser.json({ limit: '10mb' })); // Adjust the limit as needed
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); 
app.use(morgan('dev')); 

app.use(
  fileUpload({
    useTempFiles: true, // Store files in memory instead of a temporary directory
    createParentPath: true, // Create the 'uploads' directory if not exists
    tempFileDir: '/tmp/',
    limits: { fileSize: 10 * 1024 * 1024 }
  })
);

// Using imported routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/stores', require('./routes/storeRoutes'));
app.use('/api/affiliates', require('./routes/affiliateRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/plugin', require('./routes/pluginRoutes'));
app.use('/api/commissions', require('./routes/commissionRoutes'));
app.use('/api/payouts', require('./routes/payoutRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/programs', require('./routes/programRoutes'));
app.use('/api/public/programs', require('./routes/publicProgramRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/broadcasts', require('./routes/broadcastRoutes'));
app.use('/api/payment-methods', require('./routes/paymentMethodRoutes'));
app.use('/api/links', require('./routes/shortLinkRoutes'));
app.use('/api/feeds', require('./routes/productFeedRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/discovery', require('./routes/discoveryRoutes'));
app.use('/api/invitations', require('./routes/invitationRoutes'));
app.use('/api/baskets', require('./routes/basketRoutes'));
app.use('/api/invitation-templates', require('./routes/invitationTemplateRoutes'));
app.use('/api/saved-searches', require('./routes/savedSearchRoutes'));
app.use('/api/merchant-notes', require('./routes/merchantNoteRoutes'));
app.use('/api/affiliate-ratings', require('./routes/affiliateRatingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/reconciliation', require('./routes/reconciliationRoutes'));

// Serve plugin ZIP file
app.get('/affiliate-network-woocommerce-v1.0.0.zip', (req, res) => {
  const zipPath = path.join(__dirname, '..', 'affiliate-network-woocommerce-v1.0.0.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="affiliate-network-woocommerce-v1.0.0.zip"');
    res.sendFile(zipPath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Plugin file not found'
    });
  }
});

// Error handling middleware (must be last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize scheduled jobs (only in production or when ENABLE_JOBS is true)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_JOBS === 'true') {
  try {
    const { initializeWalletScheduler } = require('./scheduler/walletScheduler');
    initializeWalletScheduler();
  } catch (error) {
    console.warn('Could not initialize wallet scheduler:', error.message);
    console.warn('Make sure node-cron is installed: npm install node-cron');
  }
}

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
