import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("[Supabase Init] URL:", SUPABASE_URL);
console.log("[Supabase Init] Key exists:", !!SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[Supabase] Missing credentials! Check .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("[Supabase] Client initialized successfully");

// ============ AUTH FUNCTIONS ============

function clearLocalAuth() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
}

function normalizeRole(role) {
  if (role === "admin" || role === "technician" || role === "student") {
    return role;
  }
  return null;
}

async function getRoleFromDatabase(email) {
  try {
    const normalized = (email || "").toLowerCase();
    if (!normalized) {
      return null;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("email", normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") {
        return null;
      }
      console.error("Error fetching role from user_roles:", error);
      return null;
    }

    return normalizeRole((data?.role || "").toLowerCase());
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

async function upsertUserRole(email, role) {
  const normalizedEmail = (email || "").toLowerCase();
  const normalizedRole = normalizeRole((role || "").toLowerCase());

  if (!normalizedEmail || !normalizedRole) {
    return;
  }

  try {
    const { error } = await supabase.from("user_roles").upsert(
      [
        {
          email: normalizedEmail,
          role: normalizedRole,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "email" }
    );

    if (error && error.code !== "42P01") {
      console.error("Error upserting user role:", error);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

async function isApprovedTechnicianEmail(email) {
  try {
    const normalized = email.toLowerCase();
    const { data, error } = await supabase
      .from("technician_applications")
      .select("id")
      .eq("email", normalized)
      .eq("status", "approved")
      .limit(1);

    if (error) {
      if (error.code === "42P01") {
        return false;
      }
      console.error("Error checking approved technician list:", error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("Error:", err);
    return false;
  }
}

async function resolveRoleByEmail(email) {
  const normalized = (email || "").toLowerCase();
  if (!normalized) {
    return null;
  }

  const dbRole = await getRoleFromDatabase(normalized);
  if (dbRole) {
    return dbRole;
  }

  if (await isApprovedTechnicianEmail(normalized)) {
    await upsertUserRole(normalized, "technician");
    return "technician";
  }

  await upsertUserRole(normalized, "student");
  return "student";
}

async function isAllowedGoogleAccount(email) {
  const role = await resolveRoleByEmail(email);
  return role === "student" || role === "admin" || role === "technician";
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    console.error("[Auth] Google sign-in failed:", error);
    throw error;
  }
}

export async function loginWithEmailAndPassword(emailInput, passwordInput) {
  const email = (emailInput || "").trim().toLowerCase();
  const password = passwordInput || "";

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[Auth] Email/password sign-in failed:", error);
    throw new Error(error.message || "Email/password login failed.");
  }

  const sessionEmail = (data?.user?.email || email).toLowerCase();
  const role = await resolveRoleByEmail(sessionEmail);

  if (!role) {
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error("Unable to resolve your role. Contact admin.");
  }

  if (role === "student") {
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error("Students can only login with Google OAuth.");
  }

  localStorage.setItem("userRole", role);
  localStorage.setItem("userEmail", sessionEmail);
  return role;
}

export async function initializeAuthFromSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[Auth] Session fetch failed:", error);
    clearLocalAuth();
    return null;
  }

  const user = data?.session?.user;
  const email = user?.email;

  if (!email) {
    clearLocalAuth();
    return null;
  }

  if (!(await isAllowedGoogleAccount(email))) {
    console.error("[Auth] No valid role mapping found for email:", email);
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error("Unable to resolve a valid role for this account.");
  }

  const role = await resolveRoleByEmail(email);
  if (!role) {
    clearLocalAuth();
    return null;
  }

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

export function getCurrentUserProfile() {
  const email = getEmail();
  const role = getRole();
  if (!email || !role) {
    return null;
  }
  return { email, role };
}

export async function getAssignableTechnicians() {
  let dbMapped = [];

  try {
    const { data, error } = await supabase.from("user_roles").select("email").eq("role", "technician");

    if (!error) {
      dbMapped = (data || []).map((row) => (row.email || "").toLowerCase()).filter(Boolean);
    } else if (error.code !== "42P01") {
      console.error("Error fetching technician roles:", error);
    }
  } catch (err) {
    console.error("Error:", err);
  }

  try {
    const { data, error } = await supabase
      .from("technician_applications")
      .select("email")
      .eq("status", "approved");

    if (error) {
      if (error.code === "42P01") {
        return Array.from(new Set([...dbMapped]));
      }
      console.error("Error fetching approved technicians:", error);
      return Array.from(new Set([...dbMapped]));
    }

    const approved = (data || []).map((row) => (row.email || "").toLowerCase()).filter(Boolean);
    return Array.from(new Set([...dbMapped, ...approved]));
  } catch (err) {
    console.error("Error:", err);
    return Array.from(new Set([...dbMapped]));
  }
}

export async function submitTechnicianApplication(application) {
  const fullName = (application.fullName || "").trim();
  const email = (application.email || "").trim().toLowerCase();
  const department = (application.department || "").trim();
  const phone = (application.phone || "").trim();
  const reason = (application.reason || "").trim();

  if (!fullName || !email || !department || !phone || !reason) {
    throw new Error("All registration fields are required.");
  }

  const existingRole = await resolveRoleByEmail(email);
  if (existingRole === "admin" || existingRole === "technician") {
    throw new Error("This email already has elevated access.");
  }

  const { data, error } = await supabase
    .from("technician_applications")
    .insert([
      {
        full_name: fullName,
        email,
        department,
        phone,
        reason,
        status: "pending",
      },
    ])
    .select();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Technician applications table is missing. Run the latest SQL setup.");
    }
    console.error("Error submitting technician application:", error);
    throw new Error("Failed to submit technician application.");
  }

  await createNotificationForRole("admin", {
    title: "New technician registration",
    message: `${fullName} requested technician access (${email}).`,
  });

  return data?.[0] || null;
}

export async function getTechnicianApplications(status = "pending") {
  try {
    let query = supabase
      .from("technician_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return [];
      }
      console.error("Error fetching technician applications:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

export async function reviewTechnicianApplication(applicationId, approve, reviewNote = "") {
  const adminEmail = getEmail() || "admin";
  const status = approve ? "approved" : "rejected";

  try {
    const { data, error } = await supabase
      .from("technician_applications")
      .update({
        status,
        review_note: reviewNote || null,
        reviewed_by: adminEmail,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      if (error.code === "42P01") {
        throw new Error("Technician applications table is missing. Run the latest SQL setup.");
      }
      console.error("Error reviewing technician application:", error);
      throw new Error("Failed to update technician application.");
    }

    if (data?.email) {
      if (approve) {
        await upsertUserRole(data.email, "technician");
      }

      await createNotificationForEmail(data.email, {
        title: `Technician application ${status}`,
        message: approve
          ? "Your technician access request was approved. You can now login as technician."
          : `Your technician access request was rejected.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[Auth] Sign-out failed:", error);
  }
  clearLocalAuth();
}

// ============ ISSUE FUNCTIONS ============

export async function submitIssue(issueData) {
  try {
    const { title, description, location, category, priority } = issueData;
    const studentEmail = getEmail();

    if (!studentEmail) {
      console.error("[submitIssue] ERROR: Email not found in localStorage!");
      return null;
    }

    const insertPayload = {
      title,
      description,
      location,
      category,
      priority: priority || "Medium",
      status: "Pending",
      technician: "Not Assigned",
      student_email: studentEmail,
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from("issues").insert([insertPayload]).select();

    // Backward compatibility for schemas where priority column is missing.
    if (error && error.code === "42703") {
      const { priority: _priority, ...legacyPayload } = insertPayload;
      ({ data, error } = await supabase.from("issues").insert([legacyPayload]).select());
    }

    if (error) {
      console.error("[submitIssue] Supabase error:", error);
      return null;
    }

    if (data?.[0]?.id) {
      await createNotificationForRole("admin", {
        issueId: data[0].id,
        title: "New issue raised",
        message: `${studentEmail} raised a new ${category} issue.`,
      });
    }

    return data;
  } catch (err) {
    console.error("[submitIssue] Catch error:", err);
    return null;
  }
}

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
  } catch (error) {
    console.error("Error fetching student issues:", error);
    return [];
  }
}

// Alias for government system terminology
export const getCitizenIssues = getStudentIssues;

export async function getAllIssues(filters = {}) {
  try {
    const { status, technician, category, priority } = filters;

    let query = supabase
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "All") {
      query = query.eq("status", status);
    }
    if (technician && technician !== "All") {
      query = query.eq("technician", technician);
    }
    if (category && category !== "All") {
      query = query.eq("category", category);
    }
    if (priority && priority !== "All") {
      query = query.eq("priority", priority);
    }

    const { data, error } = await query;

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

export async function getTechnicianIssues() {
  try {
    const technicianEmail = getEmail();
    if (!technicianEmail) {
      return [];
    }

    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .eq("technician", technicianEmail)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching technician issues:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching technician issues:", error);
    return [];
  }
}

// Alias for government system terminology
export const getOfficerIssues = getTechnicianIssues;

export async function updateIssueStatus(issueId, status, completionNote = null) {
  try {
    const updatePayload = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "Resolved") {
      updatePayload.resolved_at = new Date().toISOString();
      if (completionNote) {
        updatePayload.completion_note = completionNote;
      }
    }

    if (status === "Pending" || status === "In Progress") {
      updatePayload.resolved_at = null;
      updatePayload.closed_at = null;
    }

    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email")
      .eq("id", issueId)
      .single();

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error updating status:", error);
      return null;
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Issue status updated",
        message: `Issue #${issueId} moved to ${status}.`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function assignTechnician(issueId, technicianName) {
  try {
    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email")
      .eq("id", issueId)
      .single();

    const { data, error } = await supabase
      .from("issues")
      .update({ technician: technicianName, updated_at: new Date().toISOString() })
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error assigning technician:", error);
      return null;
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Technician assigned",
        message: `Issue #${issueId} was assigned to ${technicianName}.`,
      });
    }

    if (technicianName && technicianName !== "Not Assigned") {
      await createNotificationForEmail(technicianName, {
        issueId,
        title: "New assigned issue",
        message: `You were assigned to issue #${issueId}.`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function confirmResolution(issueId, confirmed, note = "") {
  try {
    const nextStatus = confirmed ? "Closed" : "Pending";
    const { data, error } = await supabase
      .from("issues")
      .update({
        status: nextStatus,
        student_feedback: note || null,
        closed_at: confirmed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error confirming resolution:", error);
      return null;
    }

    await createNotificationForRole("admin", {
      issueId,
      title: "Student response received",
      message: confirmed
        ? `Issue #${issueId} was confirmed and closed by the student.`
        : `Issue #${issueId} was reopened by the student.`,
    });

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function autoCloseResolvedIssues(days = 7) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("issues")
      .update({
        status: "Closed",
        student_feedback: "Auto-closed after no student response.",
        closed_at: new Date().toISOString(),
      })
      .eq("status", "Resolved")
      .lte("resolved_at", cutoff)
      .is("closed_at", null)
      .select("id");

    if (error) {
      console.error("Error auto-closing resolved issues:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

// ============ IMAGE UPLOAD FUNCTIONS ============

export async function uploadIssueImage(file, issueId) {
  try {
    if (!file) {
      return null;
    }

    const fileExt = file.name.split(".").pop() || "jpg";
    const filename = `issue-${issueId}-${Date.now()}.${fileExt}`;
    const filePath = `issues/${filename}`;

    const { error } = await supabase.storage
      .from("issue-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Storage upload failed:", error);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from("issue-images")
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function saveImageReference(issueId, imageUrl) {
  try {
    const { data, error } = await supabase.from("issue_images").insert([
      {
        issue_id: issueId,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      console.error("Database error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

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

// ============ NOTIFICATIONS ============

export async function getNotifications() {
  try {
    const email = getEmail();
    if (!email) {
      return [];
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (error.code === "42P01") {
        return [];
      }
      console.error("Error fetching notifications:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error:", err);
    return [];
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error && error.code !== "42P01") {
      console.error("Error marking notification as read:", error);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

async function createNotificationForEmail(recipientEmail, notification) {
  try {
    const { error } = await supabase.from("notifications").insert([
      {
        recipient_email: recipientEmail,
        issue_id: notification.issueId || null,
        title: notification.title,
        message: notification.message,
      },
    ]);

    if (error && error.code !== "42P01") {
      console.error("Error creating notification:", error);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

async function createNotificationForRole(role, notification) {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("email")
      .eq("role", role);
      
    if (error) {
      console.error("Error fetching users by role:", error);
      return;
    }
    
    const recipients = (data || []).map(r => r.email).filter(Boolean);
    await Promise.all(
      recipients.map((recipientEmail) => createNotificationForEmail(recipientEmail, notification))
    );
  } catch (err) {
    console.error("Error fetching recipients:", err);
  }
}

export { supabase };

// ============ DIAGNOSTIC FUNCTIONS ============

export async function checkSetup() {
  console.log("\n=== GOVERNMENT ISSUE TRACKING SETUP DIAGNOSTIC ===\n");

  console.log("1) Supabase connection");
  console.log("   URL:", SUPABASE_URL);
  console.log("   Key exists:", !!SUPABASE_ANON_KEY);

  console.log("\n2) Database tables");
  try {
    const { error: issuesError } = await supabase
      .from("issues")
      .select("count", { count: "exact" })
      .limit(1);
    console.log("   issues table:", issuesError ? `ERR ${issuesError.message}` : "OK");

    const { error: imagesError } = await supabase
      .from("issue_images")
      .select("count", { count: "exact" })
      .limit(1);
    console.log("   issue_images table:", imagesError ? `ERR ${imagesError.message}` : "OK");

    const { error: notificationsError } = await supabase
      .from("notifications")
      .select("count", { count: "exact" })
      .limit(1);
    console.log("   notifications table:", notificationsError ? `ERR ${notificationsError.message}` : "OK");
  } catch (err) {
    console.error("   Error checking tables:", err);
  }

  console.log("\n3) Storage bucket");
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error("   Error listing buckets:", bucketsError.message);
    } else {
      const issueImagesBucket = buckets.find((b) => b.name === "issue-images");
      if (issueImagesBucket) {
        console.log("   issue-images bucket found");
        console.log("   Public:", issueImagesBucket.public);
      } else {
        console.error("   issue-images bucket NOT FOUND");
      }
    }
  } catch (err) {
    console.error("   Error checking buckets:", err);
  }

  console.log("\n4) Local auth cache");
  console.log("   userEmail:", localStorage.getItem("userEmail"));
  console.log("   userRole:", localStorage.getItem("userRole"));

  console.log("\nDiagnostic complete\n");
}

export async function getAllUserRoles() {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('role', { ascending: true })
      .order('email', { ascending: true });
      
    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Error fetching user roles:', err);
    return [];
  }
}

export async function adminUpsertUserRole(email, role) {
  const normalizedEmail = (email || '').toLowerCase();
  const normalizedRole = normalizeRole((role || '').toLowerCase());
  
  if (!normalizedEmail || !normalizedRole) throw new Error('Invalid email or role');
  
  const { data, error } = await supabase.from('user_roles').upsert([{ email: normalizedEmail, role: normalizedRole, updated_at: new Date().toISOString() }], { onConflict: 'email' }).select();
  if (error) throw error;
  return data;
}

export async function adminDeleteUserRole(email) {
  const normalizedEmail = (email || '').toLowerCase();
  if (!normalizedEmail) throw new Error('Invalid email');
  
  const { error } = await supabase.from('user_roles').delete().eq('email', normalizedEmail);
  if (error) throw error;
  return true;
}

// ============ MORE INFO NEEDED FUNCTIONS ============

export async function requestMoreInfo(issueId, infoRequest, technicianEmail = null) {
  try {
    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email")
      .eq("id", issueId)
      .single();

    const updatePayload = {
      status: "More Info Needed",
      more_info_request: infoRequest,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error requesting more info:", error);
      return null;
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "More information needed",
        message: `Issue #${issueId}: ${infoRequest}`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function submitAdditionalInfo(issueId, additionalInfo) {
  try {
    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email, technician")
      .eq("id", issueId)
      .single();

    const updatePayload = {
      status: "In Progress",
      additional_info: additionalInfo,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error submitting additional info:", error);
      return null;
    }

    if (currentIssue?.technician && currentIssue.technician !== "Not Assigned") {
      await createNotificationForEmail(currentIssue.technician, {
        issueId,
        title: "Student provided additional information",
        message: `Issue #${issueId}: Student submitted the requested information.`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

// ============ TECHNICIAN SUBMISSION FUNCTIONS ============

export async function submitTechnicianWork(issueId, workDescription, submissionImageUrl = null) {
  try {
    const updatePayload = {
      status: "Resolved",
      resolution_notes: workDescription,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (submissionImageUrl) {
      updatePayload.submission_image_url = submissionImageUrl;
    }

    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email")
      .eq("id", issueId)
      .single();

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error submitting technician work:", error);
      return null;
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Your issue has been resolved",
        message: `Issue #${issueId} has been resolved. Please confirm if the problem is fixed.`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}
