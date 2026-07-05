# Quick Deployment Checklist ✅

Follow these steps to deploy your app to Vercel in 10 minutes.

---

## Step 1: Commit Code to GitHub (2 min)

```bash
git add .
git commit -m "Setup for Vercel deployment"
git push origin main
```

Make sure your repo is public or you have GitHub connected to Vercel.

---

## Step 2: Create Vercel Postgres Database (3 min)

1. Go to [vercel.com](https://vercel.com/dashboard)
2. Click **Storage** → **Create Database** → **Postgres**
3. Name: `singingai-db`
4. Choose closest region
5. **Copy the Node.js connection string** (you'll need this)

---

## Step 3: Deploy on Vercel (3 min)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your GitHub repo
4. **Set Environment Variables** (from .env.example):
   ```
   DATABASE_URL = <paste from step 2>
   OPENAI_API_KEY = sk-...
   GOOGLE_CLIENT_ID = ...
   GOOGLE_CLIENT_SECRET = ...
   GOOGLE_GEMINI_API_KEY = ...
   GROQ_API_KEY = gsk_...
   CALLBACK_URL = https://[your-app-name].vercel.app/api/auth/google/callback
   ```
   Replace `[your-app-name]` with your project name
5. Click **Deploy** → Wait ~2-3 minutes

---

## Step 4: Initialize Database (2 min)

After deployment succeeds:

```bash
# Install Vercel CLI
npm install -g vercel

# Link your project
vercel link

# Pull environment variables
vercel env pull

# Run migrations
npm run db:migrate

# Seed data
npm run db:seed
```

---

## Step 5: Update Google OAuth (Optional but recommended)

1. Go to [Google Console](https://console.cloud.google.com)
2. Select your project → **APIs & Services** → **Credentials**
3. Edit your OAuth Client
4. Add to **Authorized redirect URIs**:
   ```
   https://[your-app-name].vercel.app/api/auth/google/callback
   ```
5. Save

---

## ✅ Done!

Visit `https://[your-app-name].vercel.app` and test:
- Sign up with email
- Google OAuth login
- Record audio and check analysis
- Dashboard loads

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection error | Check DATABASE_URL in Vercel dashboard is correct |
| OAuth redirect loop | Verify CALLBACK_URL matches and is in Google Console |
| Migrations fail | Ensure migrations/ folder is committed to GitHub |
| API errors | Check all API keys are valid and have quota |

---

## Key Files Created

- `.env.example` - Template for environment variables
- `vercel.json` - Vercel deployment config
- `DEPLOYMENT_GUIDE.md` - Full deployment guide (this file)
- `QUICK_DEPLOY.md` - Quick checklist (you're reading this)

---

## Need Help?

- **DEPLOYMENT_GUIDE.md** - Full detailed guide
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
