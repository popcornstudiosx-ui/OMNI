# OMNI App - Quick Start Deployment

## What's Changed for Free Deployment

✅ **Database**: MySQL → PostgreSQL (free tier available)
✅ **LLM Provider**: Manus Forge → Groq (free tier)
✅ **Storage**: S3/Forge → In-memory (stateless)
✅ **Auth**: OAuth → Hardcoded single-user mode
✅ **Deployment**: Configured for Railway & Render

## 5-Minute Deployment to Railway

### 1. Get Prerequisites (2 minutes)
- **Groq API Key**: Go to https://console.groq.com → Sign up → Create API key
- **Railway Account**: Go to https://railway.app → Sign up

### 2. Push Code to GitHub (1 minute)
```bash
cd /home/ubuntu/omni_app
git remote add origin https://github.com/YOUR_USERNAME/omni.git
git branch -M main
git push -u origin main
```

### 3. Deploy on Railway (2 minutes)
1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Select your `omni` repository
4. Railway auto-detects Node.js project
5. Wait for build to complete

### 4. Configure Environment Variables
In Railway dashboard, go to "Variables" and add:

```
BUILT_IN_FORGE_API_URL=https://api.groq.com/openai
BUILT_IN_FORGE_API_KEY=your_groq_api_key_here
JWT_SECRET=random_string_like_abc123xyz789
VITE_FRONTEND_FORGE_API_URL=https://api.groq.com/openai
VITE_FRONTEND_FORGE_API_KEY=your_groq_api_key_here
NODE_ENV=production
```

### 5. Add PostgreSQL Database
1. In Railway, click "Add Service"
2. Select "PostgreSQL"
3. Railway auto-populates `DATABASE_URL`

### 6. Deploy
Click "Deploy" - Railway builds and deploys automatically!

**Your app is now live at the URL shown in Railway dashboard** ✨

## Alternative: Deploy to Render

### 1. Create PostgreSQL Database
1. Go to https://render.com
2. Click "New +" → "PostgreSQL"
3. Choose free tier
4. Copy the connection string

### 2. Deploy Web Service
1. Click "New +" → "Web Service"
2. Connect GitHub repository
3. Set:
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Environment**: Node

### 3. Add Environment Variables
Same as Railway (see above)

### 4. Deploy
Click "Create Web Service" - Render deploys automatically!

## Testing Your Deployment

1. Visit the URL provided by Railway/Render
2. You're automatically logged in as "Boss"
3. Try the chat feature (uses Groq LLM)
4. Test file uploads

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Node.js version (18+), review build logs |
| LLM errors | Verify Groq API key, check rate limits at console.groq.com |
| Database errors | Ensure DATABASE_URL is set, PostgreSQL service is running |
| Files not saving | Files are in-memory; restart clears them (expected behavior) |

## Free Tier Limits

**Groq**: 30 requests/min, 14,000 tokens/min (plenty for testing)
**Railway**: $5/month free credit
**Render**: Completely free tier available
**PostgreSQL**: Free tier databases available on both platforms

## What You Get

- ✅ Full OMNI app with AI chat
- ✅ File upload capability
- ✅ Task management
- ✅ Message history
- ✅ Mobile-responsive UI
- ✅ Zero cost (or minimal)

## Next Steps

1. Deploy using Railway or Render
2. Share the live URL with others
3. Access from any browser (including mobile)
4. For persistent file storage, upgrade to paid tier or add S3

## Support

- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
- Groq docs: https://console.groq.com/docs

---

**Deployed successfully?** You're all set! 🚀
