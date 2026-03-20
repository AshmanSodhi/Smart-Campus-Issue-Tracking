import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ALLOWED_GOOGLE_DOMAIN = (import.meta.env.VITE_ALLOWED_GOOGLE_DOMAIN || "vitstudent.ac.in").toLowerCase();
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

console.log("🔐 [Supabase Init] URL:", SUPABASE_URL);
console.log("🔐 [Supabase Init] Key exists:", !!SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ [Supabase] Missing credentials! Check .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("✅ [Supabase] Client initialized successfully");

// ============ AUTH FUNCTIONS ============

function clearLocalAuth() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
}

function getRoleFromEmail(email) {
  const normalized = email.toLowerCase();
  return ADMIN_EMAILS.includes(normalized) ? "admin" : "student";
}

function isAllowedStudentDomain(email) {
  return email.toLowerCase().endsWith(`@${ALLOWED_GOOGLE_DOMAIN}`);
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        hd: ALLOWED_GOOGLE_DOMAIN,
        prompt: "select_account",
      },
    },
  });

  if (error) {
    console.error("❌ [Auth] Google sign-in failed:", error);
    throw error;
  }
}

export async function initializeAuthFromSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("❌ [Auth] Session fetch failed:", error);
    clearLocalAuth();
    return null;
  }

  const user = data?.session?.user;
  const email = user?.email;

  if (!email) {
    clearLocalAuth();
    return null;
  }

  if (!isAllowedStudentDomain(email)) {
    console.error("❌ [Auth] Email domain not allowed:", email);
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error(`Only @${ALLOWED_GOOGLE_DOMAIN} accounts are allowed.`);
  }

  const role = getRoleFromEmail(email);
  localStorage.setItem("userRole", role);
  localStorage.setItem("userEmail", email);
  return role;
}

export function getRole() {
  return localStorage.getItem("userRole");
}

export function getEmail() {
  return localStorage.getItem("userEmail");
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("❌ [Auth] Sign-out failed:", error);
  }
  clearLocalAuth();
}

// ============ ISSUE FUNCTIONS ============

// Submit a new issue
export async function submitIssue(issueData) {
  try {
    const { title, description, location, category } = issueData;
    const studentEmail = getEmail();

    console.log("📝 [submitIssue] Email from localStorage:", studentEmail);
    console.log("📝 [submitIssue] Supabase URL:", SUPABASE_URL);
    console.log("📝 [submitIssue] Submitting issue:", { title, description, location, category, studentEmail });

    if (!studentEmail) {
      console.error("❌ [submitIssue] ERROR: Email not found in localStorage!");
      return null;
    }

    // Insert issue into Supabase
    const { data, error } = await supabase.from("issues").insert([
      {
        title,
        description,
        location,
        category,
        status: "Pending",
        technician: "Not Assigned",
        student_email: studentEmail,
        created_at: new Date().toISOString(),
      },
    ]).select();

    if (error) {
      console.error("❌ [submitIssue] Supabase error:", error);
      console.error("   Error code:", error.code);
      console.error("   Error message:", error.message);
      console.error("   Error details:", error.details);
      return null;
    }

    console.log("✅ [submitIssue] Issue submitted successfully:", data);
    return data;
  } catch (err) {
    console.error("❌ [submitIssue] Catch error:", err);
    return null;
  }
}

