import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminDeleteUserRole,
  adminUpsertUserRole,
  assignTechnician,
  getAllIssues,
  getAllUserRoles,
  getAssignableTechnicians,
  getIssueImages,
  getNotifications,
  getTechnicianApplications,
  logout,
  markNotificationRead,
  requestMoreInfo,
  reviewTechnicianApplication,
  updateIssueStatus,
} from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import { APP_CONFIG, getStatusBadgeClass } from "../config/appConfig";
import "./admin.css";

function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("issues");
  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [techApplications, setTechApplications] = useState([]);
  const [technicians, setTechnicians] = useState([APP_CONFIG.DEFAULT_NOT_ASSIGNED]);
  const [userRoles, setUserRoles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [dbManagementLoading, setDbManagementLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [lastStatusChange, setLastStatusChange] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState(APP_CONFIG.DEFAULT_DB_ROLE);

  const [filters, setFilters] = useState({
    status: "All",
    technician: "All",
    category: "All",
    priority: "All",
  });

  const statusFilterRef = useRef(null);
  const notificationPanelRef = useRef(null);

  const metrics = useMemo(() => {
    const pending = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.PENDING).length;
    const inProgress = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.IN_PROGRESS).length;
    const resolved = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.RESOLVED).length;
    const closed = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED).length;

    return {
      total: issues.length,
      pending,
      inProgress,
      resolved,
      closed,
    };
  }, [issues]);

  const pendingApplications = useMemo(
    () =>
      techApplications.filter(
        (application) =>
          (application.status || "").toLowerCase() === APP_CONFIG.TECH_APP_STATUS.PENDING
      ),
    [techApplications]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedIssues = await getAllIssues(filters);
      setIssues(fetchedIssues);

      const imagePairs = await Promise.all(
        fetchedIssues.map(async (issue) => {
          const images = await getIssueImages(issue.id);
          return [issue.id, images];
        })
      );
      setIssueImages(Object.fromEntries(imagePairs));

      const [fetchedNotifications, fetchedTechApplications, fetchedTechnicians, fetchedUserRoles] =
        await Promise.all([
          getNotifications(),
          getTechnicianApplications("all"),
          getAssignableTechnicians(),
          getAllUserRoles(),
        ]);

      setNotifications(fetchedNotifications);
      setTechApplications(fetchedTechApplications);
      setTechnicians([APP_CONFIG.DEFAULT_NOT_ASSIGNED, ...fetchedTechnicians]);
      setUserRoles(fetchedUserRoles);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        statusFilterRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateStatus = async (id, newStatus) => {
    const currentIssue = issues.find((issue) => issue.id === id);
    const previousStatus = currentIssue?.status;

    if (!currentIssue || newStatus === previousStatus) {
      return;
    }

    if (newStatus === APP_CONFIG.ISSUE_STATUSES.CLOSED && !window.confirm("Close this issue? You can undo this change.")) {
      return;
    }

    if (newStatus === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED) {
      const infoRequest = window.prompt("What additional information is required from the citizen?");
      if (!infoRequest || !infoRequest.trim()) {
        return;
      }

      setLoading(true);
      const result = await requestMoreInfo(id, infoRequest.trim());
      if (!result) {
        setFeedback(`Unable to request more information for issue #${id}.`);
        setLoading(false);
        return;
      }
      await loadDashboard();
      if (previousStatus && previousStatus !== newStatus) {
        setLastStatusChange({ id, previousStatus });
      }
      setFeedback(`Issue #${id} moved to ${newStatus}.`);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await updateIssueStatus(id, newStatus);
    if (!result) {
      setFeedback(`Status change not allowed for issue #${id}.`);
      setLoading(false);
      return;
    }
    await loadDashboard();

    if (previousStatus && previousStatus !== newStatus) {
      setLastStatusChange({ id, previousStatus });
    }

    setFeedback(`Issue #${id} updated to ${newStatus}.`);
    setLoading(false);
  };

  const undoLastStatusChange = async () => {
    if (!lastStatusChange) {
      return;
    }

    setLoading(true);
    await updateIssueStatus(lastStatusChange.id, lastStatusChange.previousStatus);
    await loadDashboard();
    setFeedback(`Reverted issue #${lastStatusChange.id} to ${lastStatusChange.previousStatus}.`);
    setLastStatusChange(null);
    setLoading(false);
  };

  const handleAssignTechnician = async (id, tech) => {
    setLoading(true);
    const result = await assignTechnician(id, tech);
    if (!result) {
      setFeedback(`Technician change is not allowed for issue #${id}.`);
      setLoading(false);
      return;
    }
    await loadDashboard();
    setFeedback(`Technician updated for issue #${id}.`);
    setLoading(false);
  };

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadDashboard();
  };

  const handleReviewTechnician = async (applicationId, approve) => {
    setLoading(true);
    try {
      const result = await reviewTechnicianApplication(applicationId, approve);
      await loadDashboard();

      if (!approve) {
        setFeedback("Technician application rejected.");
      } else if (result?.passwordSetupEmailSent) {
        setFeedback(
          result?.accountCreatedNow
            ? "Technician application approved and account created. Password setup email sent."
            : "Technician application approved. Existing account detected and password setup email sent."
        );
      } else {
        setFeedback("Technician application approved.");
      }
    } catch (error) {
      setFeedback(error.message || "Unable to review technician application.");
    }
    setLoading(false);
  };

  const handleAddOrUpdateRole = async (event) => {
    event.preventDefault();
    if (!newUserEmail.trim()) {
      return;
    }

    setDbManagementLoading(true);
    try {
      await adminUpsertUserRole(newUserEmail.trim(), newUserRole);
      setFeedback(`Role updated for ${newUserEmail.trim()}.`);
      setNewUserEmail("");
      await loadDashboard();
    } catch (error) {
      setFeedback(error.message || "Unable to update user role.");
    }
    setDbManagementLoading(false);
  };

  const handleDeleteRole = async (email) => {
    if (!window.confirm(`Remove role mapping for ${email}?`)) {
      return;
    }

    setDbManagementLoading(true);
    try {
      await adminDeleteUserRole(email);
      setFeedback(`Removed role mapping for ${email}.`);
      await loadDashboard();
    } catch (error) {
      setFeedback(error.message || "Unable to remove role mapping.");
    }
    setDbManagementLoading(false);
  };

  const getStatusClass = (status) => {
    return `status ${getStatusBadgeClass(status)}`;
  };

  const isAssignmentLocked = (status) => {
    return (
      status === APP_CONFIG.ISSUE_STATUSES.RESOLVED ||
      status === APP_CONFIG.ISSUE_STATUSES.CLOSED
    );
  };

  const getAllowedStatusOptions = (status) => {
    const transitions = APP_CONFIG.ISSUE_TRANSITIONS[status] || [];
    return [status, ...transitions.filter((nextStatus) => nextStatus !== status)];
  };

  const renderIssueNotes = (issue) => {
    const notes = [
      issue.more_info_request ? { label: "Request", value: issue.more_info_request } : null,
      issue.additional_info ? { label: "Citizen", value: issue.additional_info } : null,
      issue.resolution_notes ? { label: "Work", value: issue.resolution_notes } : null,
      issue.student_feedback ? { label: "Feedback", value: issue.student_feedback } : null,
    ].filter(Boolean);

    if (!notes.length) {
      return "-";
    }

    return (
      <div className="issue-notes">
        {notes.map((note, index) => (
          <p className="issue-note" key={`${issue.id}-${note.label}-${index}`}>
            <strong>{note.label}:</strong> {note.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Admin Console</h2>

        <button
          className={activeTab === "issues" ? "active-tab" : ""}
          onClick={() => setActiveTab("issues")}
        >
          Issue Operations
        </button>
        <button
          className={activeTab === "applications" ? "active-tab" : ""}
          onClick={() => setActiveTab("applications")}
        >
          Technician Applications {pendingApplications.length > 0 ? `(${pendingApplications.length})` : ""}
        </button>
        <button
          className={activeTab === "database" ? "active-tab" : ""}
          onClick={() => setActiveTab("database")}
        >
          Database Management
        </button>

        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>

      <div className="main-content">
        <div className="admin-shell">
          <div className="header admin-header">
            <div>
              <p className="breadcrumbs">Home / Admin</p>
              <h1>Admin Dashboard</h1>
              <p className="helper-text">Shortcut: press / to jump to status filter.</p>
            </div>

            <div className="header-tools" ref={notificationPanelRef}>
              <button
                type="button"
                className="notification-icon-button"
                aria-label={`Notifications${unreadNotificationsCount ? ` (${unreadNotificationsCount} unread)` : ""}`}
                aria-expanded={showNotifications}
                onClick={() => setShowNotifications((prev) => !prev)}
              >
                <span className="notification-icon" aria-hidden="true">
                  🔔
                </span>
                {unreadNotificationsCount > 0 && (
                  <span className="notification-badge">{unreadNotificationsCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-popover" role="dialog" aria-label="Notifications panel">
                  <div className="notification-popover-header">
                    <h3>Notifications</h3>
                    <span>{unreadNotificationsCount} unread</span>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="notification-empty">No notifications yet.</p>
                  ) : (
                    <ul className="notification-list compact">
                      {notifications.map((notification) => (
                        <li
                          key={notification.id}
                          className={notification.is_read ? "notification read" : "notification unread"}
                        >
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.message}</p>
                          </div>
                          {!notification.is_read && (
                            <button onClick={() => markRead(notification.id)}>Mark read</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {feedback && <div className="feedback-banner admin-centered-banner">{feedback}</div>}
          {lastStatusChange && activeTab === "issues" && (
            <div className="feedback-banner warning admin-centered-banner" role="status">
              Last update can be reversed.
              <button className="ghost-action" onClick={undoLastStatusChange} disabled={loading}>
                Undo Status Change
              </button>
            </div>
          )}

          {activeTab === "issues" && (
            <>
              <section className="admin-section admin-section-narrow">
                <div className="metrics-row centered-metrics" aria-label="Admin summary">
                  <article className="metric-card">
                    <p>Total Issues</p>
                    <strong>{metrics.total}</strong>
                  </article>
                  <article className="metric-card">
                    <p>Pending</p>
                    <strong>{metrics.pending}</strong>
                  </article>
                  <article className="metric-card">
                    <p>In Progress</p>
                    <strong>{metrics.inProgress}</strong>
                  </article>
                  <article className="metric-card">
                    <p>Resolved / Closed</p>
                    <strong>{metrics.resolved + metrics.closed}</strong>
                  </article>
                </div>
              </section>

              <section className="admin-section admin-section-narrow">
                <div className="card centered-card">
                  <h3>Filters</h3>
                  <div className="filters-row">
                    <select
                      ref={statusFilterRef}
                      value={filters.status}
                      onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                      aria-label="Filter by issue status"
                    >
                      <option>All</option>
                      {Object.values(APP_CONFIG.ISSUE_STATUSES).map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>

                    <select
                      value={filters.technician}
                      onChange={(e) => setFilters((prev) => ({ ...prev, technician: e.target.value }))}
                      aria-label="Filter by technician"
                    >
                      <option>All</option>
                      {technicians.map((tech) => (
                        <option key={tech}>{tech}</option>
                      ))}
                    </select>

                    <select
                      value={filters.category}
                      onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                      aria-label="Filter by category"
                    >
                      <option>All</option>
                      {Object.values(APP_CONFIG.CATEGORIES).map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>

                    <select
                      value={filters.priority}
                      onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
                      aria-label="Filter by priority"
                    >
                      <option>All</option>
                      {Object.values(APP_CONFIG.PRIORITIES).map((priority) => (
                        <option key={priority}>{priority}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="admin-section admin-section-wide">
                <div className="card centered-card centered-table-card">
                  <h3>All Issues</h3>
                  {loading ? (
                    <p>Loading issues...</p>
                  ) : issues.length === 0 ? (
                    <p>No issues reported yet.</p>
                  ) : (
                    <div className="table-scroll table-scroll-issues">
                      <table className="issues-table admin-issues-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Issue Details</th>
                            <th>Reporter</th>
                            <th>Latest Notes</th>
                            <th>Media</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issues.map((issue) => (
                            <tr key={issue.id}>
                              <td>{issue.id}</td>
                              <td className="issue-summary-cell">
                                <p className="issue-title">{issue.title}</p>
                                <div className="issue-meta-grid">
                                  <span>
                                    <strong>Category:</strong> {issue.category}
                                  </span>
                                  <span>
                                    <strong>Priority:</strong> {issue.priority || APP_CONFIG.PRIORITIES.MEDIUM}
                                  </span>
                                  <span>
                                    <strong>Location:</strong> {issue.location}
                                  </span>
                                </div>
                              </td>
                              <td className="issue-reporter-cell">
                                <p className="reporter-email">{issue.student_email}</p>
                                {issue.created_at && (
                                  <p className="reporter-time">
                                    Reported {new Date(issue.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </td>
                              <td>{renderIssueNotes(issue)}</td>
                              <td>
                                {issueImages[issue.id] && issueImages[issue.id].length > 0 ? (
                                  <div className="image-gallery">
                                    {issueImages[issue.id].map((img, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img.image_url)}
                                        className="image-link"
                                        title="Click to view image"
                                      >
                                        View
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  "No images"
                                )}
                              </td>
                              <td className="issue-actions-cell">
                                <div className="admin-action-group">
                                  <p className="action-label">Technician</p>
                                  <p className="current-tech">
                                    <strong>Current:</strong> {issue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED}
                                  </p>
                                  <select
                                    value={issue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED}
                                    onChange={(e) => handleAssignTechnician(issue.id, e.target.value)}
                                    disabled={loading || isAssignmentLocked(issue.status)}
                                  >
                                    {technicians.map((tech) => (
                                      <option key={tech}>{tech}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="admin-action-group">
                                  <p className="action-label">Status</p>
                                  <div className="status-control-row">
                                    <span className={getStatusClass(issue.status)}>{issue.status}</span>
                                    <select
                                      value={issue.status}
                                      onChange={(e) => updateStatus(issue.id, e.target.value)}
                                      disabled={loading}
                                    >
                                      {getAllowedStatusOptions(issue.status).map((status) => (
                                        <option key={status}>{status}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "applications" && (
            <section className="admin-section admin-section-wide">
              <div className="card centered-card centered-table-card">
                <h3>Technician Registration Requests</h3>
                {techApplications.length === 0 ? (
                  <p>No technician registration requests found.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Phone</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Requested At</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {techApplications.map((application) => {
                          const isPending =
                            (application.status || "").toLowerCase() === APP_CONFIG.TECH_APP_STATUS.PENDING;
                          return (
                            <tr key={application.id}>
                              <td>{application.full_name}</td>
                              <td>{application.email}</td>
                              <td>{application.department}</td>
                              <td>{application.phone}</td>
                              <td>{application.reason}</td>
                              <td>{application.status}</td>
                              <td>{new Date(application.created_at).toLocaleString()}</td>
                              <td className="review-actions">
                                <button
                                  onClick={() => handleReviewTechnician(application.id, true)}
                                  disabled={loading || !isPending}
                                >
                                  Approve
                                </button>
                                <button
                                  className="reject"
                                  onClick={() => handleReviewTechnician(application.id, false)}
                                  disabled={loading || !isPending}
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "database" && (
            <>
              <section className="admin-section admin-section-narrow">
                <div className="card centered-card">
                  <h3>Add or Update User Role</h3>
                  <form onSubmit={handleAddOrUpdateRole}>
                    <div className="filters-row">
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@college.edu"
                        required
                      />
                      <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                        <option value={APP_CONFIG.DB_ROLES.STUDENT}>{APP_CONFIG.DB_ROLES.STUDENT}</option>
                        <option value={APP_CONFIG.DB_ROLES.TECHNICIAN}>{APP_CONFIG.DB_ROLES.TECHNICIAN}</option>
                        <option value={APP_CONFIG.DB_ROLES.ADMIN}>{APP_CONFIG.DB_ROLES.ADMIN}</option>
                      </select>
                      <button type="submit" disabled={dbManagementLoading}>
                        {dbManagementLoading ? "Saving..." : "Save Role"}
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="admin-section admin-section-wide">
                <div className="card centered-card centered-table-card">
                  <h3>User Role Records</h3>
                  {loading || dbManagementLoading ? (
                    <p>Loading role mappings...</p>
                  ) : userRoles.length === 0 ? (
                    <p>No role mappings found.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userRoles.map((row) => (
                            <tr key={row.email}>
                              <td>{row.email}</td>
                              <td>{row.role}</td>
                              <td>
                                <button onClick={() => handleDeleteRole(row.email)} disabled={dbManagementLoading}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>
              X
            </button>
            <img src={selectedImage} alt="Issue" className="modal-image" />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;