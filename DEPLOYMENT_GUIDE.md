# Deployment Guide - Render.com

## Step-by-Step Deployment to Render

### Step 1: Prepare Repository

1. **Create GitHub repository** (already done: https://github.com/RandyMyers/affiliateShares.git)

2. **Initialize git in server folder:**
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial commit: Affiliate Network API server"
   ```

3. **Add remote and push:**
   ```bash
   git remote add origin https://github.com/RandyMyers/affiliateShares.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Set Up MongoDB Atlas (Recommended)

1. **Create MongoDB Atlas account:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create free cluster

2. **Get connection string:**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database password
   - Example: `mongodb+srv://username:password@cluster.mongodb.net/affiliateNetwork`

### Step 3: Deploy to Render

1. **Sign up/Login to Render:**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `RandyMyers/affiliateShares`
   - Select the repository

3. **Configure Service:**
   - **Name:** `affiliate-network-api` (or your preferred name)
   - **Environment:** `Node`
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** `server` (important!)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

4. **Set Environment Variables:**
   Click "Advanced" → "Add Environment Variable" and add:

   **Required:**
   ```
   NODE_ENV=production
   PORT=5000
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/affiliateNetwork
   JWT_SECRET=your-very-long-random-secret-key-here
   REFRESH_TOKEN_SECRET=another-very-long-random-secret-key-here
   ```

   **Cloudinary (for file uploads):**
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

   **Email (for password reset, etc.):**
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

   **Frontend URLs (for CORS):**
   ```
   FRONTEND_URL=https://your-merchant-portal.com
   PUBLISHER_URL=https://your-affiliate-portal.com
   ```

5. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your app
   - Wait for deployment to complete (usually 2-5 minutes)

6. **Get Your API URL:**
   - After deployment, Render will provide a URL like:
   - `https://affiliate-network-api.onrender.com`
   - This is your production API URL!

### Step 4: Configure WordPress Plugin

1. **Go to WordPress Admin:**
   - WooCommerce → Affiliate Network

2. **Enter API Server URL:**
   - Use your Render URL: `https://affiliate-network-api.onrender.com`
   - No trailing slash, no `/api`

3. **Enter Merchant ID and save**

### Step 5: Test Deployment

1. **Test API endpoint:**
   ```
   https://your-render-url.onrender.com/api/plugin/test
   ```

2. **Test from WordPress plugin:**
   - Click "Test Connection" in plugin settings
   - Should show success message

## Important Notes

### Root Directory
- **Must set Root Directory to `server`** in Render settings
- This tells Render where your `package.json` and `app.js` are located

### Environment Variables
- Never commit `.env` file to GitHub
- Add all secrets in Render dashboard
- Use `.env.example` as reference

### MongoDB Atlas
- Whitelist Render IPs (or use 0.0.0.0/0 for development)
- Use strong database password
- Enable authentication

### Free Tier Limitations
- Render free tier spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Consider upgrading for production use

### Custom Domain (Optional)
- Render allows custom domains
- Add your domain in Render dashboard
- Update DNS records as instructed

## Troubleshooting

### Build Fails
- Check build logs in Render
- Ensure `package.json` has correct scripts
- Verify Node.js version (18+)

### App Crashes
- Check runtime logs in Render
- Verify all environment variables are set
- Test MongoDB connection

### Connection Refused
- Check Render service is running
- Verify PORT environment variable
- Check firewall settings

## Next Steps

After deployment:
1. ✅ Test API endpoints
2. ✅ Configure WordPress plugin with API URL
3. ✅ Test plugin connection
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring/alerts

---

**Your API URL will be:** `https://your-service-name.onrender.com`

Use this URL in your WordPress plugin settings!

