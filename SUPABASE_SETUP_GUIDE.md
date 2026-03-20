# Supabase Setup Instructions

## Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up (free account)
3. Click "New Project"
4. Fill in details:
   - Organization: Create new or use default
   - Project name: `smart-campus`
   - Database password: Create secure password (save it!)
   - Region: Choose closest to you (e.g., Asia, US-East)
5. Wait 2-3 minutes for project initialization

## Step 2: Create Database Tables
1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy all SQL from `SUPABASE_SETUP.sql` file
4. Paste into the editor
5. Click **"Run"** button
6. Tables should be created successfully

## Step 3: Create Storage Bucket
1. In Supabase Dashboard, go to **Storage → Buckets**
2. Click **"New Bucket"** button
3. Enter name: `issue-images`
4. **IMPORTANT**: Toggle **"Public bucket"** to ON
5. Click **"Create Bucket"**

## Step 4: Get API Credentials
1. In Supabase Dashboard, go to **Settings → API**
2. Copy your:
   - **Project URL** (looks like: https://xxxx.supabase.co)
   - **Anon Public Key** (under "anon" row, Key column)
3. Paste into `.env.local` file:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_ALLOWED_GOOGLE_DOMAIN=vitstudent.ac.in
   VITE_ADMIN_EMAILS=admin1@vitstudent.ac.in,admin2@vitstudent.ac.in
   VITE_TECHNICIAN_EMAILS=tech1@vitstudent.ac.in,tech2@vitstudent.ac.in
   ```

## Step 4.1: Update Existing DB (if already created)
If you already created tables earlier, run the optional ALTER statements at the bottom of `SUPABASE_SETUP.sql` to add:
- `issues.priority`
- `issues.completion_note`
- `issues.student_feedback`
- `issues.resolved_at`
- `issues.closed_at`
- `notifications` table

## Step 5: Configure Google OAuth
1. In Supabase Dashboard, open **Authentication → Providers → Google**
2. Enable Google provider
3. Add your Google OAuth Client ID and Client Secret
4. Add your app redirect URL in Supabase, for local dev:
   - `http://localhost:5173`
5. In Google Cloud Console OAuth client config, add the same redirect URL

## Step 6: Restrict Login Domain
- App allows only `@vitstudent.ac.in` logins
- Users outside this domain are signed out automatically
- Admin access is controlled through `VITE_ADMIN_EMAILS`

## Step 7: Test Connection
1. Save `.env.local`
2. In terminal: `npm run dev`
3. Click **Continue with Google**
4. Sign in using a `@vitstudent.ac.in` account

## Technician List (for AdminDashboard)
The admin can assign issues to:
- Not Assigned
- Rajesh Kumar
- Amit Sharma
- Vikram Singh
- Suresh Patel
- Technician Team A

---

## Database Schema

### issues table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Primary key, auto-generated |
| title | VARCHAR | Issue title |
| description | TEXT | Full description |
| location | VARCHAR | Campus location |
| category | VARCHAR | Electrical/Plumbing/Internet/Cleaning/Infrastructure |
| status | VARCHAR | Pending/In Progress/Resolved |
| technician | VARCHAR | Assigned technician name |
| student_email | VARCHAR | Email of student who created issue |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-set |

### issue_images table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Primary key, auto-generated |
| issue_id | BIGINT | Foreign key to issues table |
| image_url | TEXT | Public URL of image |
| uploaded_at | TIMESTAMP | Auto-set |

---

## Troubleshooting

**"Cannot find module @supabase/supabase-js"**
→ Run: `npm install @supabase/supabase-js`

**".env.local not found"**
→ File is created automatically. Check that it's in smart-campus folder (not parent)

**"Invalid Supabase credentials"**
→ Double-check URL and key in `.env.local`
→ Check they're from same project in Supabase Dashboard

**Images not uploading**
→ Verify "issue-images" bucket exists
→ Check bucket is set to PUBLIC (not private)
→ Verify file type is .jpg, .png, .gif, .webp

---

Once you've completed these steps, share confirmation and I'll update the Dashboard components!
