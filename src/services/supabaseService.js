import { createClient } from "@supabase/supabase-js";
import {
  APP_CONFIG,
  isAllowedIssueTransition,
  normalizeDatabaseRole,
  normalizePortalRole,
} from "../config/appConfig";

// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[Supabase] Missing credentials! Check .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const provisioningClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const DB_ROLES = APP_CONFIG.DB_ROLES;
const ISSUE_STATUSES = APP_CONFIG.ISSUE_STATUSES;
const ASSIGNMENT_NOTIFICATION_TITLES = [
  "Technician assigned",
  "Technician assignment updated",
  "Work started",
  "New assigned issue",
  "Issue reassigned",
  "Issue unassigned",
];
const MORE_INFO_NOTIFICATION_TITLES = ["More information needed"];

function getEmailDomain(email) {
  return ((email || "").split("@")[1] || "").toLowerCase();
}

function isAllowedInstitutionalDomain(email) {
  const allowedDomain = APP_CONFIG.AUTH.ALLOWED_GOOGLE_DOMAIN;
  if (!allowedDomain) {
    return true;
  }
  return getEmailDomain(email) === allowedDomain;
}

// ============ AUTH FUNCTIONS ============

function clearLocalAuth() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
}

function normalizeRole(role) {
  return normalizeDatabaseRole(role);
}

function createTemporaryPassword(length = 18) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function ensureTechnicianPasswordAccount(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Technician email is required for account provisioning.");
  }

  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  let createdNow = false;

  try {
    const { data, error } = await provisioningClient.auth.signUp({
      email: normalizedEmail,
      password: createTemporaryPassword(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      const normalizedMessage = (error.message || "").toLowerCase();
      const alreadyRegistered =
        normalizedMessage.includes("already registered") ||
        normalizedMessage.includes("user already") ||
        error.status === 422;

      if (!alreadyRegistered) {
        throw error;
      }
    } else {
      createdNow = Array.isArray(data?.user?.identities) && data.user.identities.length > 0;
    }
  } catch (error) {
    console.error("Error provisioning technician auth account:", error);
    throw new Error(error.message || "Failed to create technician account.");
  }

  try {
    const { error } = await provisioningClient.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      console.error("Error sending password setup email:", error);
      throw new Error(error.message || "Unable to send password setup email.");
    }
  } catch (error) {
    console.error("Error triggering password setup email:", error);
    throw new Error(error.message || "Unable to send password setup email.");
  }

  return { createdNow, passwordSetupEmailSent: true };
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
      .eq("status", APP_CONFIG.TECH_APP_STATUS.APPROVED)
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
    await upsertUserRole(normalized, DB_ROLES.TECHNICIAN);
    return DB_ROLES.TECHNICIAN;
  }

  await upsertUserRole(normalized, DB_ROLES.STUDENT);
  return DB_ROLES.STUDENT;
}

async function isAllowedGoogleAccount(email) {
  const role = await resolveRoleByEmail(email);
  if (role === DB_ROLES.STUDENT) {
    return isAllowedInstitutionalDomain(email);
  }
  return role === DB_ROLES.ADMIN || role === DB_ROLES.TECHNICIAN;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        prompt: "select_account",
        hd: APP_CONFIG.AUTH.ALLOWED_GOOGLE_DOMAIN,
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

  if (role === DB_ROLES.STUDENT && !isAllowedInstitutionalDomain(sessionEmail)) {
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error(`Only ${APP_CONFIG.AUTH.ALLOWED_GOOGLE_DOMAIN} accounts are allowed.`);
  }

  if (role === DB_ROLES.STUDENT) {
    await supabase.auth.signOut();
    clearLocalAuth();
    throw new Error("Students can only login with Google OAuth.");
  }

  localStorage.setItem("userRole", normalizePortalRole(role) || role);
  localStorage.setItem("userEmail", sessionEmail);
  return normalizePortalRole(role) || role;
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

  const portalRole = normalizePortalRole(role) || role;
  localStorage.setItem("userRole", portalRole);
  localStorage.setItem("userEmail", email.toLowerCase());
  return portalRole;
}

