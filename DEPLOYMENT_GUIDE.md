# Deployment Guide - Vercel + Vercel Postgres

Deploy your AI Singing Application on **Vercel** (Next.js) + **Vercel Postgres** for **free**.

---

## 📋 Prerequisites

- GitHub account (to push your code)
- Vercel account (free at vercel.com)
- Your API keys ready:
  - OpenAI API Key
  - Google Gemini API Key
  - Groq API Key
  - Google OAuth credentials

---

## ⚠️ Important: Python Backend

Your app has an optional Python backend for advanced audio analysis. On Vercel:

- **Default**: Falls back to Groq LLM analysis only (still works great!)
- **Optional**: Deploy Python backend separately for full acoustic metrics

If you want Python analysis on production:

1. Deploy Python backend to **Railway** or **Heroku** ($5-10/month)
2. Set `PYTHON_BACKEND_URL` in Vercel environment variables
3. Python backend will be optional; if it fails, LLM analysis continues

For now, proceed without Python backend (LLM-only mode).

---

## 🚀 Step 1: Prepare Your Code

### 1.1 Commit your changes

```bash
git add .
git commit -m "Prepare for Vercel deployment"
```

### 1.2 Push to GitHub

```bash
git push origin main
```

---

## 🔧 Step 2: Set Up Vercel Postgres

### 2.1 Create a Vercel Account
- Go to [vercel.com](https://vercel.com)
- Sign up with GitHub
- Create a new team/project

### 2.2 Create Vercel Postgres Database

1. Go to **Vercel Dashboard** → **Storage** → **Create Database** → **Postgres**
2. Click **Create**
3. Name your database: `singingai-db`
4. Choose region closest to you
5. Accept and create

### 2.3 Copy Connection String
- Click the database
- Go to **Connection String** tab
- Copy the **Node.js** connection string
- You'll use this in Step 3

---

## 📝 Step 3: Create Vercel Project

### 3.1 Import Your Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository**
3. Find your GitHub repo (operaa/AI SINGING APPLICATION)
4. Click **Import**

### 3.2 Configure Environment Variables

In the **Environment Variables** section, add:

```
DATABASE_URL=<your-vercel-postgres-connection-string>
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CALLBACK_URL=https://your-app-name.vercel.app/api/auth/google/callback
GOOGLE_GEMINI_API_KEY=...
GROQ_API_KEY=gsk_...
```

**Important:** Replace `your-app-name` with your actual Vercel project name.

### 3.3 Deploy

Click **Deploy** and wait for the build to complete.

---

## 🗄️ Step 4: Initialize Database

After deployment, your database needs to be set up. You have two options:

### Option A: Using Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Link your project
vercel link

# 3. Pull environment variables
vercel env pull

# 4. Run migrations
npm run db:migrate

# 5. Seed database
npm run db:seed
```

### Option B: Manual via Vercel Dashboard

1. Go to your Vercel project
2. Click **Storage** → Your database
3. Click **Data** tab
4. Run SQL migrations manually (see migrations folder)

---

## 🔐 Step 5: Update Google OAuth Callback URL

### 5.1 Update in Code
The `CALLBACK_URL` should be your Vercel deployment URL:
```
https://your-app-name.vercel.app/api/auth/google/callback
```

### 5.2 Update in Google Console
1. Go to [Google Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Edit your OAuth 2.0 Client
5. Add to **Authorized redirect URIs**:
   - `https://your-app-name.vercel.app/api/auth/google/callback`
6. Save

---

## ✅ Step 6: Verify Deployment

1. Visit `https://your-app-name.vercel.app`
2. Try to sign up with email/password
3. Test Google OAuth login
4. Record an audio sample and verify analysis works
5. Check dashboard loads with data

---

## 🚨 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```
- Verify `DATABASE_URL` is correct in Vercel dashboard
- Check Vercel Postgres IP whitelist (should allow all from Vercel)

### Migration Fails
```
Error: migration not found
```
- Ensure `migrations/` folder is committed to GitHub
- Run `npm run db:migrate` locally first to verify

### OAuth Redirect Loop
- Verify `CALLBACK_URL` matches your Vercel domain
- Ensure URL is added to Google Console

### Audio Analysis Returns Errors
- Check all API keys are valid and have sufficient quota
- Verify keys are in Vercel environment variables

---

## 📊 Monitoring & Logs

### View Deployment Logs
- Go to **Deployments** tab in Vercel
- Click the latest deployment
- Click **View Build Logs** or **Functions** logs

### Database Insights
- **Storage** → **Your database** → **Metrics**
- Monitor query performance and connections

---

## 🔄 Updating Your App

### Push updates to production

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main
```

Vercel automatically deploys on every push to `main`.

---

## 💰 Free Tier Limits

### Vercel
- **Functions**: 100 GB-hours/month
- **Bandwidth**: 100 GB/month
- **Build minutes**: 6,000/month

### Vercel Postgres
- **Storage**: 256 MB
- **Read/Write Requests**: 500K/month
- **Backup**: 30 days

For a singing app with moderate traffic, this should be more than enough!

---

## 🎉 You're Live!

Your AI Singing Application is now live on `https://your-app-name.vercel.app`

**Next Steps:**
- Monitor performance in Vercel dashboard
- Set up custom domain (paid, optional)
- Enable password protection while in beta
- Share with beta testers

---

## 📞 Support

For issues:
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Drizzle ORM**: https://orm.drizzle.team
