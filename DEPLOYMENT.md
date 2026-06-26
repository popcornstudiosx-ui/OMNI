# OMNI App - Free Deployment Guide

This application has been configured for free deployment on Railway or Render with Groq as the LLM provider.

## Prerequisites

1. **Groq API Key** (Free)
   - Sign up at https://console.groq.com
   - Create an API key in the dashboard
   - Free tier includes generous rate limits

2. **Railway or Render Account**
   - Railway: https://railway.app (free tier with $5/month credit)
   - Render: https://render.com (free tier available)

## Deployment to Railway (Recommended)

### Step 1: Prepare the Repository
```bash
cd /home/ubuntu/omni_app
git init
git add .
git commit -m "Initial commit"
```

### Step 2: Deploy to Railway
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub" or "Deploy from Git"
4. Connect your repository
5. Railway will auto-detect the Node.js project

### Step 3: Configure Environment Variables
In the Railway dashboard, set these variables:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
BUILT_IN_FORGE_API_URL=https://api.groq.com/openai
BUILT_IN_FORGE_API_KEY=your_groq_api_key
JWT_SECRET=generate_a_random_string_here
VITE_FRONTEND_FORGE_API_URL=https://api.groq.com/openai
VITE_FRONTEND_FORGE_API_KEY=your_groq_api_key
NODE_ENV=production
PORT=3000
```

### Step 4: Add PostgreSQL Plugin
1. In Railway dashboard, click "Add Service"
2. Select "PostgreSQL"
3. Railway will auto-populate DATABASE_URL

### Step 5: Deploy
Railway will automatically deploy when you push to your repository.

## Deployment to Render

### Step 1: Create a PostgreSQL Database
1. Go to https://render.com
2. Click "New +"
3. Select "PostgreSQL"
4. Choose free tier
5. Copy the internal database URL

### Step 2: Deploy the Web Service
1. Click "New +"
2. Select "Web Service"
3. Connect your GitHub repository
4. Set build command: `pnpm install && pnpm run build`
5. Set start command: `pnpm run start`

### Step 3: Configure Environment Variables
Set these in the Render dashboard:

```
DATABASE_URL=your_postgres_url_from_step_1
BUILT_IN_FORGE_API_URL=https://api.groq.com/openai
BUILT_IN_FORGE_API_KEY=your_groq_api_key
JWT_SECRET=generate_a_random_string_here
VITE_FRONTEND_FORGE_API_URL=https://api.groq.com/openai
VITE_FRONTEND_FORGE_API_KEY=your_groq_api_key
NODE_ENV=production
PORT=3000
```

### Step 4: Deploy
Click "Create Web Service" - Render will deploy automatically.

## Getting a Groq API Key

1. Visit https://console.groq.com
2. Sign up with your email
3. Go to "API Keys" section
4. Click "Create API Key"
5. Copy the key and use it in your deployment

**Free Tier Limits:**
- 30 requests per minute
- 14,000 tokens per minute
- Sufficient for testing and light production use

## Available Models on Groq

- `mixtral-8x7b-32768` - Fastest, good for general tasks
- `llama-3.1-70b-versatile` - More capable, good for complex tasks
- `llama-3.1-8b-instant` - Lightweight, fastest

## Testing the Deployment

Once deployed:

1. Visit your app URL (Railway or Render will provide it)
2. You'll be logged in as "Boss" (hardcoded single-user mode)
3. Try the chat feature - it should use Groq's LLM
4. Test file uploads - files are stored in-memory

## Troubleshooting

### Database Connection Error
- Verify DATABASE_URL is correct
- Ensure PostgreSQL service is running
- Check that the database name exists

### LLM API Errors
- Verify BUILT_IN_FORGE_API_KEY is correct
- Check Groq console for rate limit status
- Ensure API key has not expired

### Build Failures
- Check that all dependencies are listed in package.json
- Verify Node.js version compatibility (18+)
- Review build logs in the deployment dashboard

## Storage Notes

Files are stored in-memory for this deployment. For production use with persistent storage, you would need to:
1. Add S3 or similar object storage
2. Modify storage.ts to use persistent backend
3. Update environment variables accordingly

## Cost Estimate

- **Railway**: $0-5/month (free tier + optional paid)
- **Render**: $0/month (free tier)
- **Groq API**: Free tier sufficient for most use cases

Total: Completely free or minimal cost!

## Next Steps

1. Deploy the app using Railway or Render
2. Get your live URL
3. Share it with others
4. Access via mobile browser at the provided URL

For more help, visit:
- Railway: https://docs.railway.app
- Render: https://render.com/docs
- Groq: https://console.groq.com/docs
