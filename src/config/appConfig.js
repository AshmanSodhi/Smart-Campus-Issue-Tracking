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
    ALLOWED_GOOGLE_DOMAIN: (import.meta.env.VITE_ALLOWED_GOOGLE_DOMAIN || "").toLowerCase(),
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
    ROADS_AND_STREETS: "Roads and Streets",
    REPAIRS_AND_MAINTENANCE: "Repairs and Maintenance",
    PUBLIC_SAFETY: "Public Safety",
    ONLINE_SERVICES: "Online Services and Portals",
    PUBLIC_FACILITIES: "Public Facilities and Cleanliness",
    OTHER_CIVIC: "Other Civic Issue",
  },

  DEPARTMENTS: {
    PUBLIC_WORKS: "Public Works",
    MAINTENANCE: "Maintenance",
    SAFETY: "Safety",
    E_GOV_IT: "E-Gov IT",
    FACILITIES: "Facilities",
    CITIZEN_CELL: "Citizen Cell",
  },

  CATEGORY_DEPARTMENTS: {
    "Roads and Streets": "Public Works",
    "Repairs and Maintenance": "Maintenance",
    "Public Safety": "Safety",
    "Online Services and Portals": "E-Gov IT",
    "Public Facilities and Cleanliness": "Facilities",
    "Other Civic Issue": "Citizen Cell",
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

const normalizeStatusKey = (status) => {
  if (typeof status !== "string") {
    return "";
  }

  return status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
};

const ISSUE_STATUS_LOOKUP = Object.values(APP_CONFIG.ISSUE_STATUSES).reduce((lookup, value) => {
  lookup[normalizeStatusKey(value)] = value;
  return lookup;
}, {});

const normalizeCategoryKey = (category) => {
  if (typeof category !== "string") {
    return "";
  }

  return category
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
};

const normalizeDepartmentKey = (department) => {
  if (typeof department !== "string") {
    return "";
  }

  return department
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
};

const ISSUE_CATEGORY_LOOKUP = Object.values(APP_CONFIG.CATEGORIES).reduce((lookup, value) => {
  lookup[normalizeCategoryKey(value)] = value;
  return lookup;
}, {});

const CATEGORY_ALIASES = {
  infrastructure: APP_CONFIG.CATEGORIES.ROADS_AND_STREETS,
  maintenance: APP_CONFIG.CATEGORIES.REPAIRS_AND_MAINTENANCE,
  security: APP_CONFIG.CATEGORIES.PUBLIC_SAFETY,
  "it support": APP_CONFIG.CATEGORIES.ONLINE_SERVICES,
  facilities: APP_CONFIG.CATEGORIES.PUBLIC_FACILITIES,
  other: APP_CONFIG.CATEGORIES.OTHER_CIVIC,
};

const CATEGORY_CANONICAL_FILTER_VALUES = {
  [APP_CONFIG.CATEGORIES.ROADS_AND_STREETS]: [
    APP_CONFIG.CATEGORIES.ROADS_AND_STREETS,
    "Infrastructure",
  ],
  [APP_CONFIG.CATEGORIES.REPAIRS_AND_MAINTENANCE]: [
    APP_CONFIG.CATEGORIES.REPAIRS_AND_MAINTENANCE,
    "Maintenance",
  ],
  [APP_CONFIG.CATEGORIES.PUBLIC_SAFETY]: [
    APP_CONFIG.CATEGORIES.PUBLIC_SAFETY,
    "Security",
  ],
  [APP_CONFIG.CATEGORIES.ONLINE_SERVICES]: [
    APP_CONFIG.CATEGORIES.ONLINE_SERVICES,
    "IT Support",
  ],
  [APP_CONFIG.CATEGORIES.PUBLIC_FACILITIES]: [
    APP_CONFIG.CATEGORIES.PUBLIC_FACILITIES,
    "Facilities",
  ],
  [APP_CONFIG.CATEGORIES.OTHER_CIVIC]: [
    APP_CONFIG.CATEGORIES.OTHER_CIVIC,
    "Other",
  ],
};

const DEPARTMENT_LOOKUP = Object.values(APP_CONFIG.DEPARTMENTS).reduce((lookup, value) => {
  lookup[normalizeDepartmentKey(value)] = value;
  return lookup;
}, {});

const DEPARTMENT_ALIASES = {
  // Legacy long names
  "public works department": APP_CONFIG.DEPARTMENTS.PUBLIC_WORKS,
  "municipal maintenance department": APP_CONFIG.DEPARTMENTS.MAINTENANCE,
  "public safety department": APP_CONFIG.DEPARTMENTS.SAFETY,
  "e governance and it department": APP_CONFIG.DEPARTMENTS.E_GOV_IT,
  "facilities and sanitation department": APP_CONFIG.DEPARTMENTS.FACILITIES,
  "citizen support cell": APP_CONFIG.DEPARTMENTS.CITIZEN_CELL,
  // Common short forms
  pwd: APP_CONFIG.DEPARTMENTS.PUBLIC_WORKS,
  mnt: APP_CONFIG.DEPARTMENTS.MAINTENANCE,
  safe: APP_CONFIG.DEPARTMENTS.SAFETY,
  "egov it": APP_CONFIG.DEPARTMENTS.E_GOV_IT,
  "egov-it": APP_CONFIG.DEPARTMENTS.E_GOV_IT,
  fac: APP_CONFIG.DEPARTMENTS.FACILITIES,
  csc: APP_CONFIG.DEPARTMENTS.CITIZEN_CELL,
};

export const normalizeIssueStatus = (status) => {
  const normalizedKey = normalizeStatusKey(status);
  return ISSUE_STATUS_LOOKUP[normalizedKey] || null;
};

export const normalizeIssueCategory = (category) => {
  const normalizedKey = normalizeCategoryKey(category);
  return ISSUE_CATEGORY_LOOKUP[normalizedKey] || CATEGORY_ALIASES[normalizedKey] || null;
};

export const normalizeDepartmentName = (department) => {
  const normalizedKey = normalizeDepartmentKey(department);
  return DEPARTMENT_LOOKUP[normalizedKey] || DEPARTMENT_ALIASES[normalizedKey] || null;
};

export const getIssueCategoryOptions = () => Object.values(APP_CONFIG.CATEGORIES);

export const getIssueCategoryDepartment = (category) => {
  const canonicalCategory = normalizeIssueCategory(category);
  if (!canonicalCategory) {
    return APP_CONFIG.DEPARTMENTS.CITIZEN_CELL;
  }
  return normalizeDepartmentName(APP_CONFIG.CATEGORY_DEPARTMENTS[canonicalCategory]) || APP_CONFIG.DEPARTMENTS.CITIZEN_CELL;
};

export const getIssueCategoryLabel = (category) => {
  return normalizeIssueCategory(category) || category || APP_CONFIG.CATEGORIES.OTHER_CIVIC;
};

export const getIssueCategoryFilterValues = (category) => {
  const canonicalCategory = normalizeIssueCategory(category);
  if (!canonicalCategory) {
    return category ? [category] : [];
  }
  return CATEGORY_CANONICAL_FILTER_VALUES[canonicalCategory] || [canonicalCategory];
};

export const getDepartmentIssueCategoryFilterValues = (department) => {
  const canonicalDepartment = normalizeDepartmentName(department);
  if (!canonicalDepartment) {
    return [];
  }

  const canonicalCategories = Object.values(APP_CONFIG.CATEGORIES).filter(
    (category) =>
      normalizeDepartmentName(APP_CONFIG.CATEGORY_DEPARTMENTS[category]) === canonicalDepartment
  );

  const values = canonicalCategories.flatMap((category) => getIssueCategoryFilterValues(category));
  return Array.from(new Set(values));
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
  const normalizedFromStatus = normalizeIssueStatus(fromStatus);
  const normalizedToStatus = normalizeIssueStatus(toStatus);

  if (!normalizedFromStatus || !normalizedToStatus) {
    return false;
  }
  if (normalizedFromStatus === normalizedToStatus) {
    return true;
  }
  const allowedTargets = APP_CONFIG.ISSUE_TRANSITIONS[normalizedFromStatus] || [];
  return allowedTargets.includes(normalizedToStatus);
};