// Get all issues for student
export async function getStudentIssues() {
  try {
    const studentEmail = getEmail();

    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .eq("student_email", studentEmail)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching issues:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

// Get all issues for admin
export async function getAllIssues() {
  try {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching issues:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

// Update issue status
export async function updateIssueStatus(issueId, status) {
  try {
    const { data, error } = await supabase
      .from("issues")
      .update({ status })
      .eq("id", issueId);

    if (error) {
      console.error("Error updating status:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

// Assign technician to issue
export async function assignTechnician(issueId, technicianName) {
  try {
    const { data, error } = await supabase
      .from("issues")
      .update({ technician: technicianName })
      .eq("id", issueId);

    if (error) {
      console.error("Error assigning technician:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

// ============ IMAGE UPLOAD FUNCTIONS ============

// Upload image to Supabase storage
export async function uploadIssueImage(file, issueId) {
  try {
    if (!file) {
      console.warn("⚠️ [uploadIssueImage] No file provided");
      return null;
    }

    console.log("📸 [uploadIssueImage] Starting upload...");
    console.log("   File name:", file.name);
    console.log("   File size:", file.size, "bytes");
    console.log("   File type:", file.type);
    console.log("   Issue ID:", issueId);

    // Generate unique filename - remove special characters
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filename = `issue-${issueId}-${Date.now()}.${fileExt}`;
    const filePath = `issues/${filename}`;

    console.log("📸 [uploadIssueImage] Upload path:", filePath);

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("issue-images")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("❌ [uploadIssueImage] Storage upload failed:");
      console.error("   Code:", error.code);
      console.error("   Message:", error.message);
      console.error("   Full error:", error);
      return null;
    }

    console.log("✅ [uploadIssueImage] File uploaded:", data);

    // Get public URL
    const { data: publicData } = supabase.storage
      .from("issue-images")
      .getPublicUrl(filePath);

    console.log("🔗 [uploadIssueImage] Public URL:", publicData?.publicUrl);
    return publicData.publicUrl;

  } catch (err) {
    console.error("❌ [uploadIssueImage] Catch error:", err);
    return null;
  }
}

// Save image reference to database
export async function saveImageReference(issueId, imageUrl) {
  try {
    console.log("💾 [saveImageReference] Saving reference...");
    console.log("   Issue ID:", issueId);
    console.log("   Image URL:", imageUrl);

    const { data, error } = await supabase.from("issue_images").insert([
      {
        issue_id: issueId,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      console.error("❌ [saveImageReference] Database error:");
      console.error("   Code:", error.code);
      console.error("   Message:", error.message);
      console.error("   Full error:", error);
      return null;
    }

    console.log("✅ [saveImageReference] Reference saved:", data);
    return data;
  } catch (err) {
    console.error("❌ [saveImageReference] Catch error:", err);
    return null;
  }
}

// Get images for an issue
export async function getIssueImages(issueId) {
  try {
    const { data, error } = await supabase
      .from("issue_images")
      .select("*")
      .eq("issue_id", issueId);

    if (error) {
      console.error("Error fetching images:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

export { supabase };

// ============ DIAGNOSTIC FUNCTIONS ============

export async function checkSetup() {
  console.log("\n🔍 === SMART CAMPUS SETUP DIAGNOSTIC ===\n");

  // 1. Check Supabase connection
  console.log("1️⃣ Checking Supabase connection...");
  console.log("   URL:", SUPABASE_URL);
  console.log("   Key exists:", !!SUPABASE_ANON_KEY);

  // 2. Check tables exist
  console.log("\n2️⃣ Checking database tables...");
  try {
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("count", { count: "exact" })
      .limit(1);
    console.log("   issues table:", issuesError ? "❌ " + issuesError.message : "✅ OK");

    const { data: images, error: imagesError } = await supabase
      .from("issue_images")
      .select("count", { count: "exact" })
      .limit(1);
    console.log("   issue_images table:", imagesError ? "❌ " + imagesError.message : "✅ OK");
  } catch (err) {
    console.error("   Error checking tables:", err);
  }

  // 3. Check storage bucket
  console.log("\n3️⃣ Checking storage bucket...");
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error("   ❌ Error listing buckets:", bucketsError.message);
    } else {
      const issueImagesBucket = buckets.find(b => b.name === "issue-images");
      if (issueImagesBucket) {
        console.log("   ✅ issue-images bucket found");
        console.log("      Public:", issueImagesBucket.public);
      } else {
        console.error("   ❌ issue-images bucket NOT FOUND");
        console.log("   Available buckets:", buckets.map(b => b.name));
      }
    }
  } catch (err) {
    console.error("   Error checking buckets:", err);
  }

  // 4. Check localStorage
  console.log("\n4️⃣ Checking localStorage...");
  console.log("   userEmail:", localStorage.getItem("userEmail"));
  console.log("   userRole:", localStorage.getItem("userRole"));

  console.log("\n✅ Diagnostic complete\n");
}
