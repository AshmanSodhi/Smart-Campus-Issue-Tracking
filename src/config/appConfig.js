// Shared configuration to eliminate inline literals and reduce mismatch bugs

export const APP_CONFIG = {
  // Default values
  DEFAULT_NOT_ASSIGNED: "Not Assigned",
  DEFAULT_ROLE: "student",
  
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
    STUDENT: "student",
    ADMIN: "admin",
    TECHNICIAN: "technician",
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
