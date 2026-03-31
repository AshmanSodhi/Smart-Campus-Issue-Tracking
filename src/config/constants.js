// Shared configuration and constants for Government Issue Tracking System

export const ISSUE_STATUSES = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  MORE_INFO_NEEDED: "More Info Needed",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ISSUE_PRIORITIES = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ISSUE_CATEGORIES = {
  INFRASTRUCTURE: "Infrastructure",
  ACADEMIC_FACILITIES: "Academic Facilities",
  SECURITY: "Security",
  UTILITIES: "Utilities",
  OTHERS: "Others",
};

export const USER_ROLES = {
  STUDENT: "student",
  TECHNICIAN: "technician",
  ADMIN: "admin",
};

export const NOTIFICATION_TYPES = {
  ASSIGNMENT: "assignment",
  STATUS_UPDATE: "status_update",
  MORE_INFO_NEEDED: "more_info_needed",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  INFO_PROVIDED: "info_provided",
};

export const DEFAULT_NOT_ASSIGNED = "Not Assigned";
export const DEFAULT_ROLE = USER_ROLES.STUDENT;
export const AUTO_CLOSE_DAYS = 7;

export const STATUS_COLORS = {
  [ISSUE_STATUSES.PENDING]: "#FFA500",
  [ISSUE_STATUSES.IN_PROGRESS]: "#4A90E2",
  [ISSUE_STATUSES.MORE_INFO_NEEDED]: "#E2944A",
  [ISSUE_STATUSES.RESOLVED]: "#7CB342",
  [ISSUE_STATUSES.CLOSED]: "#999999",
};

export const TRANSITION_RULES = {
  [ISSUE_STATUSES.PENDING]: [
    ISSUE_STATUSES.IN_PROGRESS,
    ISSUE_STATUSES.MORE_INFO_NEEDED,
  ],
  [ISSUE_STATUSES.IN_PROGRESS]: [
    ISSUE_STATUSES.RESOLVED,
    ISSUE_STATUSES.MORE_INFO_NEEDED,
  ],
  [ISSUE_STATUSES.MORE_INFO_NEEDED]: [
    ISSUE_STATUSES.IN_PROGRESS,
    ISSUE_STATUSES.PENDING,
  ],
  [ISSUE_STATUSES.RESOLVED]: [ISSUE_STATUSES.CLOSED],
  [ISSUE_STATUSES.CLOSED]: [],
};

export const KEYBOARD_SHORTCUTS = {
  NEW_ISSUE: "Alt+N",
  FILTER: "/",
};
