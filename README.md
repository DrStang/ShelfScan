# Book Spine Scanner - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Git installed

---

## Backend Deployment

### Option 1: Deploy to Railway (Recommended - Easiest)

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Deploy from GitHub:**
   - Push your backend code to a GitHub repo
   - In Railway, click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Railway will auto-detect Node.js

3. **Set environment variables** in Railway dashboard:
   ```
   OPENAI_API_KEY=sk-proj-xxxxx
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

4. **Get your backend URL** from Railway (e.g., `https://your-app.railway.app`)

### Option 2: Deploy to Render

1. **Create account** at [render.com](https://render.com)

2. **Create new Web Service:**
   - Connect your GitHub repo
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Add environment variables** (same as Railway)

4. **Deploy** - Render will provide a URL

### Option 3: Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your values:**
   ```
   OPENAI_API_KEY=your_actual_key_here
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start server:**
   ```bash
   npm run dev
   ```

5. **Test health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

---

## Frontend Deployment

### Option 1: Deploy to Vercel (Recommended)

1. **Create account** at [vercel.com](https://vercel.com)

2. **Deploy:**
   - Install Vercel CLI: `npm i -g vercel`
   - Run: `vercel`
   - Follow prompts

3. **Set environment variable:**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add: `REACT_APP_API_URL` = `https://your-backend.railway.app`

4. **Redeploy** to apply env variable

### Option 2: Deploy to Netlify

1. **Create account** at [netlify.com](https://netlify.com)

2. **Deploy via drag & drop:**
   - Build your app: `npm run build`
   - Drag `build` folder to Netlify

3. **Or deploy via CLI:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod
   ```

4. **Set environment variable** in Netlify dashboard:
   - `REACT_APP_API_URL` = your backend URL

### Option 3: Local Development

1. **Create `.env.local` file:**
   ```
   REACT_APP_API_URL=http://localhost:3001
   ```

2. **Start app:**
   ```bash
   npm start
   ```

---

## 📋 Deployment Checklist

### Before Going Live:
- [ ] Backend deployed with HTTPS
- [ ] Frontend deployed with HTTPS  
- [ ] Environment variables set correctly
- [ ] CORS configured (FRONTEND_URL in backend .env)
- [ ] OpenAI API key working
- [ ] Test with real book spine image
- [ ] Rate limiting working (10 requests/15min)
- [ ] Error handling working

### Security:
- [ ] Never commit `.env` files
- [ ] Keep OpenAI API key secret
- [ ] Use HTTPS for production
- [ ] Set appropriate CORS origins

---

## 🔧 Troubleshooting

### "Failed to analyze image" error
- Check OpenAI API key is correct
- Verify you have credits in OpenAI account
- Check API key has Vision API access

### CORS errors
- Make sure `FRONTEND_URL` in backend matches your actual frontend URL
- Include protocol (https://) in URL

### Rate limit errors
- Normal behavior - wait 15 minutes
- Adjust limits in `server.js` if needed

### "No books found"
- Try a clearer image with better lighting
- Make sure book spines are visible and readable
- Try fewer books in one image

---

## 💰 Cost Estimates

### OpenAI API (pay-as-you-go):
- ~$0.01-0.03 per image scan
- 100 scans ≈ $1-3

### Hosting (Free tiers available):
- **Railway**: 500 hours/month free, then $5/month
- **Render**: 750 hours/month free
- **Vercel**: Unlimited for personal projects
- **Netlify**: 100GB bandwidth/month free

### Total: Can run entirely free or ~$5-10/month with moderate usage

---

## 📝 File Structure

```
book-scanner/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── .env (create this, don't commit)
├── frontend/
│   ├── src/
│   │   └── App.jsx (your React component)
│   ├── package.json
│   └── .env.local (create this, don't commit)
└── README.md
```

---

## 🎯 Next Steps After Deployment

1. Test thoroughly with various images
2. Monitor OpenAI API usage in dashboard
3. Set up budget alerts in OpenAI
4. Consider adding user authentication
5. Add analytics (Google Analytics, etc.)
6. Get user feedback and iterate!

---

## 🆘 Need Help?

- OpenAI API Docs: https://platform.openai.com/docs
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Express.js Docs: https://expressjs.com
