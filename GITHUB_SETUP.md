# GitHub Setup Instructions

## Quick Setup Commands

Run these commands in the `server` folder to push to GitHub:

```bash
# Navigate to server folder
cd server

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Affiliate Network API server"

# Add remote repository
git remote add origin https://github.com/RandyMyers/affiliateShares.git

# Set main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

## Important: Root Directory for Render

When deploying to Render, you **MUST** set the **Root Directory** to `server` in Render settings.

This tells Render where your `package.json` and `app.js` are located.

## Files Included

✅ **Included in Git:**
- All source code files
- `package.json` and `package-lock.json`
- `README.md`
- `render.yaml`
- `.env.example`
- All folders: routes, models, controllers, etc.

❌ **Excluded (in .gitignore):**
- `node_modules/` (will be installed on Render)
- `.env` (sensitive - set in Render dashboard)
- Logs and temporary files

## After Pushing to GitHub

1. Go to https://render.com
2. Create new Web Service
3. Connect your GitHub repo: `RandyMyers/affiliateShares`
4. **Set Root Directory to:** `server`
5. Set environment variables
6. Deploy!

See `DEPLOYMENT_GUIDE.md` for detailed Render deployment steps.

