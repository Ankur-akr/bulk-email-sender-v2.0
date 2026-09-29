# 📧 Bulk Email Sender Pro

> A production-ready bulk email campaign platform built with React, FastAPI, PostgreSQL, and AWS SES.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![AWS SES](https://img.shields.io/badge/AWS-SES-orange?logo=amazonaws)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Architecture
![Architecture](Screenshots/Architecture.png)


## 🌐 Live Demo

### Frontend
**https://mail.ankurrai.in**

### Backend API
**https://bulk-email-sender-v2-0.onrender.com**

### Health Endpoint
**https://bulk-email-sender-v2-0.onrender.com/api/health**

---

# 📖 Overview

Bulk Email Sender Pro is a cloud-based email campaign platform that allows users to send personalized emails to thousands of recipients securely using Amazon SES.

The application supports Google OAuth authentication, campaign tracking, CSV uploads, email personalization, delivery reports, and multi-user data isolation.

---

# ✨ Features

## Authentication

- Google OAuth 2.0 Login
- JWT Authentication
- Admin Login
- Secure Protected APIs

---

## Email Campaigns

- Create Email Campaigns
- Rich Text Email Editor
- HTML Email Support
- Plain Text Email Support
- Personalized Variables

Example

```
Hello {name},

Welcome to our platform.
```

---

## CSV Upload

Supports:

- UTF-8
- UTF-8 BOM
- CP1252
- Latin-1

Features

- Duplicate Email Detection
- Email Validation
- Empty Row Removal
- Extra Column Support
- Automatic Encoding Detection

---

## Campaign Tracking

View

- Total Emails
- Sent Emails
- Failed Emails
- Success Rate
- Live Progress
- Campaign Status

---

## Reports

Generate

- Sent Report
- Failed Report

Download reports as CSV directly from PostgreSQL.

---

## Dashboard

- Campaign Overview
- Statistics
- Search
- Filters
- Pagination

---

## User Isolation

Each user can only access

- Their Campaigns
- Their Reports
- Their Contacts
- Their Settings

Complete multi-user PostgreSQL architecture.

---

# 🏗 Architecture

```
                React + Vite
                      │
                      │
          JWT Authentication
                      │
                      ▼
          FastAPI REST Backend
                      │
      ┌───────────────┼──────────────┐
      │               │              │
 PostgreSQL       AWS SES      Google OAuth
      │               │              │
 Campaigns      Email Sending    Authentication
 Results
 Reports
```

---

# 🛠 Tech Stack

## Frontend

- React.js
- Vite
- Tailwind CSS
- Axios
- React Router
- React Toastify

---

## Backend

- FastAPI
- Python
- Pandas
- JWT
- Boto3
- Google Auth
- Uvicorn

---

## Database

- PostgreSQL (any hosted provider — Neon, Supabase, Aiven, …)

---

## Cloud Services

- AWS SES
- Google OAuth 2.0
- Render
- Vercel
- Cloudflare DNS

---

# 📂 Project Structure

```
bulk-email-sender-v2/

│
├── frontend/
│   ├── src/
│   ├── pages/
│   ├── components/
│   ├── services/
│   └── hooks/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── database.py
│   ├── auth_utils.py
│   ├── app.py
│   └── requirements.txt
│
└── README.md
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/Ankur-akr/bulk-email-sender-v2.0.git
```

```
cd bulk-email-sender-v2.0
```

---

## Frontend

```
cd frontend
npm install
npm run dev
```

---

## Backend

```
cd backend

python -m venv venv

source venv/bin/activate
```

Windows

```
venv\Scripts\activate
```

Install packages

```
pip install -r requirements.txt
```

Run

```
uvicorn app:app --reload
```

---

# ⚙ Environment Variables

```
JWT_SECRET_KEY=

JWT_ALGORITHM=HS256

JWT_EXPIRE_HOURS=24

ADMIN_USERNAME=

ADMIN_PASSWORD=          # optional; empty disables admin login

DATABASE_URL=            # postgresql://user:pass@host/db?sslmode=require

AWS_ACCESS_KEY_ID=

AWS_SECRET_ACCESS_KEY=

AWS_REGION=

SENDER_EMAIL=

GOOGLE_CLIENT_ID=

FRONTEND_URL=
```

---

# 📧 Email Flow

```
Upload CSV
      │
      ▼
Validate Contacts
      │
      ▼
Create Campaign
      │
      ▼
Send using AWS SES
      │
      ▼
Store Results
      │
      ▼
Generate Reports
      │
      ▼
Download CSV
```

---

# 🔒 Security

- JWT Authentication
- Protected APIs
- Google OAuth 2.0
- Campaign Ownership Verification
- PostgreSQL User Isolation
- Secure Environment Variables

---

# 📊 Key Features

✔ Personalized Emails

✔ CSV Import

✔ HTML Emails

✔ Campaign History

✔ Download Reports

✔ Google Authentication

✔ PostgreSQL Storage

✔ AWS SES Integration

✔ Production Deployment

✔ Custom Domain

✔ Health Monitoring

---

# 📸 Screenshots

Login Page
![Login Page](Screenshots/Login Page.png)

Dashboard
![Dashboard](Screenshots/Dashboard.png)

Campaign Page
![Campaign Page](Screenshots/Campaign Page.png)

Reports
![Reports](Screenshots/Reports.png)

CSV Upload
![CSV Upload](Screenshots/UploadCSV.png)

Settings 
![Settings](Screenshots/Settings.png)



---

# 🌍 Deployment

Frontend

- Vercel

Backend

- Render

Database

- External hosted PostgreSQL (e.g. Neon or Supabase). Render's free Postgres expires, so it is no longer provisioned by `render.yaml`.

### Moving to a new PostgreSQL database

1. Create a Postgres database with any provider and copy its connection string.
2. In the Render dashboard → your web service → **Environment**, set `DATABASE_URL` to that string
   (`postgres://…`, `postgresql://…` and `?sslmode=require` are all handled automatically).
3. Redeploy. Tables are created automatically on startup.
4. Verify: open `https://<your-service>.onrender.com/api/health/db` — it should return `{"database": "connected"}`.

Notes

- Pooled endpoints (Supabase port `6543`, Neon `-pooler` hosts) are detected automatically.
- `ADMIN_PASSWORD` has no default any more — leave it unset to disable the admin login.
- Generate a strong `JWT_SECRET_KEY` (`openssl rand -hex 32`).

Email

- AWS SES

Domain

- Hostinger DNS

SSL

- Cloudflare

---

# 🔮 Future Improvements

- Email Scheduling
- Contact Groups
- Email Templates
- Open Tracking
- Click Tracking
- Campaign Analytics
- Docker Support
- CI/CD Pipeline
- Redis Queue
- Background Workers

---

# 👨‍💻 Author

**Ankur Kumar Rai**

Computer Science Engineering Student

Full Stack Developer

📧 Email

ankurrai5711@gmail.com

🌐 Portfolio

https://mail.ankurrai.in

GitHub

https://github.com/Ankur-akr

LinkedIn

www.linkedin.com/in/ankur-akr

---

# ⭐ Support

If you like this project,

please ⭐ Star the repository on GitHub.

---

# 📄 License

This project is licensed under the MIT License.