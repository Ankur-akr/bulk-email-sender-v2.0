# Bulk Email Sender v2 — Production Deployment Guide

**Stack:** React (Vercel) + FastAPI (Render) + Amazon SES + Google OAuth

---

## Platform Decision

| | Vercel | Netlify | Firebase |
|---|---|---|---|
| **Frontend** | ✅ Best for Vite/React | ✅ Good | ⚠️ More setup |
| **Speed** | Fastest (Edge network) | Fast | Decent |
| **Free tier** | Generous | Generous | Limited |

| | Render | Railway |
|---|---|---|
| **Backend** | ✅ **Recommended** — persistent disk, free tier | ✅ Good, simpler |
| **Persistent storage** | ✅ Yes (needed for db.json, reports) | ⚠️ Extra cost |
| **Free tier sleep** | Spins down after 15min (upgrade $7/mo to avoid) | No sleep on paid |

**→ Use: Frontend on Vercel + Backend on Render**

---

## Step 1 — Set Up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized JavaScript origins:**
   - `http://localhost:3000` (dev)
   - `https://your-app.vercel.app` (production)
7. Add **Authorized redirect URIs:**
   - `http://localhost:3000`
   - `https://your-app.vercel.app`
8. Copy the **Client ID** and **Client Secret**

---

## Step 2 — Deploy Backend to Render

1. Push your code to GitHub (backend folder)
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add a **Disk** (for persistent db + reports):
   - Name: `app-data`
   - Mount Path: `/opt/render/project/src`
   - Size: 1 GB
6. Set **Environment Variables** in Render dashboard:

```
AWS_ACCESS_KEY_ID        = your_key
AWS_SECRET_ACCESS_KEY    = your_secret
AWS_REGION               = us-east-1
SENDER_EMAIL             = you@yourdomain.com
GOOGLE_CLIENT_ID         = xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET     = your_secret
JWT_SECRET_KEY           = (run: openssl rand -hex 32)
ADMIN_USERNAME           = admin
ADMIN_PASSWORD           = StrongPassword123!
FRONTEND_URL             = https://your-app.vercel.app
ENVIRONMENT              = production
```

7. Click **Deploy** — note your Render URL: `https://your-app.onrender.com`

---

## Step 3 — Deploy Frontend to Vercel

1. Push frontend folder to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo
4. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Set **Environment Variables** in Vercel dashboard:

```
VITE_API_URL           = https://your-app.onrender.com/api
VITE_GOOGLE_CLIENT_ID  = xxxxx.apps.googleusercontent.com
```

6. Click **Deploy** — your app is live at `https://your-app.vercel.app`

---

## Step 4 — Update Google OAuth with Real URLs

Go back to [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth client:

- Add `https://your-app.vercel.app` to **Authorized JavaScript origins**
- Save

---

## Local Development

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn app:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

Open `http://localhost:3000`

---

## Auth Flow

```
User clicks "Continue with Google"
  → Google popup opens
  → User approves
  → Google returns ID token to frontend
  → Frontend POSTs token to /api/auth/google
  → Backend verifies token with Google
  → Backend returns JWT
  → Frontend stores JWT in localStorage
  → All API calls send: Authorization: Bearer <jwt>
```

---

## Environment Variables Reference

### Backend (Render)
| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `JWT_SECRET_KEY` | Random 32+ char string (`openssl rand -hex 32`) |
| `JWT_EXPIRE_HOURS` | Token lifetime (default: 24) |
| `ALLOWED_DOMAINS` | Restrict to email domains e.g. `yourco.com` (optional) |
| `FRONTEND_URL` | Your Vercel URL for CORS |
| `AWS_ACCESS_KEY_ID` | AWS IAM key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret |
| `AWS_REGION` | SES region |
| `SENDER_EMAIL` | Verified SES sender |
| `ADMIN_USERNAME` | Fallback login username |
| `ADMIN_PASSWORD` | Fallback login password |

### Frontend (Vercel)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Your Render backend URL + `/api` |
| `VITE_GOOGLE_CLIENT_ID` | Same Google Client ID as backend |