export function getRole() {
  return normalizePortalRole(localStorage.getItem("userRole"));
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
    const { data, error } = await supabase
      .from("user_roles")
      .select("email")
      .eq("role", DB_ROLES.TECHNICIAN);

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
      .eq("status", APP_CONFIG.TECH_APP_STATUS.APPROVED);

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
  if (existingRole === DB_ROLES.ADMIN || existingRole === DB_ROLES.TECHNICIAN) {
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
        status: APP_CONFIG.TECH_APP_STATUS.PENDING,
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

  await createNotificationForRole(DB_ROLES.ADMIN, {
    title: "New technician registration",
    message: `${fullName} requested technician access (${email}).`,
  });

  return data?.[0] || null;
}

export async function getTechnicianApplications(status = APP_CONFIG.TECH_APP_STATUS.PENDING) {
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
  const adminEmail = getEmail() || DB_ROLES.ADMIN;
  const status = approve ? APP_CONFIG.TECH_APP_STATUS.APPROVED : APP_CONFIG.TECH_APP_STATUS.REJECTED;
  let provisioningResult = null;

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
        try {
          provisioningResult = await ensureTechnicianPasswordAccount(data.email);
        } catch (provisioningError) {
          await supabase
            .from("technician_applications")
            .update({
              status: APP_CONFIG.TECH_APP_STATUS.PENDING,
              review_note: null,
              reviewed_by: null,
              reviewed_at: null,
            })
            .eq("id", applicationId);

          throw new Error(
            provisioningError.message ||
              "Unable to provision account. Application was returned to pending."
          );
        }

        await upsertUserRole(data.email, DB_ROLES.TECHNICIAN);
      }

      await createNotificationForEmail(data.email, {
        title: `Technician application ${status}`,
        message: approve
          ? "Your technician access request was approved. Check your email to set/reset your password before logging in."
          : `Your technician access request was rejected.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
      });
    }

    return {
      ...data,
      accountCreatedNow: provisioningResult?.createdNow || false,
      passwordSetupEmailSent: provisioningResult?.passwordSetupEmailSent || false,
    };
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
      priority: priority || APP_CONFIG.PRIORITIES.MEDIUM,
      status: ISSUE_STATUSES.PENDING,
      technician: APP_CONFIG.DEFAULT_NOT_ASSIGNED,
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
      await createNotificationForRole(DB_ROLES.ADMIN, {
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
    const targetStatus = status;
    const actorRole = getRole();
    const actorEmail = (getEmail() || "").toLowerCase();
    const { data: currentIssue, error: currentIssueError } = await supabase
      .from("issues")
      .select("student_email, technician, status")
      .eq("id", issueId)
      .single();

    if (currentIssueError) {
      console.error("Error fetching issue for status update:", currentIssueError);
      return null;
    }

    const assignedTechnician = (currentIssue?.technician || "").toLowerCase();
    const hasAssignedTechnician =
      currentIssue?.technician && currentIssue.technician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED;

    if (actorRole === APP_CONFIG.ROLES.CITIZEN) {
      console.error("Citizens cannot directly update issue status.");
      return null;
    }

    if (actorRole === APP_CONFIG.ROLES.OFFICER) {
      if (!actorEmail || !assignedTechnician || assignedTechnician !== actorEmail) {
        console.error("Officers can only update issues assigned to them.");
        return null;
      }

      const officerAllowedTargets = [ISSUE_STATUSES.MORE_INFO_NEEDED, ISSUE_STATUSES.RESOLVED];
      if (targetStatus !== currentIssue.status && !officerAllowedTargets.includes(targetStatus)) {
        console.error(`Officer status update not allowed: ${currentIssue.status} -> ${targetStatus}`);
        return null;
      }
    }

    if (targetStatus === ISSUE_STATUSES.MORE_INFO_NEEDED && !hasAssignedTechnician) {
      console.error("Cannot request more info without an assigned technician.");
      return null;
    }

    if (targetStatus === ISSUE_STATUSES.RESOLVED && !hasAssignedTechnician) {
      console.error("Cannot resolve an issue without an assigned technician.");
      return null;
    }

    if (!isAllowedIssueTransition(currentIssue.status, targetStatus)) {
      console.error(`Invalid issue transition: ${currentIssue.status} -> ${targetStatus}`);
      return null;
    }

    const updatePayload = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === ISSUE_STATUSES.RESOLVED) {
      updatePayload.resolved_at = new Date().toISOString();
      if (completionNote) {
        updatePayload.completion_note = completionNote;
      }
    }

    if (targetStatus === ISSUE_STATUSES.PENDING || targetStatus === ISSUE_STATUSES.IN_PROGRESS) {
      updatePayload.resolved_at = null;
      updatePayload.closed_at = null;
    }

    if (targetStatus !== ISSUE_STATUSES.MORE_INFO_NEEDED) {
      updatePayload.more_info_request = null;
    }

    if (targetStatus === ISSUE_STATUSES.CLOSED) {
      updatePayload.closed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error updating status:", error);
      return null;
    }

    if (
      currentIssue?.status === ISSUE_STATUSES.MORE_INFO_NEEDED &&
      targetStatus !== ISSUE_STATUSES.MORE_INFO_NEEDED &&
      currentIssue?.student_email
    ) {
      await deleteUnreadIssueNotifications(issueId, [currentIssue.student_email], MORE_INFO_NOTIFICATION_TITLES);
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Issue status updated",
        message: `Issue #${issueId} moved to ${targetStatus}.`,
      });
    }

    if (
      currentIssue?.technician &&
      currentIssue.technician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED &&
      targetStatus === ISSUE_STATUSES.CLOSED
    ) {
      await createNotificationForEmail(currentIssue.technician, {
        issueId,
        title: "Issue closed",
        message: `Issue #${issueId} was closed.`,
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
    const actorRole = getRole();
    if (actorRole !== APP_CONFIG.ROLES.ADMIN) {
      console.error("Only admins can assign technicians.");
      return null;
    }

    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email, status, technician")
      .eq("id", issueId)
      .single();

    if (!currentIssue) {
      return null;
    }

    if (
      currentIssue.status === ISSUE_STATUSES.RESOLVED ||
      currentIssue.status === ISSUE_STATUSES.CLOSED
    ) {
      console.error("Cannot change technician after an issue is resolved or closed.");
      return null;
    }

    const assignedTechnician = (technicianName || APP_CONFIG.DEFAULT_NOT_ASSIGNED).trim();
    const previousTechnician = (currentIssue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED).trim();

    if (assignedTechnician === previousTechnician) {
      return [currentIssue];
    }

    const cleanupRecipients = [currentIssue.student_email, previousTechnician, assignedTechnician].filter(
      (value) => value && value !== APP_CONFIG.DEFAULT_NOT_ASSIGNED
    );
    await deleteUnreadIssueNotifications(issueId, cleanupRecipients, ASSIGNMENT_NOTIFICATION_TITLES);

    const shouldAutoStart =
      assignedTechnician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED &&
      currentIssue?.status === ISSUE_STATUSES.PENDING;
    const shouldResetToPending =
      assignedTechnician === APP_CONFIG.DEFAULT_NOT_ASSIGNED &&
      (currentIssue?.status === ISSUE_STATUSES.IN_PROGRESS ||
        currentIssue?.status === ISSUE_STATUSES.MORE_INFO_NEEDED);

    const updatePayload = {
      technician: assignedTechnician,
      updated_at: new Date().toISOString(),
    };

    if (shouldAutoStart) {
      updatePayload.status = ISSUE_STATUSES.IN_PROGRESS;
    }

    if (shouldResetToPending) {
      updatePayload.status = ISSUE_STATUSES.PENDING;
    }

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error assigning technician:", error);
      return null;
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Technician assignment updated",
        message:
          assignedTechnician === APP_CONFIG.DEFAULT_NOT_ASSIGNED
            ? `Issue #${issueId} is currently unassigned.`
            : `Issue #${issueId} was assigned to ${assignedTechnician}.`,
      });

      if (shouldAutoStart) {
        await createNotificationForEmail(currentIssue.student_email, {
          issueId,
          title: "Work started",
          message: `Issue #${issueId} moved to ${ISSUE_STATUSES.IN_PROGRESS}.`,
        });
      }
    }

    if (
      previousTechnician &&
      previousTechnician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED &&
      previousTechnician !== assignedTechnician
    ) {
      await createNotificationForEmail(previousTechnician, {
        issueId,
        title:
          assignedTechnician === APP_CONFIG.DEFAULT_NOT_ASSIGNED
            ? "Issue unassigned"
            : "Issue reassigned",
        message:
          assignedTechnician === APP_CONFIG.DEFAULT_NOT_ASSIGNED
            ? `Issue #${issueId} is no longer assigned to you.`
            : `Issue #${issueId} was reassigned to ${assignedTechnician}.`,
      });
    }

    if (
      assignedTechnician &&
      assignedTechnician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED &&
      assignedTechnician !== previousTechnician
    ) {
      await createNotificationForEmail(assignedTechnician, {
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
    const { data: currentIssue, error: currentIssueError } = await supabase
      .from("issues")
      .select("technician")
      .eq("id", issueId)
      .single();

    if (currentIssueError) {
      console.error("Error fetching issue for confirmation:", currentIssueError);
      return null;
    }

    const isAssigned =
      currentIssue?.technician && currentIssue.technician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED;
    const nextStatus = confirmed
      ? ISSUE_STATUSES.CLOSED
      : isAssigned
        ? ISSUE_STATUSES.IN_PROGRESS
        : ISSUE_STATUSES.PENDING;

    const updatePayload = {
      status: nextStatus,
      student_feedback: note || null,
      closed_at: confirmed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (!confirmed) {
      updatePayload.resolved_at = null;
    }

    const { data, error } = await supabase
      .from("issues")
      .update(updatePayload)
      .eq("id", issueId)
      .select();

    if (error) {
      console.error("Error confirming resolution:", error);
      return null;
    }

    const feedbackSuffix = note ? ` Note: ${note}` : "";

    await createNotificationForRole(DB_ROLES.ADMIN, {
      issueId,
      title: "Student response received",
      message: confirmed
        ? `Issue #${issueId} was confirmed and closed by the student.${feedbackSuffix}`
        : `Issue #${issueId} was reopened by the student.${feedbackSuffix}`,
    });

    if (isAssigned) {
      await createNotificationForEmail(currentIssue.technician, {
        issueId,
        title: confirmed ? "Issue closed by citizen" : "Issue reopened by citizen",
        message: confirmed
          ? `Issue #${issueId} was confirmed and closed.${feedbackSuffix}`
          : `Issue #${issueId} was reopened and moved to ${nextStatus}.${feedbackSuffix}`,
      });
    }

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export async function autoCloseResolvedIssues(days = APP_CONFIG.AUTO_CLOSE_DAYS) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("issues")
      .update({
        status: ISSUE_STATUSES.CLOSED,
        student_feedback: "Auto-closed after no student response.",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("status", ISSUE_STATUSES.RESOLVED)
      .lte("resolved_at", cutoff)
      .is("closed_at", null)
      .select("id, student_email, technician");

    if (error) {
      console.error("Error auto-closing resolved issues:", error);
      return [];
    }

    const closedIssues = data || [];
    for (const issue of closedIssues) {
      if (issue.student_email) {
        await createNotificationForEmail(issue.student_email, {
          issueId: issue.id,
          title: "Issue auto-closed",
          message: `Issue #${issue.id} was auto-closed after ${days} days without confirmation.`,
        });
      }

      if (issue.technician && issue.technician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED) {
        await createNotificationForEmail(issue.technician, {
          issueId: issue.id,
          title: "Issue auto-closed",
          message: `Issue #${issue.id} was auto-closed after ${days} days.`,
        });
      }

      await createNotificationForRole(DB_ROLES.ADMIN, {
        issueId: issue.id,
        title: "Issue auto-closed",
        message: `Issue #${issue.id} was auto-closed after ${days} days without student confirmation.`,
      });
    }

    return closedIssues;
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

async function deleteUnreadIssueNotifications(issueId, recipients = [], titles = []) {
  if (!issueId) {
    return;
  }

  const normalizedRecipients = recipients
    .map((email) => (email || "").trim().toLowerCase())
    .filter(Boolean);

  try {
    if (normalizedRecipients.length > 0) {
      await Promise.all(
        normalizedRecipients.map(async (recipientEmail) => {
          let query = supabase
            .from("notifications")
            .delete()
            .eq("issue_id", issueId)
            .eq("recipient_email", recipientEmail)
            .eq("is_read", false);

          if (titles.length > 0) {
            query = query.in("title", titles);
          }

          const { error } = await query;
          if (error && error.code !== "42P01") {
            console.error("Error deleting notifications:", error);
          }
        })
      );
      return;
    }

    let query = supabase
      .from("notifications")
      .delete()
      .eq("issue_id", issueId)
      .eq("is_read", false);

    if (titles.length > 0) {
      query = query.in("title", titles);
    }

    const { error } = await query;
    if (error && error.code !== "42P01") {
      console.error("Error deleting notifications:", error);
    }
  } catch (err) {
    console.error("Error deleting notifications:", err);
  }
}

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
  const normalizedRecipient = (recipientEmail || "").trim().toLowerCase();
  if (!normalizedRecipient) {
    return;
  }

  try {
    const { error } = await supabase.from("notifications").insert([
      {
        recipient_email: normalizedRecipient,
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
      .select("student_email, status, technician")
      .eq("id", issueId)
      .single();

    if (!currentIssue) {
      return null;
    }

    const requesterEmail = (technicianEmail || getEmail() || "").toLowerCase();
    const assignedTechnician = (currentIssue.technician || "").toLowerCase();
    const actorRole = getRole();

    if (
      !assignedTechnician ||
      currentIssue.technician === APP_CONFIG.DEFAULT_NOT_ASSIGNED ||
      (actorRole !== APP_CONFIG.ROLES.ADMIN && requesterEmail !== assignedTechnician)
    ) {
      console.error("Only the assigned technician or admin can request more information.");
      return null;
    }

    if (!isAllowedIssueTransition(currentIssue.status, ISSUE_STATUSES.MORE_INFO_NEEDED)) {
      console.error(
        `Invalid issue transition for more info: ${currentIssue.status} -> ${ISSUE_STATUSES.MORE_INFO_NEEDED}`
      );
      return null;
    }

    const updatePayload = {
      status: ISSUE_STATUSES.MORE_INFO_NEEDED,
      more_info_request: infoRequest,
      resolved_at: null,
      updated_at: new Date().toISOString(),
    };

    if (currentIssue?.student_email) {
      await deleteUnreadIssueNotifications(issueId, [currentIssue.student_email], MORE_INFO_NOTIFICATION_TITLES);
    }

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
      .select("student_email, technician, status")
      .eq("id", issueId)
      .single();

    if (!currentIssue) {
      return null;
    }

    const actorEmail = (getEmail() || "").toLowerCase();
    const studentEmail = (currentIssue.student_email || "").toLowerCase();
    if (!actorEmail || actorEmail !== studentEmail) {
      console.error("Only the issue owner can submit additional information.");
      return null;
    }

    if (currentIssue.status !== ISSUE_STATUSES.MORE_INFO_NEEDED) {
      console.error("Additional information can only be submitted when issue status is More Info Needed.");
      return null;
    }

    const updatePayload = {
      status: ISSUE_STATUSES.RESOLVED,
      additional_info: additionalInfo || null,
      more_info_request: null,
      resolved_at: new Date().toISOString(),
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

    if (currentIssue?.student_email) {
      await deleteUnreadIssueNotifications(issueId, [currentIssue.student_email], MORE_INFO_NOTIFICATION_TITLES);
    }

    if (currentIssue?.technician && currentIssue.technician !== APP_CONFIG.DEFAULT_NOT_ASSIGNED) {
      await createNotificationForEmail(currentIssue.technician, {
        issueId,
        title: "Citizen provided additional information",
        message: `Issue #${issueId}: Citizen submitted requested details. Issue marked as ${ISSUE_STATUSES.RESOLVED}.`,
      });
    }

    await createNotificationForRole(DB_ROLES.ADMIN, {
      issueId,
      title: "Additional information submitted",
      message: `Issue #${issueId} received additional information from the citizen and moved to ${ISSUE_STATUSES.RESOLVED}.`,
    });

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Additional information submitted",
        message: `Your follow-up for issue #${issueId} was submitted and the issue is now marked ${ISSUE_STATUSES.RESOLVED}.`,
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
    const actorEmail = (getEmail() || "").toLowerCase();
    const { data: currentIssue } = await supabase
      .from("issues")
      .select("student_email, status, technician")
      .eq("id", issueId)
      .single();

    if (!currentIssue) {
      return null;
    }

    const assignedTechnician = (currentIssue.technician || "").toLowerCase();
    if (
      !assignedTechnician ||
      currentIssue.technician === APP_CONFIG.DEFAULT_NOT_ASSIGNED ||
      assignedTechnician !== actorEmail
    ) {
      console.error("Only the assigned technician can submit work for this issue.");
      return null;
    }

    if (!isAllowedIssueTransition(currentIssue.status, ISSUE_STATUSES.RESOLVED)) {
      console.error(
        `Invalid issue transition for technician submission: ${currentIssue.status} -> ${ISSUE_STATUSES.RESOLVED}`
      );
      return null;
    }

    const updatePayload = {
      status: ISSUE_STATUSES.RESOLVED,
      resolution_notes: workDescription,
      more_info_request: null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (submissionImageUrl) {
      updatePayload.submission_image_url = submissionImageUrl;
    }

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
      await deleteUnreadIssueNotifications(issueId, [currentIssue.student_email], MORE_INFO_NOTIFICATION_TITLES);
    }

    if (currentIssue?.student_email) {
      await createNotificationForEmail(currentIssue.student_email, {
        issueId,
        title: "Your issue has been resolved",
        message: `Issue #${issueId} has been resolved. Please confirm if the problem is fixed.`,
      });
    }

    await createNotificationForRole(DB_ROLES.ADMIN, {
      issueId,
      title: "Issue resolved by technician",
      message: `Issue #${issueId} has been marked resolved and is awaiting student confirmation.`,
    });

    return data;
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}
