# Affiliate Network Backend API

Backend API server for the Affiliate Network platform. Handles authentication, affiliate tracking, order processing, commissions, and webhooks.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# See .env.example for required variables
```

### Development

```bash
# Start development server
npm run dev

# Server runs on http://localhost:5000
```

### Production

```bash
# Start production server
npm start

# Or use PM2
pm2 start app.js --name affiliate-api
```

## 📁 Project Structure

```
server/
├── app.js                 # Main Express application
├── config/                # Configuration files
├── controller/            # Request controllers
├── controllers/           # Additional controllers
├── middleware/            # Custom middleware (auth, error handling)
├── models/                # MongoDB models
├── routes/                # API routes
├── services/              # Business logic services
├── utils/                 # Utility functions
├── scheduler/             # Scheduled jobs
└── scripts/               # Utility scripts
```

## 🔧 Environment Variables

See `.env.example` for all required environment variables.

**Required:**
- `MONGO_URL` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret for JWT tokens
- `CLOUDINARY_*` - Cloudinary configuration for file uploads

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token

### Plugin (WordPress/WooCommerce)
- `POST /api/plugin/authenticate` - Authenticate plugin with merchant ID
- `GET /api/plugin/test` - Test connection
- `GET /api/plugin/store/:id` - Get store information
- `GET /api/tracking/:code.js` - Tracking script

### Stores
- `GET /api/stores` - List stores
- `POST /api/stores` - Create store
- `GET /api/stores/:id` - Get store details

### Programs
- `GET /api/programs` - List programs
- `POST /api/programs` - Create program
- `GET /api/public/programs` - Public program discovery

### Orders & Tracking
- `POST /api/orders` - Create order
- `GET /api/tracking` - Get tracking data
- `POST /api/webhooks/woocommerce` - WooCommerce webhook

### Commissions & Payouts
- `GET /api/commissions` - List commissions
- `POST /api/payouts` - Request payout
- `GET /api/payouts` - List payouts

See individual route files for complete API documentation.

## 🗄️ Database

Uses MongoDB with Mongoose ODM. Models are in `/models` directory.

**Key Models:**
- User, Advertiser, Affiliate
- Store, AffiliateProgram
- Order, Commission, Payout
- Tracking, TrackingLink

## 🔐 Authentication

Uses JWT (JSON Web Tokens) for authentication.

**Token Types:**
- Access Token: Short-lived (24h), used for API requests
- Refresh Token: Long-lived (7d), used to get new access tokens

## 📦 Deployment

### Render.com

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Render will auto-detect Node.js and deploy

**Required Environment Variables on Render:**
- `MONGO_URL` - MongoDB Atlas connection string
- `JWT_SECRET` - Random secret string
- `CLOUDINARY_*` - Cloudinary credentials
- `NODE_ENV=production`

### Other Platforms

Works on any Node.js hosting:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Google Cloud Run

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test
```

## 📝 Scripts

```bash
# Development
npm run dev          # Start with nodemon (auto-reload)

# Production
npm start            # Start server

# Database
npm run seed         # Seed database with sample data
```

## 🔒 Security

- JWT authentication
- Password hashing with bcrypt
- CORS configuration
- Input validation with express-validator
- Error handling middleware

## 📚 Documentation

- API routes: See `/routes` directory
- Models: See `/models` directory
- Controllers: See `/controller` and `/controllers` directories

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

[Your License Here]

---

**For WordPress Plugin Integration:**
The plugin connects to this API at: `https://your-api-url.com`
Configure the API URL in the plugin settings.

