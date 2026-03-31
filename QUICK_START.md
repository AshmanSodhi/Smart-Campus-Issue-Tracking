# Supabase Integration - Quick Start

## ✅ What's Been Done

1. ✅ Installed `@supabase/supabase-js` package
2. ✅ Created `.env.local` file (template for your credentials)
3. ✅ Created `supabaseService.js` with all database operations
4. ✅ Updated StudentDashboard:
   - Fetches issues from Supabase
   - Add image upload with preview
   - Display images for each issue
5. ✅ Updated AdminDashboard:
   - Fetches all issues from Supabase
   - Assign technicians
   - Update issue status
6. ✅ Added CSS for image upload and gallery

---

## 🚀 Next Steps: Setup Supabase (5-10 minutes)

### Step 1️⃣: Create Supabase Project

- Go to https://supabase.com → Sign up (free)
- Click "New Project"
- Name it: `gov-issue-tracking`
- Choose password and region
- Wait 2-3 minutes

### Step 2️⃣: Create Database Tables

1. In Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Copy-paste everything from `SUPABASE_SETUP.sql`
4. Click **"Run"**

### Step 3️⃣: Create Storage Bucket

1. Go to **Storage → Buckets**
2. Click **"New Bucket"**
3. Name: `issue-images`
4. **Toggle "Public bucket" ON** ⭐ Important!
5. Click **"Create"**

### Step 4️⃣: Add Your Credentials

1. In Supabase Dashboard → **Settings → API**
2. Copy your **Project URL** and **Anon Public Key**
3. Open `.env.local` in your project:
   ```
   VITE_SUPABASE_URL=https://your-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ADMIN_EMAILS=admin1@vitstudent.ac.in,admin2@vitstudent.ac.in
   VITE_TECHNICIAN_EMAILS=tech1@vitstudent.ac.in,tech2@vitstudent.ac.in
   ```
4. Save the file

### Step 4.6️⃣: Apply Updated Schema

1. Open **SQL Editor**
2. Run `SUPABASE_SETUP.sql` again on a fresh DB, OR run the `OPTIONAL MIGRATION` ALTER statements at the bottom for existing DBs
3. This adds `priority`, resolution metadata, and `notifications` table

### Step 4.5️⃣: Enable Google Login in Supabase Auth

1. Go to **Authentication → Providers → Google**
2. Enable Google provider and add your Google OAuth Client ID + Secret
3. Add redirect URL: `http://localhost:5173`
4. In Google Cloud Console, add the same redirect URL in OAuth client settings

### Step 5️⃣: Start Development

```bash
cd smart-campus
npm run dev
```

---

## 🧪 Test It

1. Click **Continue with Google** on login page
2. Use any Google account
3. Submit an issue with an image
4. Verify admin routing with an email mapped to `admin` in `user_roles`
5. Verify technician routing with an email mapped to `technician` in `user_roles`
6. See all issues and manage them
7. Click "View" on images to see the uploaded photo

---

## 📁 New Files Created

- `.env.local` - Your Supabase credentials (don't commit!)
- `SUPABASE_SETUP.sql` - SQL to create tables
- `SUPABASE_SETUP_GUIDE.md` - Detailed instructions
- `src/services/supabaseService.js` - All database logic

## 📝 Modified Files

- `src/dashboards/StudentDashboard.jsx` - Now uses Supabase + image upload
- `src/dashboards/AdminDashboard.jsx` - Now uses Supabase
- `src/dashboards/student.css` - Added image styling
- `package.json` - Added @supabase/supabase-js

---

## ⚙️ How It Works

### Database

- **issues** table: Stores title, description, category, status, technician, student_email
- **issue_images** table: References issue_id and stores image URL

### Storage

- Images uploaded to `issue-images` bucket as public files
- URLs stored in database for easy retrieval

### Authentication

- Uses Supabase Google OAuth now
- Roles are resolved from `user_roles` in database
- Any email can sign in; role controls dashboard access
- Approved technician applications are promoted to `technician`

---

## 🆘 Troubleshooting

**Error: "Cannot find env variables"**
→ Restart `npm run dev` after creating `.env.local`

**Error: "Relational error"**
→ Make sure SQL tables were created (check Supabase SQL Editor)

**Images not saving**
→ Check that `issue-images` bucket exists and is PUBLIC

**TypeError: supabase is undefined**
→ Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local`

---

## 🎯 Next Features (Optional)

- Real authentication with Supabase Auth
- Email notifications
- Issue filtering and search
- Image gallery modal
- Admin analytics dashboard
