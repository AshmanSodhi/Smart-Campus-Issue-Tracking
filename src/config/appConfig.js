// Shared configuration to eliminate inline literals and reduce mismatch bugs

export const APP_CONFIG = {
  // App name
  APP_NAME: "Government Issue Tracking System",
  
  // Default values
  DEFAULT_NOT_ASSIGNED: "Not Assigned",
  DEFAULT_ROLE: "citizen",
  DEFAULT_DB_ROLE: "student",

  // Auth settings
  AUTH: {
    ALLOWED_GOOGLE_DOMAIN: (import.meta.env.VITE_ALLOWED_GOOGLE_DOMAIN || "vitstudent.ac.in").toLowerCase(),
  },
  
  // Status values
  ISSUE_STATUSES: {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    MORE_INFO_NEEDED: "More Info Needed",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  },

  // Role values
  ROLES: {
    CITIZEN: "citizen",
    ADMIN: "admin",
    OFFICER: "officer",
  },

  DB_ROLES: {
    STUDENT: "student",
    ADMIN: "admin",
    TECHNICIAN: "technician",
  },
  
  // Role display names
  ROLE_NAMES: {
    citizen: "Citizen",
    admin: "Administrator",
    officer: "Government Officer",
  },

  // Technician application statuses
  TECH_APP_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  },

  // Issue priorities
  PRIORITIES: {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  },

  // Categories
  CATEGORIES: {
    INFRASTRUCTURE: "Infrastructure",
    MAINTENANCE: "Maintenance",
    SECURITY: "Security",
    IT_SUPPORT: "IT Support",
    FACILITIES: "Facilities",
    OTHER: "Other",
  },

  // Auto-close settings
  AUTO_CLOSE_DAYS: 7,

  // Valid issue stage transitions
  ISSUE_TRANSITIONS: {
    Pending: ["In Progress", "More Info Needed", "Resolved", "Closed"],
    "In Progress": ["More Info Needed", "Resolved", "Closed", "Pending"],
    "More Info Needed": ["In Progress", "Pending", "Resolved", "Closed"],
    Resolved: ["Closed", "In Progress", "Pending"],
    Closed: [],
  },

  // Notification types
  NOTIFICATION_TYPES: {
    ISSUE_ASSIGNED: "issue_assigned",
    STATUS_CHANGED: "status_changed",
    MORE_INFO_REQUESTED: "more_info_requested",
    ISSUE_RESOLVED: "issue_resolved",
    TECH_APPLICATION_REVIEWED: "tech_application_reviewed",
  },

  // Image upload settings
  MAX_IMAGE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],

  // UI settings
  ITEMS_PER_PAGE: 10,
  NOTIFICATION_DISPLAY_COUNT: 5,
};

// Helper functions for status checks
export const isStatusEqual = (status1, status2) => {
  return status1?.toLowerCase() === status2?.toLowerCase();
};

export const getStatusColor = (status) => {
  const normalizedStatus = status?.toLowerCase();
  const statusMap = {
    "pending": "#FFA500",
    "in progress": "#4A90E2",
    "more info needed": "#FFB6C1",
    "resolved": "#90EE90",
    "closed": "#808080",
  };
  return statusMap[normalizedStatus] || "#999999";
};

export const getStatusBadgeClass = (status) => {
  const normalizedStatus = status?.toLowerCase();
  const classMap = {
    "pending": "badge-pending",
    "in progress": "badge-in-progress",
    "more info needed": "badge-more-info",
    "resolved": "badge-resolved",
    "closed": "badge-closed",
  };
  return classMap[normalizedStatus] || "badge-default";
};

export const normalizePortalRole = (role) => {
  const normalized = (role || "").toLowerCase();
  if (normalized === APP_CONFIG.DB_ROLES.STUDENT) {
    return APP_CONFIG.ROLES.CITIZEN;
  }
  if (normalized === APP_CONFIG.DB_ROLES.TECHNICIAN) {
    return APP_CONFIG.ROLES.OFFICER;
  }
  if (normalized === APP_CONFIG.ROLES.CITIZEN || normalized === APP_CONFIG.ROLES.ADMIN || normalized === APP_CONFIG.ROLES.OFFICER) {
    return normalized;
  }
  return null;
};

export const normalizeDatabaseRole = (role) => {
  const normalized = (role || "").toLowerCase();
  if (normalized === APP_CONFIG.ROLES.CITIZEN) {
    return APP_CONFIG.DB_ROLES.STUDENT;
  }
  if (normalized === APP_CONFIG.ROLES.OFFICER) {
    return APP_CONFIG.DB_ROLES.TECHNICIAN;
  }
  if (
    normalized === APP_CONFIG.DB_ROLES.STUDENT ||
    normalized === APP_CONFIG.DB_ROLES.ADMIN ||
    normalized === APP_CONFIG.DB_ROLES.TECHNICIAN
  ) {
    return normalized;
  }
  return null;
};

export const isAllowedIssueTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) {
    return false;
  }
  if (fromStatus === toStatus) {
    return true;
  }
  const allowedTargets = APP_CONFIG.ISSUE_TRANSITIONS[fromStatus] || [];
  return allowedTargets.includes(toStatus);
};
